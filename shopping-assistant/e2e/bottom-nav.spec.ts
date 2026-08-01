import { expect, test } from '@playwright/test';

const PHONE = { width: 390, height: 844 };
const PHONE_LANDSCAPE = { width: 844, height: 390 };
const DESKTOP = { width: 1440, height: 900 };

const NAV = 'nav[aria-label="ניווט מהיר"]';

/**
 * The phone breakpoint, stated as a table.
 *
 * The second arm of the CSS query is capped at 900px so that a wide-but-short
 * desktop window is not mistaken for a phone in landscape. These cases pin that
 * cap down from both sides.
 */
const BREAKPOINT_MATRIX = [
  { width: 390, height: 844, visible: true, why: 'phone portrait' },
  { width: 844, height: 390, visible: true, why: 'phone landscape' },
  { width: 900, height: 500, visible: true, why: 'documented inclusive boundary' },
  { width: 901, height: 500, visible: false, why: 'one px past the width cap' },
  { width: 1024, height: 450, visible: false, why: 'small laptop, short window' },
  { width: 1440, height: 450, visible: false, why: 'wide desktop, short window' },
  { width: 1440, height: 900, visible: false, why: 'ordinary desktop' },
] as const;

test.describe('bottom navigation — breakpoint matrix', () => {
  for (const c of BREAKPOINT_MATRIX) {
    test(`${c.width}x${c.height} (${c.why}): ${c.visible ? 'visible' : 'hidden'}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: c.width, height: c.height });
      await page.goto('/#/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      const nav = page.locator(NAV);
      if (c.visible) {
        await expect(nav).toBeVisible();
      } else {
        await expect(nav).toBeHidden();
      }

      // The reserved padding must agree with the bar's own visibility —
      // a hidden bar that still reserves space leaves a dead strip.
      const reserved = await page.evaluate(() =>
        parseFloat(getComputedStyle(document.querySelector('.content-safe-pb')!).paddingBottom),
      );
      if (c.visible) {
        expect(reserved, 'a visible bar must be cleared by the content').toBeGreaterThan(0);
      } else {
        expect(reserved, 'a hidden bar must reserve nothing').toBe(0);
      }
    });
  }
});

test.describe('bottom navigation — visibility', () => {
  test('shows on a phone in portrait', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/#/', { waitUntil: 'networkidle' });

    await expect(page.locator(NAV)).toBeVisible();
  });

  test('shows on a phone in landscape, and stays compact', async ({ page }) => {
    await page.setViewportSize(PHONE_LANDSCAPE);
    await page.goto('/#/', { waitUntil: 'networkidle' });

    const nav = page.locator(NAV);
    await expect(nav).toBeVisible();

    const box = (await nav.boundingBox())!;
    // A height-starved viewport must not give a sixth of itself to the bar.
    expect(box.height).toBeLessThan(PHONE_LANDSCAPE.height * 0.2);
  });

  test('is hidden on desktop, where the sidebar is the primary navigation', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/#/', { waitUntil: 'networkidle' });

    await expect(page.locator(NAV)).toBeHidden();
  });
});

test.describe('bottom navigation — routing and active state', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/#/', { waitUntil: 'networkidle' });
  });

  const DESTINATIONS = [
    { label: 'חיפוש', hash: '#/search' },
    { label: 'מעקב', hash: '#/watchlist' },
    { label: 'התראות', hash: '#/alerts' },
    { label: 'בית', hash: '#/' },
  ] as const;

  for (const dest of DESTINATIONS) {
    test(`"${dest.label}" navigates and becomes the current page`, async ({ page }) => {
      await page.locator(`${NAV} a`, { hasText: dest.label }).click();
      await page.waitForTimeout(400);

      expect(page.url()).toContain(dest.hash);

      const current = page.locator(`${NAV} a[aria-current="page"]`);
      await expect(current).toHaveCount(1);
      await expect(current).toContainText(dest.label);
    });
  }

  test('exactly one destination is marked current at a time', async ({ page }) => {
    await expect(page.locator(`${NAV} a[aria-current="page"]`)).toHaveCount(1);

    await page.locator(`${NAV} a`, { hasText: 'מעקב' }).click();
    await page.waitForTimeout(300);

    await expect(page.locator(`${NAV} a[aria-current="page"]`)).toHaveCount(1);
  });

  test('the active tab is distinguishable by more than colour', async ({ page }) => {
    const activePill = await page.evaluate(() => {
      const link = document.querySelector<HTMLElement>('nav.bottom-nav a[aria-current="page"] span');
      return link ? getComputedStyle(link).backgroundColor : null;
    });
    const inactivePill = await page.evaluate(() => {
      const link = document.querySelector<HTMLElement>(
        'nav.bottom-nav a:not([aria-current="page"]) span',
      );
      return link ? getComputedStyle(link).backgroundColor : null;
    });

    // The active tab carries a filled pill; inactive ones are transparent.
    expect(activePill).not.toBe(inactivePill);
    expect(inactivePill).toBe('rgba(0, 0, 0, 0)');
  });
});

test.describe('bottom navigation — "more" opens the existing sidebar', () => {
  test('opens the sidebar and returns focus on close', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/#/', { waitUntil: 'networkidle' });

    await page.locator(`${NAV} button`, { hasText: 'עוד' }).click();
    await page.waitForTimeout(500);

    // The full route list lives in the sidebar — no second menu system.
    await expect(page.locator('aside a', { hasText: 'ספקים מהימנים' })).toBeVisible();
    await expect(page.locator('aside a', { hasText: 'יומן פעילות' })).toBeVisible();
    await expect(page.locator('aside a', { hasText: 'הגדרות' })).toBeVisible();

    await page.click('button[aria-label="סגירת תפריט"]');
    await page.waitForTimeout(400);

    const focusedLabel = await page.evaluate(() =>
      document.activeElement?.getAttribute('aria-label'),
    );
    expect(focusedLabel).toContain('עוד');
  });
});

test.describe('bottom navigation — layout safety', () => {
  test('does not widen the document', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/#/', { waitUntil: 'networkidle' });

    const m = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));

    expect(m.scroll).toBeLessThanOrEqual(m.client);
  });

  test('the last element of a long page clears the bar', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/#/activity', { waitUntil: 'networkidle' });

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(500);

    const clearance = await page.evaluate(() => {
      const nav = document.querySelector<HTMLElement>('nav.bottom-nav')!;
      const items = document.querySelectorAll<HTMLElement>('main .card > div');
      const last = items[items.length - 1];
      return {
        lastBottom: last.getBoundingClientRect().bottom,
        navTop: nav.getBoundingClientRect().top,
      };
    });

    // The final row must end above the bar, not behind it.
    expect(clearance.lastBottom).toBeLessThanOrEqual(clearance.navTop);
  });

  test('the content column reserves room for the bar', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/#/', { waitUntil: 'networkidle' });

    const reserved = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.querySelector('.content-safe-pb')!).paddingBottom),
    );
    const navHeight = await page.evaluate(
      () => document.querySelector<HTMLElement>('nav.bottom-nav')!.getBoundingClientRect().height,
    );

    expect(reserved).toBeGreaterThanOrEqual(navHeight - 1);
  });

  test('desktop reserves no room, since the bar is hidden there', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/#/', { waitUntil: 'networkidle' });

    const reserved = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.querySelector('.content-safe-pb')!).paddingBottom),
    );

    expect(reserved).toBe(0);
  });

  test('the sidebar overlay covers the bar when open', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/#/', { waitUntil: 'networkidle' });

    const layers = await page.evaluate(() => {
      const nav = document.querySelector<HTMLElement>('nav.bottom-nav')!;
      const aside = document.querySelector<HTMLElement>('aside')!;
      return {
        nav: parseInt(getComputedStyle(nav).zIndex, 10),
        sidebar: parseInt(getComputedStyle(aside).zIndex, 10),
      };
    });

    expect(layers.sidebar).toBeGreaterThan(layers.nav);
  });
});

test.describe('bottom navigation — RTL order', () => {
  test('reads right-to-left: בית first, עוד last', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/#/', { waitUntil: 'networkidle' });

    const order = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('nav.bottom-nav > a, nav.bottom-nav > button')].map(
        (el) => ({
          // :scope > pins this to the DIRECT child — the caption. Without it the
          // selector also reaches the badge nested inside the icon pill.
          label: (el.querySelector(':scope > span:last-child')?.textContent ?? '').trim(),
          left: Math.round(el.getBoundingClientRect().left),
        }),
      ),
    );

    // DOM order matches tab order matches the visual right-to-left sequence.
    expect(order.map((o) => o.label)).toEqual(['בית', 'חיפוש', 'מעקב', 'התראות', 'עוד']);
    for (let i = 1; i < order.length; i++) {
      expect(order[i].left, 'each following item sits further left in RTL').toBeLessThan(
        order[i - 1].left,
      );
    }
  });
});
