import { describe, expect, it } from 'vitest';
import { handleRequest, SERVICE_NAME, type RecognitionSuccess } from '../src/index';
import { RecognitionError, type RecognitionErrorBody } from '../src/errors';
import { FakeRecognitionProvider } from '../src/providers/FakeRecognitionProvider';
import type { UsageLimiter } from '../src/rateLimit';
import { env, ENDPOINT, imageFile, ORIGIN, recordingLogger, uploadRequest } from './helpers';

function limiterThat(allowed: boolean, code?: 'RATE_LIMITED' | 'DAILY_LIMIT_REACHED'): UsageLimiter {
  return { check: async () => (allowed ? { allowed: true } : { allowed: false, code }) };
}

describe('routing', () => {
  it('answers the health probe without exposing configuration', async () => {
    const response = await handleRequest(new Request('https://r.example/health'), env());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ status: 'ok', service: SERVICE_NAME });
    expect(JSON.stringify(body)).not.toContain('test-key-not-real');
  });

  it('returns a structured 404 for an unknown route', async () => {
    const response = await handleRequest(
      uploadRequest({ url: 'https://r.example/nope' }),
      env(),
      { provider: FakeRecognitionProvider.scenario('confident') },
    );
    expect(response.status).toBe(404);
    const body = (await response.json()) as RecognitionErrorBody;
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.requestId).toBeTruthy();
  });

  it('rejects GET on the recognition route with 405', async () => {
    const response = await handleRequest(
      new Request(ENDPOINT, { method: 'GET', headers: { Origin: ORIGIN } }),
      env(),
    );
    expect(response.status).toBe(405);
    expect(((await response.json()) as RecognitionErrorBody).error.code).toBe('METHOD_NOT_ALLOWED');
  });
});

