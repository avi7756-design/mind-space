import { describe, expect, it, vi } from 'vitest';
import { readConfig } from '../src/config';
import { RecognitionError } from '../src/errors';
import { AnthropicRecognitionProvider } from '../src/providers/AnthropicRecognitionProvider';
import { RECOGNITION_TOOL_NAME } from '../src/schema';
import { env } from './helpers';

const config = readConfig(env({ PROVIDER_TIMEOUT_MS: '50' }));

const input = {
  bytes: new Uint8Array([1, 2, 3, 4]),
  mimeType: 'image/jpeg' as const,
  locale: 'he-IL',
  requestId: 'req-1',
};

function toolResponse(payload: unknown, status = 200) {
  return new Response(
    JSON.stringify({ content: [{ type: 'tool_use', name: RECOGNITION_TOOL_NAME, input: payload }] }),
    { status, headers: { 'Content-Type': 'application/json' } },
  );
}

const goodPayload = {
  productName: 'OneBlade',
  brand: 'Philips',
  model: 'QP2724/10',
  category: 'מכונת גילוח',
  visibleText: ['PHILIPS', 'QP2724/10'],
  identifiers: { modelNumber: 'QP2724/10', sku: null, barcode: null },
  searchQuery: 'Philips OneBlade QP2724/10',
  confidence: 0.93,
};

describe('AnthropicRecognitionProvider', () => {
  it('sends one request carrying the image, the MIME type and a forced tool call', async () => {
    const fetchImpl = vi.fn(async () => toolResponse(goodPayload));
    const provider = new AnthropicRecognitionProvider('key', config, fetchImpl as unknown as typeof fetch);

    const result = await provider.recognize(input);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);

    expect(body.model).toBe(config.model);
    expect(body.temperature).toBe(0);
    expect(body.tool_choice).toEqual({ type: 'tool', name: RECOGNITION_TOOL_NAME });
    expect(body.tools[0].name).toBe(RECOGNITION_TOOL_NAME);
    expect(body.tools[0].input_schema.required).toContain('searchQuery');
    expect(body.messages[0].content[0].source.media_type).toBe('image/jpeg');
    expect(body.messages[0].content[0].source.data).toBe('AQIDBA==');
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('key');
    expect(result.model).toBe('QP2724/10');
  });

  it('keeps a null model rather than completing it by guesswork', async () => {
    const fetchImpl = vi.fn(async () => toolResponse({ ...goodPayload, model: null, confidence: 0.6 }));
    const provider = new AnthropicRecognitionProvider('key', config, fetchImpl as unknown as typeof fetch);

    const result = await provider.recognize(input);
    expect(result.model).toBeNull();
    expect(result.warnings).toContain('MODEL_NUMBER_UNCERTAIN');
    expect(result.needsConfirmation).toBe(true);
  });

  it('rejects a free-form text answer with no tool call', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ content: [{ type: 'text', text: 'It looks like a Philips razor.' }] }), {
          status: 200,
        }),
    );
    const provider = new AnthropicRecognitionProvider('key', config, fetchImpl as unknown as typeof fetch);
    await expect(provider.recognize(input)).rejects.toMatchObject({ code: 'INVALID_PROVIDER_RESPONSE' });
  });

  it('rejects an unparsable body', async () => {
    const fetchImpl = vi.fn(async () => new Response('<html>gateway</html>', { status: 200 }));
    const provider = new AnthropicRecognitionProvider('key', config, fetchImpl as unknown as typeof fetch);
    await expect(provider.recognize(input)).rejects.toMatchObject({ code: 'INVALID_PROVIDER_RESPONSE' });
  });

  it('does not retry a 4xx — repeating a bad request only burns quota', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 400 }));
    const provider = new AnthropicRecognitionProvider('key', config, fetchImpl as unknown as typeof fetch);

    await expect(provider.recognize(input)).rejects.toBeInstanceOf(RecognitionError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries at most once on 429 and on 5xx', async () => {
    for (const status of [429, 503]) {
      const fetchImpl = vi.fn(async () => new Response('{}', { status }));
      const provider = new AnthropicRecognitionProvider('key', config, fetchImpl as unknown as typeof fetch);
      await expect(provider.recognize(input)).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    }
  });

  it('succeeds when the single retry recovers', async () => {
    let attempt = 0;
    const fetchImpl = vi.fn(async () => {
      attempt += 1;
      return attempt === 1 ? new Response('{}', { status: 503 }) : toolResponse(goodPayload);
    });
    const provider = new AnthropicRecognitionProvider('key', config, fetchImpl as unknown as typeof fetch);

    const result = await provider.recognize(input);
    expect(result.searchQuery).toBe('Philips OneBlade QP2724/10');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('aborts on timeout and reports PROVIDER_TIMEOUT', async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }),
    );
    const provider = new AnthropicRecognitionProvider('key', config, fetchImpl as unknown as typeof fetch);
    await expect(provider.recognize(input)).rejects.toMatchObject({ code: 'PROVIDER_TIMEOUT' });
  });

  it('reports a network failure as PROVIDER_UNAVAILABLE', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('network down');
    });
    const provider = new AnthropicRecognitionProvider('key', config, fetchImpl as unknown as typeof fetch);
    await expect(provider.recognize(input)).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
  });

  it('carries no secret in the thrown error', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 401 }));
    const provider = new AnthropicRecognitionProvider('super-secret-key', config, fetchImpl as unknown as typeof fetch);
    await provider.recognize(input).catch((error: RecognitionError) => {
      expect(JSON.stringify(error.toBody('r'))).not.toContain('super-secret-key');
      expect(error.detail).not.toContain('super-secret-key');
    });
  });
});
