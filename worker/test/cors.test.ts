import { describe, expect, it } from 'vitest';
import { handleRequest } from '../src/index';
import { readConfig } from '../src/config';
import { corsHeaders } from '../src/cors';
import { FakeRecognitionProvider } from '../src/providers/FakeRecognitionProvider';
import type { RecognitionErrorBody } from '../src/errors';
import { env, ENDPOINT, FOREIGN_ORIGIN, ORIGIN, uploadRequest } from './helpers';

describe('CORS', () => {
  it('echoes an allowlisted origin exactly and never a wildcard', async () => {
    const response = await handleRequest(uploadRequest(), env(), {
      provider: FakeRecognitionProvider.scenario('confident'),
    });
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(response.headers.get('Access-Control-Allow-Origin')).not.toBe('*');
    expect(response.headers.get('Vary')).toBe('Origin');
  });

  it('gives a foreign origin no CORS headers and a 403', async () => {
    const provider = FakeRecognitionProvider.scenario('confident');
    const response = await handleRequest(uploadRequest({ origin: FOREIGN_ORIGIN }), env(), {
      provider,
    });
    expect(response.status).toBe(403);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(response.headers.get('Vary')).toBe('Origin');
    expect(((await response.json()) as RecognitionErrorBody).error.code).toBe('INVALID_ORIGIN');
    expect(provider.calls).toHaveLength(0);
  });

  it('answers preflight without touching the provider', async () => {
    const provider = FakeRecognitionProvider.scenario('confident');
    const response = await handleRequest(
      new Request(ENDPOINT, {
        method: 'OPTIONS',
        headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST' },
      }),
      env(),
      { provider },
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS');
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('X-Request-ID');
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull();
    expect(provider.calls).toHaveLength(0);
  });

  it('refuses preflight from a foreign origin', async () => {
    const response = await handleRequest(
      new Request(ENDPOINT, { method: 'OPTIONS', headers: { Origin: FOREIGN_ORIGIN } }),
      env(),
    );
    expect(response.status).toBe(403);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('allows a request with no Origin header — that is not a browser cross-site call', async () => {
    const response = await handleRequest(uploadRequest({ origin: null }), env(), {
      provider: FakeRecognitionProvider.scenario('confident'),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('never emits a wildcard for any input', () => {
    const config = readConfig(env());
    for (const origin of [null, ORIGIN, FOREIGN_ORIGIN, '*', 'null']) {
      const headers = corsHeaders(origin, config);
      expect(headers['Access-Control-Allow-Origin']).not.toBe('*');
      expect(headers.Vary).toBe('Origin');
    }
  });
});