describe('validation', () => {
  const provider = () => FakeRecognitionProvider.scenario('confident');

  it('rejects a request with no image part', async () => {
    const form = new FormData();
    form.append('locale', 'he-IL');
    const p = provider();
    const response = await handleRequest(
      new Request(ENDPOINT, { method: 'POST', headers: { Origin: ORIGIN }, body: form }),
      env(),
      { provider: p },
    );
    expect(response.status).toBe(400);
    expect(((await response.json()) as RecognitionErrorBody).error.code).toBe('MISSING_IMAGE');
    expect(p.calls).toHaveLength(0);
  });

  it('rejects an unsupported media type before calling the provider', async () => {
    const p = provider();
    const response = await handleRequest(
      uploadRequest({ file: imageFile('image/gif', 1024, 'x.gif') }),
      env(),
      { provider: p },
    );
    expect(response.status).toBe(415);
    expect(((await response.json()) as RecognitionErrorBody).error.code).toBe(
      'UNSUPPORTED_MEDIA_TYPE',
    );
    expect(p.calls).toHaveLength(0);
  });

  it.each(['image/jpeg', 'image/png', 'image/webp'])('accepts %s', async (mime) => {
    const response = await handleRequest(uploadRequest({ file: imageFile(mime) }), env(), {
      provider: provider(),
    });
    expect(response.status).toBe(200);
  });

  it('rejects a file above the size limit before the provider is contacted', async () => {
    const p = provider();
    const response = await handleRequest(
      uploadRequest({ file: imageFile('image/jpeg', 3 * 1024 * 1024) }),
      env(),
      { provider: p },
    );
    expect(response.status).toBe(413);
    expect(((await response.json()) as RecognitionErrorBody).error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(p.calls).toHaveLength(0);
  });

  it('rejects an empty image part', async () => {
    const p = provider();
    const response = await handleRequest(
      uploadRequest({ file: imageFile('image/jpeg', 0) }),
      env(),
      { provider: p },
    );
    expect(response.status).toBe(400);
    expect(p.calls).toHaveLength(0);
  });

  it('rejects a malformed multipart body', async () => {
    const p = provider();
    const response = await handleRequest(
      uploadRequest({
        body: 'not-actually-multipart',
        contentType: 'multipart/form-data; boundary=----broken',
      }),
      env(),
      { provider: p },
    );
    expect(response.status).toBe(400);
    expect(((await response.json()) as RecognitionErrorBody).error.code).toBe('INVALID_REQUEST');
    expect(p.calls).toHaveLength(0);
  });

  it('rejects a non-multipart content type', async () => {
    const response = await handleRequest(
      uploadRequest({ body: JSON.stringify({}), contentType: 'application/json' }),
      env(),
      { provider: provider() },
    );
    expect(response.status).toBe(400);
  });
});

describe('success contract', () => {
  it('returns every required field', async () => {
    const response = await handleRequest(uploadRequest(), env(), {
      provider: FakeRecognitionProvider.scenario('confident'),
      now: (() => {
        let t = 1000;
        return () => (t += 25);
      })(),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as RecognitionSuccess;
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.meta.provider).toBe('anthropic');
    expect(body.meta.model).toBeTruthy();
    expect(body.meta.processingMs).toBeGreaterThanOrEqual(0);

    const { result } = body;
    expect(Object.keys(result).sort()).toEqual(
      [
        'brand',
        'category',
        'confidence',
        'confidenceLevel',
        'identifiers',
        'model',
        'needsConfirmation',
        'productName',
        'searchQuery',
        'variant',
        'visibleText',
        'warnings',
      ].sort(),
    );
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.searchQuery.length).toBeGreaterThan(0);
  });

  it('preserves the model string exactly, slashes included', async () => {
    const response = await handleRequest(uploadRequest(), env(), {
      provider: FakeRecognitionProvider.scenario('confident'),
    });
    const { result } = (await response.json()) as RecognitionSuccess;
    expect(result.model).toBe('QP2724/10');
    expect(result.identifiers.modelNumber).toBe('QP2724/10');
    expect(result.searchQuery).toContain('QP2724/10');
  });

  it('marks a confident reading as not needing confirmation', async () => {
    const response = await handleRequest(uploadRequest(), env(), {
      provider: FakeRecognitionProvider.scenario('confident'),
    });
    const { result } = (await response.json()) as RecognitionSuccess;
    expect(result.needsConfirmation).toBe(false);
    expect(result.confidenceLevel).toBe('high');
    expect(result.warnings).toEqual([]);
  });

  it('returns 200 with needsConfirmation when the model number is unreadable', async () => {
    const response = await handleRequest(uploadRequest(), env(), {
      provider: FakeRecognitionProvider.scenario('uncertainModel'),
    });
    expect(response.status).toBe(200);
    const { result } = (await response.json()) as RecognitionSuccess;
    expect(result.needsConfirmation).toBe(true);
    expect(result.model).toBeNull();
    expect(result.warnings).toContain('MODEL_NUMBER_UNCERTAIN');
    // No invented model may leak into the query the shopper will run.
    expect(result.searchQuery).not.toMatch(/QP\d/);
  });

  it('returns 422 only when nothing usable could be read', async () => {
    const response = await handleRequest(uploadRequest(), env(), {
      provider: FakeRecognitionProvider.scenario('unidentifiable'),
    });
    expect(response.status).toBe(422);
    expect(((await response.json()) as RecognitionErrorBody).error.code).toBe('LOW_CONFIDENCE');
  });
});

describe('error contract', () => {
  it('carries a requestId, a code and a retryable flag on every error', async () => {
    const response = await handleRequest(uploadRequest({ file: imageFile('image/gif') }), env(), {
      provider: FakeRecognitionProvider.scenario('confident'),
    });
    const body = (await response.json()) as RecognitionErrorBody;
    expect(Object.keys(body).sort()).toEqual(['error', 'requestId']);
    expect(Object.keys(body.error).sort()).toEqual(['code', 'message', 'retryable']);
    expect(body.error.retryable).toBe(false);
  });

  it('maps a provider timeout to 504 and a provider outage to 502', async () => {
    const timeout = await handleRequest(uploadRequest(), env(), {
      provider: FakeRecognitionProvider.failing(new RecognitionError('PROVIDER_TIMEOUT')),
    });
    expect(timeout.status).toBe(504);
    expect(((await timeout.json()) as RecognitionErrorBody).error.retryable).toBe(true);

    const outage = await handleRequest(uploadRequest(), env(), {
      provider: FakeRecognitionProvider.failing(new RecognitionError('PROVIDER_UNAVAILABLE')),
    });
    expect(outage.status).toBe(502);
  });

  it('maps an unusable provider payload to 502', async () => {
    const response = await handleRequest(uploadRequest(), env(), {
      provider: FakeRecognitionProvider.failing(new RecognitionError('INVALID_PROVIDER_RESPONSE')),
    });
    expect(response.status).toBe(502);
    expect(((await response.json()) as RecognitionErrorBody).error.code).toBe(
      'INVALID_PROVIDER_RESPONSE',
    );
  });

  it('never leaks an internal message, a stack trace or a secret', async () => {
    const response = await handleRequest(uploadRequest(), env(), {
      provider: FakeRecognitionProvider.failing(
        new Error('boom at /src/providers/Anthropic.ts:42 key=test-key-not-real'),
      ),
    });
    expect(response.status).toBe(500);
    const raw = await response.text();
    expect(raw).not.toContain('boom');
    expect(raw).not.toContain('test-key-not-real');
    expect(raw).not.toContain('.ts:');
    expect(raw).not.toContain('stack');
  });

  it('reports the service as unavailable when the API key is not configured', async () => {
    const response = await handleRequest(
      uploadRequest(),
      env({ ANTHROPIC_API_KEY: undefined }),
    );
    expect(response.status).toBe(502);
    const raw = await response.text();
    expect(((JSON.parse(raw) as RecognitionErrorBody).error.code)).toBe('PROVIDER_UNAVAILABLE');
    expect(raw).not.toContain('ANTHROPIC_API_KEY');
  });
});

describe('usage limiting', () => {
  it('lets an allowed request through', async () => {
    const response = await handleRequest(uploadRequest(), env(), {
      provider: FakeRecognitionProvider.scenario('confident'),
      limiter: limiterThat(true),
    });
    expect(response.status).toBe(200);
  });

  it('blocks with 429 and never reaches the provider', async () => {
    const provider = FakeRecognitionProvider.scenario('confident');
    const response = await handleRequest(uploadRequest(), env(), {
      provider,
      limiter: limiterThat(false, 'RATE_LIMITED'),
    });
    expect(response.status).toBe(429);
    const body = (await response.json()) as RecognitionErrorBody;
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(body.error.retryable).toBe(true);
    expect(provider.calls).toHaveLength(0);
  });

  it('marks the daily cap as not retryable', async () => {
    const response = await handleRequest(uploadRequest(), env(), {
      provider: FakeRecognitionProvider.scenario('confident'),
      limiter: limiterThat(false, 'DAILY_LIMIT_REACHED'),
    });
    expect(response.status).toBe(429);
    expect(((await response.json()) as RecognitionErrorBody).error.retryable).toBe(false);
  });
});

describe('privacy', () => {
  it('calls the provider exactly once and passes the bytes and MIME through', async () => {
    const provider = FakeRecognitionProvider.scenario('confident');
    await handleRequest(uploadRequest({ file: imageFile('image/png', 512, 'p.png'), locale: 'he-IL' }), env(), {
      provider,
    });
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0].mimeType).toBe('image/png');
    expect(provider.calls[0].bytes.byteLength).toBe(512);
    expect(provider.calls[0].locale).toBe('he-IL');
  });

  it('logs only the allowlisted fields — no bytes, no base64, no secret', async () => {
    const { entries, logger } = recordingLogger();
    await handleRequest(uploadRequest(), env(), {
      provider: FakeRecognitionProvider.scenario('confident'),
      logger,
    });

    expect(entries).toHaveLength(1);
    const serialised = JSON.stringify(entries[0]);
    expect(serialised).not.toContain('test-key-not-real');
    expect(serialised).not.toMatch(/[A-Za-z0-9+/]{200,}={0,2}/);
    expect(Object.keys(entries[0]).sort()).toEqual(
      [
        'confidenceLevel',
        'imageBytes',
        'mimeType',
        'needsConfirmation',
        'processingMs',
        'requestId',
        'route',
        'status',
      ].sort(),
    );
  });

  it('never returns base64 or the raw bytes in the response', async () => {
    const response = await handleRequest(uploadRequest(), env(), {
      provider: FakeRecognitionProvider.scenario('confident'),
    });
    const raw = await response.text();
    expect(raw).not.toContain('base64');
    expect(raw).not.toMatch(/[A-Za-z0-9+/]{200,}={0,2}/);
  });
});
