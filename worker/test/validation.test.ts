import { describe, expect, it, vi } from 'vitest';
import { readConfig, DEFAULT_MAX_IMAGE_BYTES, DEFAULT_MIN_CONFIDENCE, DEFAULT_MODEL } from '../src/config';
import { extractImage, resolveRequestId, toBase64 } from '../src/validation';
import { RecognitionError } from '../src/errors';
import { confidenceLevelFor, normalizeResult } from '../src/schema';
import { BindingUsageLimiter, hashClientKey, utcDateKey } from '../src/rateLimit';
import { env, ENDPOINT, imageFile, ORIGIN } from './helpers';

const config = readConfig(env());

function multipart(file: File, extra: Record<string, string> = {}, headers: Record<string, string> = {}) {
  const form = new FormData();
  form.append('image', file);
  for (const [key, value] of Object.entries(extra)) form.append(key, value);
  return new Request(ENDPOINT, { method: 'POST', headers, body: form });
}

describe('config defaults', () => {
  it('falls back to safe values when nothing is configured', () => {
    const defaults = readConfig({});
    expect(defaults.model).toBe(DEFAULT_MODEL);
    expect(defaults.maxImageBytes).toBe(DEFAULT_MAX_IMAGE_BYTES);
    expect(defaults.minConfidence).toBe(DEFAULT_MIN_CONFIDENCE);
    expect(defaults.allowedOrigins).toEqual([]);
  });

  it('takes the model from configuration rather than code', () => {
    expect(readConfig({ ANTHROPIC_MODEL: 'claude-opus-5' }).model).toBe('claude-opus-5');
  });

  it('ignores nonsense values instead of trusting them', () => {
    const parsed = readConfig({ MAX_IMAGE_BYTES: '-1', MIN_CONFIDENCE: '9' });
    expect(parsed.maxImageBytes).toBe(DEFAULT_MAX_IMAGE_BYTES);
    expect(parsed.minConfidence).toBe(DEFAULT_MIN_CONFIDENCE);
  });
});

describe('extractImage', () => {
  it('returns the bytes, the MIME type and the locale', async () => {
    const payload = await extractImage(multipart(imageFile('image/webp', 64, 'p.webp'), { locale: 'en-US' }), config);
    expect(payload.mimeType).toBe('image/webp');
    expect(payload.byteSize).toBe(64);
    expect(payload.locale).toBe('en-US');
  });

  it('defaults the locale to Hebrew', async () => {
    expect((await extractImage(multipart(imageFile()), config)).locale).toBe('he-IL');
  });

  it('strips parameters from the content type of the part', async () => {
    const payload = await extractImage(multipart(imageFile('image/jpeg; charset=binary')), config);
    expect(payload.mimeType).toBe('image/jpeg');
  });

  it('rejects an oversized Content-Length before reading the body', async () => {
    const request = multipart(imageFile(), {}, { 'Content-Length': String(9 * 1024 * 1024) });
    const formDataSpy = vi.spyOn(request, 'formData');
    await expect(extractImage(request, config)).rejects.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
    expect(formDataSpy).not.toHaveBeenCalled();
  });

  it('rejects a part above the limit', async () => {
    await expect(extractImage(multipart(imageFile('image/jpeg', 3 * 1024 * 1024)), config)).rejects.toBeInstanceOf(
      RecognitionError,
    );
  });
});

describe('resolveRequestId', () => {
  it('adopts a caller-supplied UUID', () => {
    const id = '4f1b2c3d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
    expect(resolveRequestId(new Request(ENDPOINT, { headers: { 'X-Request-ID': id } }))).toBe(id);
  });

  it('generates one when the header is missing or malformed', () => {
    expect(resolveRequestId(new Request(ENDPOINT))).toMatch(/^[0-9a-f-]{36}$/);
    expect(resolveRequestId(new Request(ENDPOINT, { headers: { 'X-Request-ID': 'drop table' } }))).toMatch(
      /^[0-9a-f-]{36}$/,
    );
  });
});

describe('toBase64', () => {
  it('round-trips bytes without corrupting them', () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255, 65, 66]);
    const decoded = Uint8Array.from(atob(toBase64(bytes)), (c) => c.charCodeAt(0));
    expect([...decoded]).toEqual([...bytes]);
  });

  it('handles a payload larger than the chunk size', () => {
    const bytes = new Uint8Array(200_000).fill(200);
    expect(toBase64(bytes).length).toBeGreaterThan(200_000);
  });
});

