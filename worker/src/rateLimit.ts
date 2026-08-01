import type { Config, Env } from './config';

export interface UsageDecision {
  allowed: boolean;
  code?: 'RATE_LIMITED' | 'DAILY_LIMIT_REACHED';
}

export interface UsageLimiter {
  check(request: Request): Promise<UsageDecision>;
}

const ALLOWED: UsageDecision = { allowed: true };

/** Used when no binding is configured — the endpoint still works, unthrottled. */
export class AllowAllLimiter implements UsageLimiter {
  async check(): Promise<UsageDecision> {
    return ALLOWED;
  }
}

/** IPs are never stored in the clear; only a truncated digest keys the counter. */
export async function hashClientKey(request: Request): Promise<string> {
  const ip = request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For') ?? 'unknown';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  return [...new Uint8Array(digest)]
    .slice(0, 12)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function utcDateKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/**
 * Two independent brakes: Cloudflare's rate-limiting binding for bursts, and a
 * KV counter for the daily cap. Either binding may be absent — the limiter then
 * simply skips that layer rather than failing the request.
 */
export class BindingUsageLimiter implements UsageLimiter {
  constructor(
    private readonly env: Env,
    private readonly config: Config,
    private readonly now: () => number = Date.now,
  ) {}

  async check(request: Request): Promise<UsageDecision> {
    const key = await hashClientKey(request);

    if (this.env.RATE_LIMITER) {
      const { success } = await this.env.RATE_LIMITER.limit({ key });
      if (!success) return { allowed: false, code: 'RATE_LIMITED' };
    }

    const usage = this.env.RECOGNITION_USAGE;
    if (!usage) return ALLOWED;

    const counterKey = `${utcDateKey(this.now())}:${key}`;
    const used = Number((await usage.get(counterKey)) ?? 0);
    if (Number.isFinite(used) && used >= this.config.dailyRequestLimit) {
      return { allowed: false, code: 'DAILY_LIMIT_REACHED' };
    }

    const next = (Number.isFinite(used) ? used : 0) + 1;
    // Two days of TTL so a counter written just before midnight still expires.
    await usage.put(counterKey, String(next), { expirationTtl: 60 * 60 * 48 });
    return ALLOWED;
  }
}

export function createLimiter(env: Env, config: Config): UsageLimiter {
  return env.RATE_LIMITER || env.RECOGNITION_USAGE
    ? new BindingUsageLimiter(env, config)
    : new AllowAllLimiter();
}
