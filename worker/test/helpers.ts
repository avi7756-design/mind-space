import type { Env } from '../src/config';
import type { RequestLog } from '../src/logger';

export const ORIGIN = 'https://avi7756-design.github.io';
export const FOREIGN_ORIGIN = 'https://evil.example';
export const ENDPOINT = 'https://recognition.example/v1/recognize';

export function env(overrides: Partial<Env> = {}): Env {
  return {
    ANTHROPIC_API_KEY: 'test-key-not-real',
    ANTHROPIC_MODEL: 'claude-sonnet-4-20250514',
    ALLOWED_ORIGINS: `${ORIGIN},http://localhost:4173`,
    MIN_CONFIDENCE: '0.80',
    MAX_IMAGE_BYTES: String(2 * 1024 * 1024),
    ...overrides,
  };
}

export function imageFile(
  mimeType = 'image/jpeg',
  bytes = 2048,
  name = 'product.jpg',
): File {
  return new File([new Uint8Array(bytes).fill(7)], name, { type: mimeType });
}

export function uploadRequest(
  options: {
    file?: File | null;
    origin?: string | null;
    method?: string;
    locale?: string;
    url?: string;
    headers?: Record<string, string>;
    body?: BodyInit | null;
    contentType?: string;
  } = {},
): Request {
  const headers = new Headers(options.headers ?? {});
  if (options.origin !== null) headers.set('Origin', options.origin ?? ORIGIN);

  let body: BodyInit | null = options.body ?? null;
  if (body === null && options.file !== null) {
    const form = new FormData();
    form.append('image', options.file ?? imageFile());
    if (options.locale) form.append('locale', options.locale);
    body = form;
  }
  if (options.contentType) headers.set('Content-Type', options.contentType);

  return new Request(options.url ?? ENDPOINT, {
    method: options.method ?? 'POST',
    headers,
    body,
  });
}

/** Captures log entries so tests can assert nothing sensitive is written. */
export function recordingLogger() {
  const entries: RequestLog[] = [];
  return { entries, logger: (entry: RequestLog) => entries.push(entry) };
}
