import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { MockCacheStorage, loadServiceWorker } from './swHarness';

/**
 * The root mind-space worker and the Shopping worker share one origin, and
 * therefore one Cache Storage. Each must clean up after itself without
 * touching the other. These tests run the SHIPPED files, not a copy of them.
 */

const ROOT_SW = fileURLToPath(new URL('../../../sw.js', import.meta.url));
const SHOPPING_SW = fileURLToPath(new URL('../../public/sw.js', import.meta.url));

const ROOT_LOCATION = 'https://avi7756-design.github.io/mind-space/sw.js';
const SHOPPING_LOCATION = 'https://avi7756-design.github.io/mind-space/shopping/sw.js';

const MIND_CURRENT = 'mindspace-v12';
const SHOPPING_CURRENT = 'shopping-assistant-v1';

let caches: MockCacheStorage;

beforeEach(() => {
  caches = new MockCacheStorage();
});

// ---------- 1–7. the root worker's cleanup ----------

describe('root service worker — cache cleanup', () => {
  it('deletes a superseded mind-space cache', async () => {
    caches.seed(['mindspace-v11', MIND_CURRENT]);
    const sw = loadServiceWorker(ROOT_SW, caches, ROOT_LOCATION);

    await sw.dispatch('activate');

    expect(caches.names()).not.toContain('mindspace-v11');
  });

  it('keeps its own current cache', async () => {
    caches.seed(['mindspace-v11', MIND_CURRENT]);
    const sw = loadServiceWorker(ROOT_SW, caches, ROOT_LOCATION);

    await sw.dispatch('activate');

    expect(caches.names()).toContain(MIND_CURRENT);
  });

  it('keeps the Shopping cache — this is the bug that blocked the release', async () => {
    caches.seed([MIND_CURRENT, SHOPPING_CURRENT]);
    const sw = loadServiceWorker(ROOT_SW, caches, ROOT_LOCATION);

    await sw.dispatch('activate');

    expect(caches.names()).toContain(SHOPPING_CURRENT);
  });

  it('keeps caches belonging to anything else on the origin', async () => {
    caches.seed([MIND_CURRENT, 'another-app-v3', 'unrelated-cache']);
    const sw = loadServiceWorker(ROOT_SW, caches, ROOT_LOCATION);

    await sw.dispatch('activate');

    expect(caches.names()).toContain('another-app-v3');
    expect(caches.names()).toContain('unrelated-cache');
  });

  it('does not match a name that merely CONTAINS the prefix', async () => {
    // startsWith, not includes — "x-mindspace-v1" is somebody else's cache.
    caches.seed([MIND_CURRENT, 'x-mindspace-v1', 'legacy-mindspace-cache']);
    const sw = loadServiceWorker(ROOT_SW, caches, ROOT_LOCATION);

    await sw.dispatch('activate');

    expect(caches.names()).toContain('x-mindspace-v1');
    expect(caches.names()).toContain('legacy-mindspace-cache');
  });

  it('survives an empty origin', async () => {
    const sw = loadServiceWorker(ROOT_SW, caches, ROOT_LOCATION);

    await expect(sw.dispatch('activate')).resolves.toBeUndefined();
    expect(caches.names()).toEqual([]);
  });

  it('clears every historical version at once', async () => {
    caches.seed([
      'mindspace-v8',
      'mindspace-v9',
      'mindspace-v10',
      'mindspace-v11',
      MIND_CURRENT,
      SHOPPING_CURRENT,
    ]);
    const sw = loadServiceWorker(ROOT_SW, caches, ROOT_LOCATION);

    await sw.dispatch('activate');

    expect(caches.names().sort()).toEqual([MIND_CURRENT, SHOPPING_CURRENT].sort());
  });

  it('matches the behaviour table exactly', async () => {
    caches.seed([
      'mindspace-v10',
      'mindspace-v11',
      'mindspace-v12',
      'shopping-assistant-v1',
      'another-app-v3',
      'unrelated-cache',
    ]);
    const sw = loadServiceWorker(ROOT_SW, caches, ROOT_LOCATION);

    await sw.dispatch('activate');

    expect(caches.names().sort()).toEqual(
      ['another-app-v3', 'mindspace-v12', 'shopping-assistant-v1', 'unrelated-cache'].sort(),
    );
  });
});

// ---------- 8–10. nothing else moved ----------

