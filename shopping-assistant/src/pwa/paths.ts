/**
 * Deployment-agnostic URL resolution for the PWA.
 *
 * The app is served from `/` locally and from `/mind-space/shopping/` on
 * GitHub Pages. Nothing here may hardcode either — every path is derived from
 * Vite's `BASE_URL` resolved against the page that is running.
 *
 * Kept as pure functions so the scope logic can be unit-tested without a
 * browser, a service worker, or a deployment.
 */

export interface PwaUrls {
  /** Absolute URL of the service worker script. */
  swUrl: string;
  /** Absolute URL of the scope it must be limited to. */
  scope: string;
}

export function resolvePwaUrls(baseUrl: string, pageHref: string): PwaUrls {
  // `new URL('./', ...)` normalises `./`, `/shopping/` and `/mind-space/shopping/`
  // alike, and always yields a directory URL ending in `/`.
  const scopeUrl = new URL(baseUrl, pageHref);
  if (!scopeUrl.pathname.endsWith('/')) {
    scopeUrl.pathname = `${scopeUrl.pathname}/`;
  }
  return {
    swUrl: new URL('sw.js', scopeUrl).href,
    scope: scopeUrl.href,
  };
}

/** True when `url` sits inside `scope` — the containment rule the worker uses. */
export function isWithinScope(url: string, scope: string): boolean {
  const target = new URL(url);
  const root = new URL(scope);
  return target.origin === root.origin && target.pathname.startsWith(root.pathname);
}
