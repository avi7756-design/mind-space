import { expect, test } from '@playwright/test';

/**
 * Safe-area wiring.
 *
 * Chromium reports 0px for every `env(safe-area-inset-*)`, so a real notch
 * cannot be simulated here. What CAN be verified — and is what actually breaks
 * in practice — is that the layout READS those variables: overriding them with
 * test values must move the chrome. If a rule were missing or a Tailwind
 * utility were overriding it, the measured padding would not change.
 *
 * Device-specific behaviour (a real Dynamic Island, Safari's collapsing address
 * bar) still requires verification on hardware.
 */

const TEST_INSETS = { top: 59, right: 21, bottom: 34, left: 21 };

async function applyTestInsets(page: import('@playwright/test').Page) {
  await page.addStyleTag({
    content: `:root {
      --safe-top: ${TEST_INSETS.top}px;
      --safe-right: ${TEST_INSETS.right}px;
      --safe-bottom: ${TEST_INSETS.bottom}px;
      --safe-left: ${TEST_INSETS.left}px;
    }`,
  });
  await page.waitForTimeout(200);
}

const padding = (page: import('@playwright/test').Page, selector: string) =>
  page.evaluate((sel) => {
    const s = getComputedStyle(document.querySelector(sel)!);
    return {
      top: parseFloat(s.paddingTop),
      right: parseFloat(s.paddingRight),
      bottom: parseFloat(s.paddingBottom),
      left: parseFloat(s.paddingLeft),
    };
  }, selector);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/', { waitUntil: 'networkidle' });
});

test('the safe-area variables are defined with a 0px fallback', async ({ page }) => {
  const vars = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return ['--safe-top', '--safe-right', '--safe-bottom', '--safe-left'].map((n) =>
      s.getPropertyValue(n).trim(),
    );
  });

  // Chromium resolves env() with no device inset to the 0px fallback.
  for (const value of vars) expect(value).toBe('0px');
});

test('the shell consumes the horizontal insets', async ({ page }) => {
  const before = await padding(page, '.app-shell');
  expect(before.left).toBe(0);
  expect(before.right).toBe(0);

  await applyTestInsets(page);
  const after = await padding(page, '.app-shell');

  expect(after.left).toBe(TEST_INSETS.left);
  expect(after.right).toBe(TEST_INSETS.right);
});

test('the top bar consumes the top inset on top of its own rhythm', async ({ page }) => {
  const before = await padding(page, 'header');
  expect(before.top).toBeCloseTo(12, 0); // 0.75rem, inset is 0 here

  await applyTestInsets(page);
  const after = await padding(page, 'header');

  expect(after.top).toBeCloseTo(12 + TEST_INSETS.top, 0);
  // The bottom rhythm must not have been swallowed by the calc.
  expect(after.bottom).toBeCloseTo(12, 0);
});

test('the content column keeps clear of the bottom inset', async ({ page }) => {
  await applyTestInsets(page);
  const after = await padding(page, '.safe-pb');

  expect(after.bottom).toBe(TEST_INSETS.bottom);
});

test('the mobile sidebar keeps clear of the top and bottom insets', async ({ page }) => {
  await applyTestInsets(page);
  await page.click('button[aria-label="פתיחת תפריט"]');
  await page.waitForTimeout(400);

  const after = await padding(page, 'aside');

  expect(after.top).toBe(TEST_INSETS.top);
  expect(after.bottom).toBe(TEST_INSETS.bottom);
});

test('the shell height tracks the dynamic viewport unit', async ({ page }) => {
  const minHeight = await page.evaluate(
    () => getComputedStyle(document.querySelector('.app-shell')!).minHeight,
  );

  // 100dvh resolves to the viewport height; in Chromium that equals 100vh.
  expect(parseFloat(minHeight)).toBeCloseTo(844, 0);
});

test('pinch zoom is not disabled', async ({ page }) => {
  const content = await page.evaluate(
    () => document.querySelector('meta[name="viewport"]')!.getAttribute('content')!,
  );

  expect(content).toContain('viewport-fit=cover');
  expect(content).not.toContain('user-scalable=no');
  expect(content).not.toContain('maximum-scale');
});

test('form fields render at 16px on phones so iOS does not zoom on focus', async ({ page }) => {
  await page.goto('/#/settings', { waitUntil: 'networkidle' });

  const sizes = await page.evaluate(() =>
    [...document.querySelectorAll('input.input, select.input')].map((el) =>
      parseFloat(getComputedStyle(el).fontSize),
    ),
  );

  expect(sizes.length).toBeGreaterThan(0);
  for (const size of sizes) expect(size).toBeGreaterThanOrEqual(16);
});

test('desktop keeps the smaller field type scale', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/settings', { waitUntil: 'networkidle' });

  const size = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.querySelector('input.input')!).fontSize),
  );

  expect(size).toBeCloseTo(14, 0);
});

test('the area behind the insets is dark in dark mode', async ({ page }) => {
  await page.click('button[title="מצב כהה"]');
  await page.waitForTimeout(400);

  const colors = await page.evaluate(() => ({
    html: getComputedStyle(document.documentElement).backgroundColor,
    body: getComputedStyle(document.body).backgroundColor,
  }));

  // slate-950
  expect(colors.html).toBe('rgb(2, 6, 23)');
  expect(colors.body).toBe('rgb(2, 6, 23)');
});
