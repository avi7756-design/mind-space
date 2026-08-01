import { readConfig, type Config, type Env } from './config';
import { assertOriginAllowed, corsHeaders, handlePreflight } from './cors';
import { RecognitionError, toRecognitionError } from './errors';
import { consoleLogger, type Logger } from './logger';
import { createLimiter, type UsageLimiter } from './rateLimit';
import type { RecognitionResult } from './schema';
import { extractImage, resolveRequestId } from './validation';
import { AnthropicRecognitionProvider } from './providers/AnthropicRecognitionProvider';
import type { RecognitionProvider } from './providers/RecognitionProvider';

export const SERVICE_NAME = 'shopping-product-recognition';
const RECOGNIZE_PATH = '/v1/recognize';

export interface RecognitionSuccess {
  requestId: string;
  result: RecognitionResult;
  meta: {
    provider: 'anthropic';
    model: string;
    processingMs: number;
  };
}

/** Injection points for tests; production supplies none of them. */
export interface Dependencies {
  provider?: RecognitionProvider;
  limiter?: UsageLimiter;
  logger?: Logger;
  now?: () => number;
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function resolveProvider(env: Env, config: Config, deps: Dependencies): RecognitionProvider {
  if (deps.provider) return deps.provider;
  if (!env.ANTHROPIC_API_KEY) {
    // Missing configuration must read as "service unavailable", never as a hint
    // about which secret is absent.
    throw new RecognitionError('PROVIDER_UNAVAILABLE', 'missing-api-key');
  }
  return new AnthropicRecognitionProvider(env.ANTHROPIC_API_KEY, config);
}

export async function handleRequest(
  request: Request,
  env: Env,
  deps: Dependencies = {},
): Promise<Response> {
  const config = readConfig(env);
  const now = deps.now ?? Date.now;
  const log = deps.logger ?? consoleLogger;
  const startedAt = now();
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const cors = corsHeaders(origin, config);
  const requestId = resolveRequestId(request);

  if (request.method === 'OPTIONS') return handlePreflight(request, config);

  if (url.pathname === '/health') {
    return json({ status: 'ok', service: SERVICE_NAME }, 200, cors);
  }

  try {
    assertOriginAllowed(request, config);

    if (url.pathname !== RECOGNIZE_PATH) throw new RecognitionError('NOT_FOUND');
    if (request.method !== 'POST') throw new RecognitionError('METHOD_NOT_ALLOWED');

    const limiter = deps.limiter ?? createLimiter(env, config);
    const decision = await limiter.check(request);
    if (!decision.allowed) throw new RecognitionError(decision.code ?? 'RATE_LIMITED');

    const image = await extractImage(request, config);
    const provider = resolveProvider(env, config, deps);
    const result = await provider.recognize({
      bytes: image.bytes,
      mimeType: image.mimeType,
      locale: image.locale,
      requestId,
    });

    const body: RecognitionSuccess = {
      requestId,
      result,
      meta: { provider: 'anthropic', model: provider.model, processingMs: now() - startedAt },
    };
    log({
      requestId,
      route: RECOGNIZE_PATH,
      status: 200,
      processingMs: body.meta.processingMs,
      imageBytes: image.byteSize,
      mimeType: image.mimeType,
      confidenceLevel: result.confidenceLevel,
      needsConfirmation: result.needsConfirmation,
    });
    return json(body, 200, cors);
  } catch (cause) {
    const error = toRecognitionError(cause);
    log({
      requestId,
      route: url.pathname,
      status: error.status,
      processingMs: now() - startedAt,
      errorCode: error.code,
      detail: error.detail,
    });
    return json(error.toBody(requestId), error.status, cors);
  }
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },
};
