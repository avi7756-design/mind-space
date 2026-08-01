import { expect, test } from '@playwright/test';

/**
 * PWA suite.
 *
 * Runs against the ordinary preview server (base `/`). The equivalent checks
 * under the real deployment path `/mind-space/shopping/` are covered by
 * `scripts/verify-base-path.mjs`, which serves the build from that sub-path —
 * `start_url` and the worker scope are exactly the things a root-served test
 * cannot prove.
 */

test.describe('manifest', () => {
  test('is linked and served', async ({ page }) => {
    await page.goto('/#/', { waitUntil: 'networkidle' });

    const href = await page.getAttribute('link[rel="manifest"]', 'href');
    expect(href).toBe('./manifest.webmanifest');

    const response = await page.request.get('/manifest.webmanifest');
    expect(response.ok()).toBe(true);
  });

  test('declares a standalone RTL Hebrew app', async ({ page }) => {
    const manifest = await (await page.request.get('/manifest.webmanifest')).json();

    expect(manifest.display).toBe('standalone');
    expect(manifest.dir).toBe('rtl');
    expect(manifest.lang).toBe('he');
    expect(manifest.id).toBeTruthy();
    expect(manifest.description).toBeTruthy();
    expect(Array.isArray(manifest.categories)).toBe(true);
  });

  test('keeps start_url and scope relative, so they follow the deployment path', async ({
    page,
  }) => {
    const manifest = await (await page.request.get('/manifest.webmanifest')).json();

    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');

    // An absolute path or host here would break the moment the app moves under
    // /mind-space/shopping/.
    const serialised = JSON.stringify(manifest);
    expect(serialised).not.toContain('http');
    expect(serialised).not.toContain('"/');
  });

  test('ships the required icon set, including a maskable one', async ({ page }) => {
    const manifest = await (await page.request.get('/manifest.webmanifest')).json();
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);

    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect(
      manifest.icons.some((i: { purpose?: string }) => i.purpose?.includes('maskable')),
    ).toBe(true);

    for (const icon of manifest.icons as Array<{ src: string }>) {
      const res = await page.request.get(icon.src.replace('./', '/'));
      expect(res.ok(), `${icon.src} must be served`).toBe(true);
    }
  });

  test('the apple touch icon is linked and served', async ({ page }) => {
    await page.goto('/#/', { waitUntil: 'networkidle' });

    const href = await page.getAttribute('link[rel="apple-touch-icon"]', 'href');
    expect(href).toBe('./icons/apple-touch-icon.png');
    expect((await page.request.get('/icons/apple-touch-icon.png')).ok()).toBe(true);
  });
});

test.describe('service worker file', () => {
  test('is served from the app root', async ({ page }) => {
    const res = await page.request.get('/sw.js');

    expect(res.ok()).toBe(true);
    expect(res.headers()['content-type']).toContain('javascript');
  });

  test('registers and takes a scope limited to this app', async ({ page }) => {
    await page.goto('/#/', { waitUntil: 'networkidle' });

    const registration = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return null;
      return { scope: reg.scope, script: reg.active?.scriptURL ?? reg.installing?.scriptURL };
    });

    // The preview build is a production build, so registration is expected.
    expect(registration, 'the worker should have registered').not.toBeNull();
    expect(registration!.scope).toBe(new URL('/', page.url()).href);
    expect(registration!.script).toContain('/sw.js');
  });
});

test.describe('theme colour follows the stored theme', () => {
  test('light mode uses the light surface colour', async ({ page }) => {
    await page.goto('/#/', { waitUntil: 'networkidle' });

    const content = await page.getAttribute('meta[name="theme-color"]', 'content');
    expect(content).toBe('#f1f5f9');
  });

  test('switching to dark rewrites the tag', async ({ page }) => {
    await page.goto('/#/', { waitUntil: 'networkidle' });
    await page.click('button[title="מצב כהה"]');
    await page.waitForTimeout(400);

    const content = await page.getAttribute('meta[name="theme-color"]', 'content');
    expect(content).toBe('#020617');
  });

  test('exactly one theme-color tag exists after switching back and forth', async ({ page }) => {
    await page.goto('/#/', { waitUntil: 'networkidle' });
    await page.click('button[title="מצב כהה"]');
    await page.waitForTimeout(300);
    await page.click('button[title="מצב בהיר"]');
    await page.waitForTimeout(300);

    const count = await page.locator('meta[name="theme-color"]').count();
    expect(count).toBe(1);
    expect(await page.getAttribute('meta[name="theme-color"]', 'content')).toBe('#f1f5f9');
  });
});

