/*
 * Serves the production build from the REAL deployment path and verifies the
 * PWA wiring there.
 *
 *     http://localhost:4180/mind-space/shopping/
 *
 * A root-served preview cannot prove any of this: the manifest's `start_url`,
 * the worker's registered scope and its derived base path all only become
 * wrong once the app moves under a sub-path. That is exactly the class of bug
 * that would first appear on GitHub Pages and nowhere else.
 *
 * This is still a LOCAL simulation. It is not a GitHub Pages deployment and is
 * never reported as one.
 *
 *     node scripts/verify-base-path.mjs
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright-core';

const PORT = 4180;
const BASE_PATH = '/mind-space/shopping/';
const DIST = new URL('../dist/', import.meta.url).pathname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (!url.pathname.startsWith(BASE_PATH)) {
    res.writeHead(404).end('outside base path');
    return;
  }

  let rel = url.pathname.slice(BASE_PATH.length) || 'index.html';
  if (rel.endsWith('/')) rel += 'index.html';

  const file = join(DIST, normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

await new Promise((resolve) => server.listen(PORT, resolve));

const ORIGIN = `http://localhost:${PORT}`;
const APP_URL = `${ORIGIN}${BASE_PATH}`;
const checks = [];
const check = (name, pass, detail = '') => {
  checks.push({ name, pass, detail });
  console.log(`${pass ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch();
const context = await browser.newContext({ locale: 'he-IL' });
const page = await context.newPage();

try {
  await page.goto(APP_URL, { waitUntil: 'networkidle' });

  const manifestRes = await page.request.get(`${APP_URL}manifest.webmanifest`);
  check('manifest is served under the base path', manifestRes.ok());

  const manifest = await manifestRes.json();
  const startUrl = new URL(manifest.start_url, APP_URL).pathname;
  const scopeUrl = new URL(manifest.scope, APP_URL).pathname;
  check('manifest start_url resolves inside the app', startUrl === BASE_PATH, startUrl);
  check('manifest scope resolves inside the app', scopeUrl === BASE_PATH, scopeUrl);

  for (const icon of manifest.icons) {
    const res = await page.request.get(new URL(icon.src, APP_URL).href);
    check(`icon ${icon.sizes} ${icon.purpose ?? 'any'} is served`, res.ok());
  }

  const swRes = await page.request.get(`${APP_URL}sw.js`);
  check('sw.js is served under the base path', swRes.ok());

  // Give the worker time to install and activate.
  await page.waitForTimeout(2500);

  const registrations = await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    return regs.map((r) => ({
      scope: r.scope,
      script: r.active?.scriptURL ?? r.installing?.scriptURL ?? r.waiting?.scriptURL ?? null,
    }));
  });

  console.log('\n  registrations:', JSON.stringify(registrations, null, 2), '\n');

  const ours = registrations.find((r) => r.scope === `${ORIGIN}${BASE_PATH}`);
  check('a registration exists with the Shopping scope', Boolean(ours), ours?.scope ?? 'none');
  check(
    'its script lives under the Shopping path',
    Boolean(ours?.script?.endsWith(`${BASE_PATH}sw.js`)),
    ours?.script ?? 'none',
  );
  check(
    'no registration claims the parent /mind-space/ scope',
    !registrations.some((r) => new URL(r.scope).pathname === '/mind-space/'),
  );

  const controller = await page.evaluate(
    () => navigator.serviceWorker.controller?.scriptURL ?? null,
  );
  // The first load is uncontrolled until the worker claims it; reload to be sure.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const controllerAfter = await page.evaluate(
    () => navigator.serviceWorker.controller?.scriptURL ?? null,
  );
  check(
    'the page is controlled by the Shopping worker',
    Boolean(controllerAfter?.endsWith(`${BASE_PATH}sw.js`)),
    controllerAfter ?? `none (first load: ${controller ?? 'none'})`,
  );

  const cacheNames = await page.evaluate(() => caches.keys());
  check(
    'every cache created carries the Shopping prefix',
    cacheNames.every((n) => n.startsWith('shopping-assistant-')),
    cacheNames.join(', ') || 'none',
  );

  // Deep-link refresh: the hash route must survive a full reload.
  await page.goto(`${APP_URL}#/watchlist`, { waitUntil: 'networkidle' });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  check(
    'refreshing a deep hash route still renders the app',
    await page.locator('text=מעקב מחירים').first().isVisible(),
  );

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const offlineTitle = await page.title();
  const offlineHtml = await page.content();
  check('offline reload serves the Shopping shell', offlineTitle.includes('עוזר הקניות'), offlineTitle);
  check(
    'offline reload does NOT serve the mind-space shell',
    !offlineHtml.includes('מרחב התת-מודע'),
  );
  await context.setOffline(false);
} finally {
  await browser.close();
  server.close();
}

const failed = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
if (failed.length) {
  console.error('FAILED:', failed.map((f) => f.name).join(' | '));
  process.exit(1);
}
