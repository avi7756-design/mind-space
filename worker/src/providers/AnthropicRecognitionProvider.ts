import type { Config } from '../config';
import { RecognitionError } from '../errors';
import {
  normalizeResult,
  RECOGNITION_SYSTEM_PROMPT,
  RECOGNITION_TOOL_NAME,
  RECOGNITION_TOOL_SCHEMA,
  type RawRecognition,
  type RecognitionResult,
} from '../schema';
import { toBase64 } from '../validation';
import type { RecognitionInput, RecognitionProvider } from './RecognitionProvider';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const MAX_OUTPUT_TOKENS = 1024;

interface AnthropicContentBlock {
  type: string;
  name?: string;
  input?: unknown;
}

export class AnthropicRecognitionProvider implements RecognitionProvider {
  readonly name = 'anthropic';

  constructor(
    private readonly apiKey: string,
    private readonly config: Config,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  get model(): string {
    return this.config.model;
  }

  async recognize(input: RecognitionInput): Promise<RecognitionResult> {
    const body = this.buildBody(input);

    let response = await this.send(body);
    // A single retry, only for conditions that are plausibly transient. A 4xx is
    // a request problem — repeating it just burns quota.
    if (response.status === 429 || response.status >= 500) {
      await sleep(400);
      response = await this.send(body);
    }

    if (response.status === 429 || response.status >= 500) {
      throw new RecognitionError('PROVIDER_UNAVAILABLE', `status-${response.status}`);
    }
    if (!response.ok) {
      throw new RecognitionError('PROVIDER_UNAVAILABLE', `status-${response.status}`);
    }

    let payload: { content?: AnthropicContentBlock[] };
    try {
      payload = (await response.json()) as { content?: AnthropicContentBlock[] };
    } catch {
      throw new RecognitionError('INVALID_PROVIDER_RESPONSE', 'unparsable-json');
    }

    const toolUse = (payload.content ?? []).find(
      (block) => block.type === 'tool_use' && block.name === RECOGNITION_TOOL_NAME,
    );
    // Free-form prose is not an acceptable answer — the contract is the tool call.
    if (!toolUse || typeof toolUse.input !== 'object' || toolUse.input === null) {
      throw new RecognitionError('INVALID_PROVIDER_RESPONSE', 'no-tool-use');
    }

    return normalizeResult(toolUse.input as RawRecognition, this.config.minConfidence);
  }

  private buildBody(input: RecognitionInput): string {
    return JSON.stringify({
      model: this.config.model,
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: 0,
      system: `${RECOGNITION_SYSTEM_PROMPT} Reply in locale ${input.locale}.`,
      tools: [
        {
          name: RECOGNITION_TOOL_NAME,
          description: 'Record the product read from the photo.',
          input_schema: RECOGNITION_TOOL_SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: RECOGNITION_TOOL_NAME },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: input.mimeType, data: toBase64(input.bytes) },
            },
            { type: 'text', text: 'Identify this product.' },
          ],
        },
      ],
    });
  }

  private async send(body: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.providerTimeoutMs);
    try {
      return await this.fetchImpl(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': API_VERSION,
        },
        body,
        signal: controller.signal,
      });
    } catch (cause) {
      if (cause instanceof RecognitionError) throw cause;
      const aborted = cause instanceof Error && cause.name === 'AbortError';
      throw new RecognitionError(aborted ? 'PROVIDER_TIMEOUT' : 'PROVIDER_UNAVAILABLE', 'fetch-failed');
    } finally {
      clearTimeout(timer);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
