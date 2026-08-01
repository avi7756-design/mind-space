import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

/**
 * Loads a real service worker file and lets its lifecycle events be fired
 * against a mock `CacheStorage`.
 *
 * The point is to exercise the SHIPPED files rather than a copy of their
 * logic — the bug this guards against (a cleanup sweep that deletes another
 * app's caches) lives in one `filter` expression, and a re-implementation in
 * the test would simply reproduce whatever the author believed it said.
 */

export interface MockCache {
  name: string;
  entries: Map<string, string>;
}

export class MockCacheStorage {
  private store = new Map<string, MockCache>();

  seed(names: string[]): void {
    for (const name of names) this.store.set(name, { name, entries: new Map() });
  }

  keys(): Promise<string[]> {
    return Promise.resolve([...this.store.keys()]);
  }

  delete(name: string): Promise<boolean> {
    return Promise.resolve(this.store.delete(name));
  }

  open(name: string): Promise<{
    addAll: (requests: unknown[]) => Promise<void>;
    put: (request: unknown, response: unknown) => Promise<void>;
    match: (request: unknown) => Promise<undefined>;
  }> {
    if (!this.store.has(name)) this.store.set(name, { name, entries: new Map() });
    const cache = this.store.get(name)!;
    return Promise.resolve({
      addAll: async (requests: unknown[]) => {
        for (const r of requests) cache.entries.set(String(r), 'cached');
      },
      put: async (request: unknown, _response: unknown) => {
        void _response;
        cache.entries.set(String(request), 'cached');
      },
      match: async () => undefined,
    });
  }

  match(): Promise<undefined> {
    return Promise.resolve(undefined);
  }

  names(): string[] {
    return [...this.store.keys()];
  }
}

type Listener = (event: { waitUntil: (p: unknown) => void }) => void;

export interface LoadedWorker {
  /** Fires a lifecycle event and settles everything passed to `waitUntil`. */
  dispatch(type: 'install' | 'activate'): Promise<void>;
  skipWaitingCalled: boolean;
  clientsClaimCalled: boolean;
  /** The worker's raw source, for assertions about what it does not do. */
  source: string;
}

export function loadServiceWorker(
  absolutePath: string,
  caches: MockCacheStorage,
  scriptLocation = 'https://example.com/sw.js',
): LoadedWorker {
  // Strip a UTF-8 BOM: the byte order mark is legal in the file but not in a
  // script body handed to the VM.
  const source = readFileSync(absolutePath, 'utf8').replace(/^﻿/, '');

  const listeners = new Map<string, Listener[]>();
  const state = { skipWaitingCalled: false, clientsClaimCalled: false };

  const self = {
    addEventListener(type: string, fn: Listener) {
      listeners.set(type, [...(listeners.get(type) ?? []), fn]);
    },
    skipWaiting() {
      state.skipWaitingCalled = true;
    },
    clients: {
      claim: async () => {
        state.clientsClaimCalled = true;
      },
    },
    location: { href: scriptLocation },
    registration: { scope: new URL('./', scriptLocation).href },
  };

  const sandbox = {
    self,
    caches,
    // The worker's fetch path is not exercised here; a stub keeps the module
    // from throwing at definition time.
    fetch: async () => ({ ok: false, type: 'basic', clone: () => ({}) }),
    Request: class {
      constructor(
        public url: string,
        public init?: unknown,
      ) {}
      toString() {
        return this.url;
      }
    },
    Response: { error: () => ({ ok: false }) },
    URL,
    console,
  };

  runInContext(source, createContext(sandbox));

  return {
    source,
    get skipWaitingCalled() {
      return state.skipWaitingCalled;
    },
    get clientsClaimCalled() {
      return state.clientsClaimCalled;
    },
    async dispatch(type) {
      const pending: unknown[] = [];
      const event = { waitUntil: (p: unknown) => pending.push(p) };
      for (const fn of listeners.get(type) ?? []) fn(event);
      await Promise.all(pending);
    },
  };
}
