import { resolvePwaUrls } from './paths';

/**
 * Registers the Shopping service worker, and nothing else.
 *
 * It never unregisters, claims, or otherwise interferes with the mind-space
 * worker that owns the parent scope — see PWA_AUDIT.md.
 */

export interface RegisterOptions {
  /** Injected so the whole thing is testable without a real browser. */
  container?: ServiceWorkerContainer;
  baseUrl?: string;
  pageHref?: string;
  isProduction?: boolean;
}

export async function registerServiceWorker(options: RegisterOptions = {}): Promise<
  ServiceWorkerRegistration | null
> {
  const {
    container = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined,
    baseUrl = import.meta.env.BASE_URL,
    pageHref = typeof window !== 'undefined' ? window.location.href : '',
    isProduction = import.meta.env.PROD,
  } = options;

  // In dev the worker would serve stale bundles over Vite's HMR.
  if (!isProduction) return null;
  if (!container || !pageHref) return null;

  const { swUrl, scope } = resolvePwaUrls(baseUrl, pageHref);

  try {
    // The explicit scope is the point of this whole module: without it the
    // registration would default to the script's directory, which happens to
    // be right — but relying on that is exactly how a worker ends up owning
    // more of the origin than it should.
    return await container.register(swUrl, { scope });
  } catch {
    // A PWA that cannot register is still a working web app. Never let this
    // take the page down, and never log noise in production.
    return null;
  }
}
