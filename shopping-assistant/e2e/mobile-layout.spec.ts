import { expect, test } from '@playwright/test';

/**
 * Mobile layout regression suite.
 *
 * The document must never scroll sideways. A wide element (the comparison
 * table) is allowed to scroll inside its own container, but it may never widen
 * the document itself — that is the defect class this suite exists to catch.
 */

const ROUTES = [
  { hash: '/', name: 'Dashboard' },
  { hash: '/search', name: 'Search' },
  { hash: '/suppliers', name: 'Suppliers' },
  { hash: '/watchlist', name: 'Watchlist' },
  { hash: '/alerts', name: 'Alerts' },
  { hash: '/activity', name: 'Activity' },
  { hash: '/settings', name: 'Settings' },
] as const;

const VIEWPORTS = [
  { name: 'portrait', width: 390, height: 844 },
  { name: 'landscape', width: 844, height: 390 },
] as const;

async function measure(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    // Anything sticking out past the viewport, for a useful failure message.
    const offenders: string[] = [];
    const limit = doc.clientWidth + 1; // 1px tolerance for sub-pixel rounding
    document.querySelectorAll<HTMLElement>('body *').forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && (rect.right > limit || rect.left < -1)) {
        const cls = typeof el.className === 'string' ? el.className.slice(0, 60) : '';
        offenders.push(`${el.tagName.toLowerCase()}.${cls} right=${Math.round(rect.right)}`);
      }
    });
    return {
      docScrollWidth: doc.scrollWidth,
      docClientWidth: doc.clientWidth,
      bodyScrollWidth: body.scrollWidth,
      bodyClientWidth: body.clientWidth,
      offenders: offenders.slice(0, 5),
    };
  });
}

for (const viewport of VIEWPORTS) {
  for (const route of ROUTES) {
    test(`${route.name} @ ${viewport.name} ${viewport.width}x${viewport.height} — no horizontal document scroll`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`/#${route.hash}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);

      const m = await measure(page);
      const context =
        `${route.name} @ ${viewport.name} (${viewport.width}x${viewport.height}) — ` +
        `documentElement scrollWidth=${m.docScrollWidth} clientWidth=${m.docClientWidth}, ` +
        `body scrollWidth=${m.bodyScrollWidth} clientWidth=${m.bodyClientWidth}` +
        (m.offenders.length ? ` | overflowing: ${m.offenders.join(' ; ')}` : '');

      expect(m.docScrollWidth, context).toBeLessThanOrEqual(m.docClientWidth);
      expect(m.bodyScrollWidth, context).toBeLessThanOrEqual(m.bodyClientWidth);
    });
  }
}

test('search results: the wide table scrolls inside its own container, not the document', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/search?q=אוזניות Sony WH-1000XM5', { waitUntil: 'networkidle' });
  await page.waitForSelector('table', { timeout: 15_000 });

  const inner = await page.evaluate(() => {
    const table = document.querySelector('table')!;
    const scroller = table.closest<HTMLElement>('[class*="overflow-x-auto"]')!;
    return {
      hasScroller: !!scroller,
      scrollerOverflows: scroller.scrollWidth > scroller.clientWidth,
      docOverflows: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });

  expect(inner.hasScroller).toBe(true);
  expect(inner.scrollerOverflows, 'the table is expected to be wider than the phone').toBe(true);
  expect(inner.docOverflows, 'but it must not widen the document').toBe(false);
});

test('long page scrolls to the bottom and the sticky header stays reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/', { waitUntil: 'networkidle' });

  const before = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300);

  const after = await page.evaluate(() => ({
    scrollY: window.scrollY,
    headerTop: document.querySelector('header')!.getBoundingClientRect().top,
  }));

  expect(after.scrollY).toBeGreaterThan(before);
  // sticky top-0 sits below the safe-area inset, which is 0 in Chromium
  expect(after.headerTop).toBeLessThanOrEqual(1);
});

test('sidebar opens and closes without locking the page scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/', { waitUntil: 'networkidle' });

  await page.click('button[aria-label="פתיחת תפריט"]');
  await page.waitForTimeout(400);
  await page.click('button[aria-label="סגירת תפריט"]');
  await page.waitForTimeout(400);

  const state = await page.evaluate(() => ({
    bodyOverflow: getComputedStyle(document.body).overflow,
    htmlOverflow: getComputedStyle(document.documentElement).overflow,
    canScroll: document.documentElement.scrollHeight > document.documentElement.clientHeight,
  }));

  expect(state.bodyOverflow).not.toBe('hidden');
  expect(state.htmlOverflow).not.toBe('hidden');
  expect(state.canScroll).toBe(true);
});
