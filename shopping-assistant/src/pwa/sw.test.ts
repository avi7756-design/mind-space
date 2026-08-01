import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Static analysis of public/sw.js.
 *
 * The worker cannot be imported into this environment, but its dangerous
 * properties are all textual: which caches it deletes, which requests it
 * answers, and what it falls back to. Those are exactly what a review would
 * check, so they are asserted here instead of being trusted.
 */

const SOURCE = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');

/**
 * Comments stripped. The negative assertions below ("must NOT contain") have to
 * run against real code — the file documents the very pitfalls it avoids, and
 * naming them in a comment must not read as committing them.
 */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');

describe('service worker — cache isolation', () => {
  it('uses a Shopping-specific cache prefix', () => {
    expect(SOURCE).toContain("CACHE_PREFIX = 'shopping-assistant-'");
  });

  it('deletes only caches carrying that prefix', () => {
    expect(SOURCE).toMatch(/startsWith\(CACHE_PREFIX\)\s*&&\s*name !== CACHE_NAME/);
  });

  it('never deletes a cache without checking the prefix first', () => {
    // The mind-space worker does exactly this, and it is why it wipes ours.
    const deletions = CODE.match(/caches\.delete\([^)]*\)/g) ?? [];
    expect(deletions.length).toBeGreaterThan(0);

    const guardedBlock = CODE.slice(CODE.indexOf('activate'), CODE.indexOf('navigationStrategy'));
    expect(guardedBlock).toContain('startsWith(CACHE_PREFIX)');
  });

  it('does not reference the mind-space cache at all', () => {
    expect(CODE).not.toContain('mindspace');
  });
});

describe('service worker — request boundaries', () => {
  it('handles GET only', () => {
    expect(SOURCE).toMatch(/request\.method !== 'GET'/);
  });

  it('checks the origin before handling anything', () => {
    expect(SOURCE).toContain('url.origin === self.location.origin');
  });

  it('checks the path is inside this app', () => {
    expect(SOURCE).toContain('url.pathname.startsWith(BASE_PATH)');
  });

  it('derives its base path from its own location, not a hardcoded URL', () => {
    expect(SOURCE).toContain("new URL('./', self.location.href).pathname");
    expect(CODE).not.toContain('avi7756-design.github.io');
    expect(CODE).not.toContain('/mind-space/');
  });
});

describe('service worker — fallback safety', () => {
  it('falls back to the Shopping shell, scoped to our own cache', () => {
    // `caches.match(...)` without a cache name searches EVERY cache in the
    // origin and would return the mind-space shell.
    expect(SOURCE).toContain("cache.match('./index.html')");
    expect(CODE).not.toMatch(/\bcaches\.match\(/);
  });

  it('serves the navigation fallback only for navigations', () => {
    const assetFn = CODE.slice(CODE.indexOf('async function assetStrategy'));
    expect(assetFn).not.toContain('index.html');
  });

  it('caches assets only when the response is a real same-origin success', () => {
    expect(SOURCE).toMatch(/response\.ok && response\.type === 'basic'/);
  });
});

describe('service worker — no external caching', () => {
  it('precaches the shell only, not supplier or API URLs', () => {
    const shell = CODE.slice(CODE.indexOf('const SHELL'), CODE.indexOf('const isOurs'));

    expect(shell).toContain('./index.html');
    expect(shell).toContain('./manifest.webmanifest');
    expect(shell).not.toContain('http');
  });
});
