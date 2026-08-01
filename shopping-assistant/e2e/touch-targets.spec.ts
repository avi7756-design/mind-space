import { expect, test, type Page } from '@playwright/test';

/**
 * Touch-target regression suite.
 *
 * Apple asks for 44x44 CSS px, Material for 48dp. 44 is the binding minimum
 * here and it is NOT negotiable downwards — if this suite goes red the fix is
 * the control, never the threshold.
 */

const MIN_TARGET = 44;

const ROUTES = [
  { hash: '/', name: 'Dashboard' },
  { hash: '/search', name: 'Search' },
  { hash: '/suppliers', name: 'Suppliers' },
  { hash: '/watchlist', name: 'Watchlist' },
  { hash: '/alerts', name: 'Alerts' },
  { hash: '/activity', name: 'Activity' },
  { hash: '/settings', name: 'Settings' },
] as const;

/**
 * Explicit, reasoned exemptions. Empty on purpose — every control currently
 * meets the minimum. Anything added here must carry a justification, and a
 * blanket "links inside prose" rule is not one.
 */
const EXEMPT_SELECTORS: Array<{ selector: string; reason: string }> = [];

interface Offender {
  tag: string;
  label: string;
  width: number;
  height: number;
}

async function findSmallTargets(page: Page, exempt: string[]): Promise<Offender[]> {
  return page.evaluate(
    ({ min, exemptSelectors }) => {
      const selector = 'button, [role="button"], a.btn-primary, a.btn-ghost, nav.bottom-nav a';
      const results: Offender[] = [];

      document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
        if (exemptSelectors.some((s) => el.matches(s))) return;

        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return;

        const rect = el.getBoundingClientRect();
        // Zero-sized elements are not rendered at all; nothing to tap.
        if (rect.width === 0 && rect.height === 0) return;

        if (rect.width < min || rect.height < min) {
          results.push({
            tag: el.tagName.toLowerCase(),
            label:
              el.getAttribute('aria-label') ??
              el.getAttribute('title') ??
              (el.textContent ?? '').trim().slice(0, 40),
            width: Math.round(rect.width * 10) / 10,
            height: Math.round(rect.height * 10) / 10,
          });
        }
      });

      return results;
    },
    { min: MIN_TARGET, exemptSelectors: exempt },
  );
}

const describeOffenders = (offenders: Offender[]) =>
  offenders.map((o) => `${o.tag}[${o.label}] ${o.width}x${o.height}`).join(' ; ');

test.describe('touch targets — portrait 390x844', () => {
  for (const route of ROUTES) {
    test(`${route.name}: every control is at least ${MIN_TARGET}x${MIN_TARGET}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/#${route.hash}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);

      const offenders = await findSmallTargets(
        page,
        EXEMPT_SELECTORS.map((e) => e.selector),
      );

      expect(
        offenders,
        `${route.name} @ 390x844 — undersized: ${describeOffenders(offenders)}`,
      ).toEqual([]);
    });
  }
});

test.describe('touch targets — landscape 844x390', () => {
  for (const route of ['/', '/search', '/watchlist'] as const) {
    test(`${route}: controls stay tappable in landscape`, async ({ page }) => {
      await page.setViewportSize({ width: 844, height: 390 });
      await page.goto(`/#${route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);

      const offenders = await findSmallTargets(
        page,
        EXEMPT_SELECTORS.map((e) => e.selector),
      );

      expect(
        offenders,
        `${route} @ 844x390 — undersized: ${describeOffenders(offenders)}`,
      ).toEqual([]);
    });
  }
});

test('search results: the row action buttons are tappable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/search?q=אוזניות Sony WH-1000XM5', { waitUntil: 'networkidle' });
  await page.waitForSelector('table', { timeout: 15_000 });

  const offenders = await findSmallTargets(page, []);

  expect(offenders, `search results — undersized: ${describeOffenders(offenders)}`).toEqual([]);
});

test('desktop keeps its tighter control rhythm', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/watchlist', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  // The 44px floor is a phone rule; desktop must not be inflated by it.
  const deleteButtonHeight = await page.evaluate(() => {
    const btn = document.querySelector<HTMLElement>('button[aria-label^="הסרת"]');
    return btn ? btn.getBoundingClientRect().height : null;
  });

  expect(deleteButtonHeight).not.toBeNull();
  expect(deleteButtonHeight!).toBeLessThan(MIN_TARGET);
});

test('icon-only controls carry an accessible name', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/watchlist', { waitUntil: 'networkidle' });

  const unnamed = await page.evaluate(() => {
    const results: string[] = [];
    document.querySelectorAll<HTMLElement>('button, a.btn-ghost, a.btn-primary').forEach((el) => {
      const text = (el.textContent ?? '').trim();
      const name = el.getAttribute('aria-label') ?? el.getAttribute('title') ?? '';
      if (!text && !name) results.push(el.outerHTML.slice(0, 80));
    });
    return results;
  });

  expect(unnamed, `controls without an accessible name: ${unnamed.join(' ; ')}`).toEqual([]);
});

test('no clickable div stands in for a button', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const route of ROUTES) {
    await page.goto(`/#${route.hash}`, { waitUntil: 'networkidle' });
    const bad = await page.evaluate(() =>
      [...document.querySelectorAll('div[onclick], span[onclick]')].length,
    );
    expect(bad, `${route.name} has a clickable div/span`).toBe(0);
  }
});
