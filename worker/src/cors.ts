import type { Config } from './config';
import { RecognitionError } from './errors';

/**
 * Origin handling is a deterrent, not authentication: a public static site
 * cannot hold a client secret. It stops casual cross-site use of the endpoint,
 * nothing more.
 */

const ALLOWED_METHODS = 'POST, OPTIONS';
const ALLOWED_HEADERS = 'Content-Type, X-Request-ID';
const MAX_AGE = '86400';

export function isAllowedOrigin(origin: string | null, config: Config): boolean {
  return origin !== null && config.allowedOrigins.includes(origin);
}

/**
 * `Vary: Origin` is always present — without it a cache could serve one origin's
 * CORS headers to another. The header is never a wildcard.
 */
export function corsHeaders(origin: string | null, config: Config): Record<string, string> {
  const headers: Record<string, string> = { Vary: 'Origin' };
  if (isAllowedOrigin(origin, config)) {
    headers['Access-Control-Allow-Origin'] = origin as string;
    headers['Access-Control-Allow-Methods'] = ALLOWED_METHODS;
    headers['Access-Control-Allow-Headers'] = ALLOWED_HEADERS;
    headers['Access-Control-Max-Age'] = MAX_AGE;
  }
  return headers;
}

/**
 * A request with no Origin header is not a browser cross-site call (curl, a
 * health probe), so it passes without CORS headers. A present-but-unlisted
 * Origin is rejected outright.
 */
export function assertOriginAllowed(request: Request, config: Config): void {
  const origin = request.headers.get('Origin');
  if (origin === null) return;
  if (!isAllowedOrigin(origin, config)) throw new RecognitionError('INVALID_ORIGIN');
}

/** Answers preflight without touching validation, the limiter or the provider. */
export function handlePreflight(request: Request, config: Config): Response {
  const origin = request.headers.get('Origin');
  const headers = corsHeaders(origin, config);
  return new Response(null, {
    status: isAllowedOrigin(origin, config) ? 204 : 403,
    headers,
  });
}