describe('normalizeResult', () => {
  const base = {
    productName: 'OneBlade',
    brand: 'Philips',
    model: 'QP2724/10',
    category: 'מכונת גילוח',
    visibleText: ['PHILIPS', 'QP2724/10'],
    identifiers: { modelNumber: 'QP2724/10', sku: null, barcode: null },
    searchQuery: 'Philips OneBlade QP2724/10',
    confidence: 0.94,
  };

  it('clamps confidence into 0..1', () => {
    expect(normalizeResult({ ...base, confidence: 5 }, 0.8).confidence).toBe(1);
    expect(normalizeResult({ ...base, confidence: -3 }, 0.8).confidence).toBe(0);
    expect(normalizeResult({ ...base, confidence: 'high' }, 0.8).confidence).toBe(0);
  });

  it('adds MODEL_NUMBER_UNCERTAIN whenever the model is null', () => {
    const result = normalizeResult({ ...base, model: null, warnings: [] }, 0.8);
    expect(result.warnings).toContain('MODEL_NUMBER_UNCERTAIN');
    expect(result.needsConfirmation).toBe(true);
  });

  it('rebuilds the query when the provider left a guessed model in it', () => {
    const result = normalizeResult({ ...base, model: null }, 0.8);
    // The provider still returned "…QP2724/10" — that model was not confirmed.
    expect(result.searchQuery).toBe('Philips OneBlade מכונת גילוח');
    expect(result.searchQuery).not.toContain('QP2724/10');
  });

  it('does not invent a model number', () => {
    const result = normalizeResult({ ...base, model: null, identifiers: { modelNumber: null } }, 0.8);
    expect(result.model).toBeNull();
    expect(result.identifiers.modelNumber).toBeNull();
  });

  it('drops unknown warning codes', () => {
    const result = normalizeResult({ ...base, warnings: ['NOT_A_REAL_CODE', 'IMAGE_BLURRY'] }, 0.8);
    expect(result.warnings).toEqual(['IMAGE_BLURRY']);
  });

  it('flags confirmation below the configured threshold', () => {
    expect(normalizeResult({ ...base, confidence: 0.79 }, 0.8).needsConfirmation).toBe(true);
    expect(normalizeResult({ ...base, confidence: 0.81 }, 0.8).needsConfirmation).toBe(false);
  });

  it('flags confirmation when several products are visible', () => {
    const result = normalizeResult({ ...base, multipleProductsVisible: true }, 0.8);
    expect(result.warnings).toContain('MULTIPLE_PRODUCTS_VISIBLE');
    expect(result.needsConfirmation).toBe(true);
  });

  it('throws LOW_CONFIDENCE when no usable query can be built without guessing', () => {
    expect(() =>
      normalizeResult({ productName: null, brand: null, model: null, searchQuery: '', confidence: 0.2 }, 0.8),
    ).toThrow(RecognitionError);
  });

  it('grades the confidence level relative to the threshold', () => {
    expect(confidenceLevelFor(0.9, 0.8)).toBe('high');
    expect(confidenceLevelFor(0.7, 0.8)).toBe('medium');
    expect(confidenceLevelFor(0.2, 0.8)).toBe('low');
  });
});

describe('usage limiter', () => {
  function kv(initial: Record<string, string> = {}) {
    const store = new Map(Object.entries(initial));
    return {
      store,
      get: async (key: string) => store.get(key) ?? null,
      put: async (key: string, value: string) => void store.set(key, value),
    };
  }

  const request = () =>
    new Request(ENDPOINT, { method: 'POST', headers: { Origin: ORIGIN, 'CF-Connecting-IP': '203.0.113.7' } });

  it('hashes the client IP instead of storing it', async () => {
    const key = await hashClientKey(request());
    expect(key).toMatch(/^[0-9a-f]{24}$/);
    expect(key).not.toContain('203.0.113');
  });

  it('counts a request under the daily key and never stores the raw IP', async () => {
    const usage = kv();
    const limiter = new BindingUsageLimiter(env({ RECOGNITION_USAGE: usage }), config, () => Date.parse('2026-08-01T10:00:00Z'));
    expect(await limiter.check(request())).toEqual({ allowed: true });

    const [storedKey] = [...usage.store.keys()];
    expect(storedKey.startsWith(`${utcDateKey(Date.parse('2026-08-01T10:00:00Z'))}:`)).toBe(true);
    expect(storedKey).not.toContain('203.0.113');
  });

  it('blocks once the daily limit is reached', async () => {
    const now = () => Date.parse('2026-08-01T10:00:00Z');
    const key = await hashClientKey(request());
    const usage = kv({ [`${utcDateKey(now())}:${key}`]: '200' });
    const limiter = new BindingUsageLimiter(env({ RECOGNITION_USAGE: usage }), config, now);
    expect(await limiter.check(request())).toEqual({ allowed: false, code: 'DAILY_LIMIT_REACHED' });
  });

  it('honours the rate-limiting binding before the daily counter', async () => {
    const usage = kv();
    const limiter = new BindingUsageLimiter(
      env({ RECOGNITION_USAGE: usage, RATE_LIMITER: { limit: async () => ({ success: false }) } }),
      config,
    );
    expect(await limiter.check(request())).toEqual({ allowed: false, code: 'RATE_LIMITED' });
    expect(usage.store.size).toBe(0);
  });
});
