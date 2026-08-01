import { expect, test } from '@playwright/test';

const PHONE = { width: 390, height: 844 };

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(PHONE);
});

test.describe('field types drive the right soft keyboard', () => {
  test('search fields are type=search with a search action key', async ({ page }) => {
    await page.goto('/#/search', { waitUntil: 'networkidle' });

    const fields = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLInputElement>('input[type="search"]')].map((el) => ({
        inputMode: el.getAttribute('inputmode'),
        enterKeyHint: el.getAttribute('enterkeyhint'),
      })),
    );

    // The global bar and the in-page form.
    expect(fields.length).toBeGreaterThanOrEqual(2);
    for (const f of fields) {
      expect(f.inputMode).toBe('search');
      expect(f.enterKeyHint).toBe('search');
    }
  });

  test('the email field asks for an email keyboard and autofill', async ({ page }) => {
    await page.goto('/#/settings', { waitUntil: 'networkidle' });

    const email = page.locator('input[type="email"]').first();
    await expect(email).toHaveAttribute('inputmode', 'email');
    await expect(email).toHaveAttribute('autocomplete', 'email');
  });

  test('the Telegram chat id asks for a numeric keyboard', async ({ page }) => {
    await page.goto('/#/settings', { waitUntil: 'networkidle' });

    const chatId = page.locator('input[aria-label="מזהה צ׳אט בטלגרם"]');
    await expect(chatId).toHaveAttribute('inputmode', 'numeric');
  });

  test('the webhook field is type=url with a url keyboard', async ({ page }) => {
    await page.goto('/#/settings', { waitUntil: 'networkidle' });

    // The webhook channel is off by default — turn it on to reveal the field.
    await page.locator('label', { hasText: 'Webhook' }).locator('input[type="checkbox"]').check();
    await page.waitForTimeout(300);

    const url = page.locator('input[type="url"]');
    await expect(url).toHaveAttribute('inputmode', 'url');
  });

  test('the target-price field asks for a decimal keyboard', async ({ page }) => {
    await page.goto('/#/watchlist', { waitUntil: 'networkidle' });

    await page.locator('button[title="עריכת מחיר יעד"]').first().click();
    await page.waitForTimeout(300);

    const price = page.locator('input[aria-label="מחיר יעד חדש"]');
    await expect(price).toHaveAttribute('inputmode', 'decimal');
    await expect(price).toHaveAttribute('enterkeyhint', 'done');
  });
});

test.describe('search submit', () => {
  test('Enter runs the search exactly once and does not reload the page', async ({ page }) => {
    await page.goto('/#/search', { waitUntil: 'networkidle' });

    // A value on window is wiped by a document reload but survives SPA routing.
    await page.evaluate(() => {
      (window as unknown as { __alive: boolean }).__alive = true;
    });

    // A query that does NOT appear in the seed journal, so any entry found
    // afterwards was created by this search alone.
    const QUERY = 'מקרר סמסונג לבדיקה';
    const field = page.locator('form.card input[type="search"]');
    await field.fill(QUERY);
    await field.press('Enter');
    await page.waitForSelector('table', { timeout: 15_000 });

    const stillAlive = await page.evaluate(
      () => (window as unknown as { __alive?: boolean }).__alive === true,
    );
    expect(stillAlive, 'the page must not have reloaded').toBe(true);

    expect(page.url()).toContain('q=');
    await expect(page.locator('table')).toHaveCount(1);

    // One search means one journal entry, not two.
    await page.goto('/#/activity', { waitUntil: 'networkidle' });
    const searchEntries = await page.evaluate(
      (query) =>
        [...document.querySelectorAll('p')].filter((p) =>
          (p.textContent ?? '').includes(`בוצע חיפוש: "${query}"`),
        ).length,
      QUERY,
    );
    expect(searchEntries, 'the search must be recorded once, not twice').toBe(1);
  });

  test('Enter in the global bar routes to the results', async ({ page }) => {
    await page.goto('/#/', { waitUntil: 'networkidle' });

    const field = page.locator('input[aria-label="חיפוש מוצר"]');
    await field.fill('מכונת קפה');
    await field.press('Enter');
    await page.waitForTimeout(1200);

    expect(page.url()).toContain('#/search');
    expect(decodeURIComponent(page.url())).toContain('מכונת קפה');
  });
});

test.describe('sidebar and the soft keyboard', () => {
  test('opening the menu from a focused field drops the keyboard', async ({ page }) => {
    await page.goto('/#/search', { waitUntil: 'networkidle' });

    const field = page.locator('form.card input[type="search"]');
    await field.click();
    await expect(field).toBeFocused();

    await page.locator('nav[aria-label="ניווט מהיר"] button', { hasText: 'עוד' }).click();
    await page.waitForTimeout(500);

    // Blurring the field is what dismisses the on-screen keyboard on iOS,
    // so the menu is not left hidden behind it.
    const activeTag = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
    expect(activeTag).not.toBe('input');

    await expect(page.locator('aside a', { hasText: 'הגדרות' })).toBeVisible();
  });

  test('navigation still works after the menu was opened from a field', async ({ page }) => {
    await page.goto('/#/search', { waitUntil: 'networkidle' });
    await page.locator('form.card input[type="search"]').click();

    await page.locator('nav[aria-label="ניווט מהיר"] button', { hasText: 'עוד' }).click();
    await page.waitForTimeout(400);
    await page.locator('aside a', { hasText: 'הגדרות' }).click();
    await page.waitForTimeout(400);

    expect(page.url()).toContain('#/settings');
  });
});