describe('root service worker — unchanged behaviour', () => {
  const source = () => loadServiceWorker(ROOT_SW, new MockCacheStorage(), ROOT_LOCATION).source;

  it('keeps network-first for navigation', () => {
    expect(source()).toContain('req.mode==="navigate"');
    expect(source()).toMatch(/e\.respondWith\(fetch\(req\)/);
  });

  it('keeps cache-first for static assets', () => {
    expect(source()).toMatch(/e\.respondWith\(caches\.match\(req\)\.then\(r=>r\|\|fetch\(req\)/);
  });

  it('keeps its own HTML fallback', () => {
    expect(source()).toContain('caches.match("./index.html")');
  });

  it('keeps the same cache name — no forced update was needed', () => {
    expect(source()).toContain('const C="mindspace-v12"');
  });

  it('keeps skipWaiting and clientsClaim', async () => {
    const sw = loadServiceWorker(ROOT_SW, caches, ROOT_LOCATION);

    await sw.dispatch('install');
    expect(sw.skipWaitingCalled).toBe(true);

    await sw.dispatch('activate');
    expect(sw.clientsClaimCalled).toBe(true);
  });

  it('still precaches exactly the mind-space shell', async () => {
    const sw = loadServiceWorker(ROOT_SW, caches, ROOT_LOCATION);

    await sw.dispatch('install');

    expect(caches.names()).toEqual([MIND_CURRENT]);
  });

  it('does not register, unregister or manipulate scope', () => {
    // Matched against code with comments stripped: the file explains that
    // cleanup is "scoped by name", and prose must not read as an assignment.
    const code = source()
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|\s)\/\/.*$/gm, '$1');

    expect(code).not.toContain('unregister');
    expect(code).not.toMatch(/\.register\s*\(/);
    expect(code, 'must not read or set a registration scope').not.toMatch(
      /scope\s*[:=]|registration\.scope/,
    );
  });
});

// ---------- the central gate: two workers, one origin ----------

describe('cross-worker isolation on a shared origin', () => {
  it('the root worker activating leaves the Shopping cache intact', async () => {
    caches.seed([MIND_CURRENT, SHOPPING_CURRENT]);

    await loadServiceWorker(ROOT_SW, caches, ROOT_LOCATION).dispatch('activate');

    expect(caches.names()).toContain(SHOPPING_CURRENT);
    expect(caches.names()).toContain(MIND_CURRENT);
  });

  it('the Shopping worker activating leaves the mind-space cache intact', async () => {
    caches.seed([MIND_CURRENT, SHOPPING_CURRENT]);

    await loadServiceWorker(SHOPPING_SW, caches, SHOPPING_LOCATION).dispatch('activate');

    expect(caches.names()).toContain(MIND_CURRENT);
    expect(caches.names()).toContain(SHOPPING_CURRENT);
  });

  it('either order of activation preserves both', async () => {
    caches.seed(['mindspace-v11', MIND_CURRENT, 'shopping-assistant-v0', SHOPPING_CURRENT]);

    await loadServiceWorker(ROOT_SW, caches, ROOT_LOCATION).dispatch('activate');
    await loadServiceWorker(SHOPPING_SW, caches, SHOPPING_LOCATION).dispatch('activate');

    // Each dropped only its own superseded version.
    expect(caches.names().sort()).toEqual([MIND_CURRENT, SHOPPING_CURRENT].sort());
  });

  it('the reverse order gives the same result', async () => {
    caches.seed(['mindspace-v11', MIND_CURRENT, 'shopping-assistant-v0', SHOPPING_CURRENT]);

    await loadServiceWorker(SHOPPING_SW, caches, SHOPPING_LOCATION).dispatch('activate');
    await loadServiceWorker(ROOT_SW, caches, ROOT_LOCATION).dispatch('activate');

    expect(caches.names().sort()).toEqual([MIND_CURRENT, SHOPPING_CURRENT].sort());
  });

  it('repeated activations are idempotent', async () => {
    caches.seed([MIND_CURRENT, SHOPPING_CURRENT]);

    for (let i = 0; i < 3; i++) {
      await loadServiceWorker(ROOT_SW, caches, ROOT_LOCATION).dispatch('activate');
      await loadServiceWorker(SHOPPING_SW, caches, SHOPPING_LOCATION).dispatch('activate');
    }

    expect(caches.names().sort()).toEqual([MIND_CURRENT, SHOPPING_CURRENT].sort());
  });

  it('the two workers use disjoint cache namespaces', async () => {
    const root = loadServiceWorker(ROOT_SW, caches, ROOT_LOCATION);
    const shopping = loadServiceWorker(SHOPPING_SW, caches, SHOPPING_LOCATION);

    await root.dispatch('install');
    await shopping.dispatch('install');

    const names = caches.names();
    expect(names).toHaveLength(2);
    expect(names.filter((n) => n.startsWith('mindspace-'))).toHaveLength(1);
    expect(names.filter((n) => n.startsWith('shopping-assistant-'))).toHaveLength(1);
  });
});