test.describe('iOS meta tags', () => {
  test('declare a web-app-capable, translucent-status-bar app', async ({ page }) => {
    await page.goto('/#/', { waitUntil: 'networkidle' });

    expect(await page.getAttribute('meta[name="apple-mobile-web-app-capable"]', 'content')).toBe(
      'yes',
    );
    expect(
      await page.getAttribute('meta[name="apple-mobile-web-app-status-bar-style"]', 'content'),
    ).toBe('black-translucent');
  });
});

test.describe('install affordance', () => {
  test('no install button appears without a browser offer', async ({ page }) => {
    // Chromium in this harness does not fire beforeinstallprompt, and no
    // pop-up may appear in its absence.
    await page.goto('/#/settings', { waitUntil: 'networkidle' });

    await expect(page.getByTestId('install-button')).toHaveCount(0);
  });

  test('the button appears once the browser offers installation', async ({ page }) => {
    await page.goto('/#/settings', { waitUntil: 'networkidle' });

    await page.evaluate(() => {
      const event = new Event('beforeinstallprompt') as Event & {
        prompt?: () => Promise<void>;
        userChoice?: Promise<{ outcome: string }>;
      };
      event.prompt = () => Promise.resolve();
      event.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(event);
    });
    await page.waitForTimeout(300);

    const button = page.getByTestId('install-button');
    await expect(button).toBeVisible();
    await expect(button).toContainText('התקנת האפליקציה');
  });

  test('the button disappears once the app reports itself installed', async ({ page }) => {
    await page.goto('/#/settings', { waitUntil: 'networkidle' });

    await page.evaluate(() => {
      const event = new Event('beforeinstallprompt') as Event & { prompt?: () => Promise<void> };
      event.prompt = () => Promise.resolve();
      window.dispatchEvent(event);
    });
    await page.waitForTimeout(200);
    await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
    await page.waitForTimeout(300);

    await expect(page.getByTestId('install-button')).toHaveCount(0);
    await expect(page.getByTestId('install-status-installed')).toBeVisible();
  });

  test('the install control is a real button and meets the touch minimum', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/settings', { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      const event = new Event('beforeinstallprompt') as Event & { prompt?: () => Promise<void> };
      event.prompt = () => Promise.resolve();
      window.dispatchEvent(event);
    });
    await page.waitForTimeout(300);

    const button = page.getByTestId('install-button');
    expect(await button.evaluate((el) => el.tagName)).toBe('BUTTON');

    const box = (await button.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe('offline', () => {
  // The worker has to install and claim before the network can be cut, and the
  // page pulls a webfont from a host this harness cannot reach — so
  // `networkidle` never settles here. Every wait below is `domcontentloaded`
  // plus an explicit budget.
  test.setTimeout(90_000);

  /** Loads twice so the worker is installed AND controlling before going dark. */
  async function primeServiceWorker(page: import('@playwright/test').Page, route: string) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
      timeout: 20_000,
    }).catch(async () => {
      // First load is normally uncontrolled; a reload hands over control.
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
        timeout: 20_000,
      });
    });
    await page.waitForTimeout(500);
  }

  test('the app shell still opens after the network drops', async ({ page, context }) => {
    await primeServiceWorker(page, '/#/');

    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });

    // The Shopping shell — not the mind-space one.
    await expect(page.locator('text=עוזר הקניות החכם').first()).toBeVisible({ timeout: 20_000 });
    expect(await page.title()).toContain('עוזר הקניות');
    await context.setOffline(false);
  });

  test('watchlist data survives offline, since it lives in localStorage', async ({
    page,
    context,
  }) => {
    await primeServiceWorker(page, '/#/watchlist');

    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page.locator('text=טלוויזיה LG OLED C3').first()).toBeVisible({ timeout: 20_000 });
    await context.setOffline(false);
  });
});
