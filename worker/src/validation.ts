import { SUPPORTED_MIME_TYPES, type Config, type SupportedMimeType } from './config';
import { RecognitionError } from './errors';

export interface ImagePayload {
  bytes: Uint8Array;
  mimeType: SupportedMimeType;
  byteSize: number;
  locale: string;
}

const DEFAULT_LOCALE = 'he-IL';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isSupported(mime: string): mime is SupportedMimeType {
  return (SUPPORTED_MIME_TYPES as readonly string[]).includes(mime);
}

/** Prefers the caller's id when it is a real UUID, so logs can be correlated. */
export function resolveRequestId(request: Request, form?: FormData): string {
  const candidates = [request.headers.get('X-Request-ID'), form?.get('requestId')];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && UUID_RE.test(candidate)) return candidate;
  }
  return crypto.randomUUID();
}

/**
 * Extracts and validates the uploaded image. Size is checked against
 * Content-Length first and against the part itself second — both before any
 * base64 encoding and before the provider is contacted.
 */
export async function extractImage(request: Request, config: Config): Promise<ImagePayload> {
  const contentType = request.headers.get('Content-Type') ?? '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    throw new RecognitionError('INVALID_REQUEST', 'content-type');
  }

  const declaredLength = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declaredLength) && declaredLength > config.maxImageBytes) {
    throw new RecognitionError('PAYLOAD_TOO_LARGE', 'content-length');
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new RecognitionError('INVALID_REQUEST', 'malformed-multipart');
  }

  const field = form.get('image');
  if (!field || typeof field === 'string') throw new RecognitionError('MISSING_IMAGE');

  const file = field as File;
  const mimeType = (file.type || '').toLowerCase().split(';')[0].trim();
  if (!isSupported(mimeType)) throw new RecognitionError('UNSUPPORTED_MEDIA_TYPE', mimeType);
  if (file.size === 0) throw new RecognitionError('INVALID_REQUEST', 'empty-image');
  if (file.size > config.maxImageBytes) throw new RecognitionError('PAYLOAD_TOO_LARGE', 'part-size');

  const bytes = new Uint8Array(await file.arrayBuffer());
  // The declared size can lie; the decoded length is what actually gets sent on.
  if (bytes.byteLength > config.maxImageBytes) {
    throw new RecognitionError('PAYLOAD_TOO_LARGE', 'decoded-size');
  }

  const rawLocale = form.get('locale');
  return {
    bytes,
    mimeType,
    byteSize: bytes.byteLength,
    locale: typeof rawLocale === 'string' && rawLocale.trim() ? rawLocale.trim() : DEFAULT_LOCALE,
  };
}

/** Chunked to keep a 2MB image from blowing the argument limit of String.fromCharCode. */
export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
