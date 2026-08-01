/**
 * Runtime configuration. Only ANTHROPIC_API_KEY is a secret and it is set with
 * `wrangler secret put` — never in wrangler.toml, .dev.vars.example or source.
 */
export interface Env {
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  ALLOWED_ORIGINS?: string;
  MIN_CONFIDENCE?: string;
  DAILY_REQUEST_LIMIT?: string;
  MAX_IMAGE_BYTES?: string;
  PROVIDER_TIMEOUT_MS?: string;
  /** Optional KV namespace for the daily cap. Absent → the cap is skipped. */
  RECOGNITION_USAGE?: KVNamespace;
  /** Optional Cloudflare rate-limiting binding. Absent → no per-minute limit. */
  RATE_LIMITER?: RateLimitBinding;
}

export interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Config {
  model: string;
  allowedOrigins: string[];
  minConfidence: number;
  dailyRequestLimit: number;
  maxImageBytes: number;
  providerTimeoutMs: number;
}

export const DEFAULT_MODEL = 'claude-sonnet-5';
export const DEFAULT_MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const DEFAULT_MIN_CONFIDENCE = 0.8;
export const DEFAULT_DAILY_LIMIT = 200;
export const DEFAULT_TIMEOUT_MS = 25_000;

export const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number];

function positiveNumber(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function readConfig(env: Env): Config {
  const minConfidence = Number(env.MIN_CONFIDENCE);
  return {
    model: env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL,
    allowedOrigins: (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    minConfidence:
      Number.isFinite(minConfidence) && minConfidence >= 0 && minConfidence <= 1
        ? minConfidence
        : DEFAULT_MIN_CONFIDENCE,
    dailyRequestLimit: positiveNumber(env.DAILY_REQUEST_LIMIT, DEFAULT_DAILY_LIMIT),
    maxImageBytes: positiveNumber(env.MAX_IMAGE_BYTES, DEFAULT_MAX_IMAGE_BYTES),
    providerTimeoutMs: positiveNumber(env.PROVIDER_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
  };
}
