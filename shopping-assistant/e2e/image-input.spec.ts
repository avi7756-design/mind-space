import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Client-side image intake on the search screen (TASK-009).
 *
 * Everything asserted here must hold with no backend: the file is decoded,
 * resized and compressed in the browser, and nothing is uploaded or persisted.
 */

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'images');
const LANDSCAPE = path.join(FIXTURES, 'product-landscape.jpg');
const PORTRAIT = path.join(FIXTURES, 'product-portrait.jpg');
const SMALL = path.join(FIXTURES, 'product-small.jpg');
const PHONE = { width: 390, height: 844 };
const MIN_TARGET = 44;

async function openPanel(page: Page) {
  await page.goto('/#/search');
  await page.getByRole('button', { name: 'חיפוש מוצר לפי תמונה' }).click();
  await expect(page.locator('#image-search-panel')).toBeVisible();
}

async function pickAlbumImage(page: Page, file: string) {
  await page.locator('[data-testid="album-input"]').setInputFiles(file);
  await expect(page.getByTestId('image-preview')).toBeVisible();
}

test.describe('image input controls', () => {
  test.beforeEach(async ({ page }) => {
    await openPanel(page);
  });

  test('offers an album button and a camera button, both with text', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'בחר מהאלבום' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'צלם מוצר' })).toBeVisible();
  });

  test('the album input accepts images and the camera input opens the rear camera', async ({
    page,
  }) => {
    await expect(page.getByTestId('album-input')).toHaveAttribute('accept', 'image/*');
    await expect(page.getByTestId('camera-input')).toHaveAttribute('accept', 'image/*');
    await expect(page.getByTestId('camera-input')).toHaveAttribute('capture', 'environment');
  });

  test('the recognition button is disabled and says so', async ({ page }) => {
    await expect(page.getByTestId('continue-to-recognition')).toBeDisabled();
    await expect(page.getByText('זיהוי המוצר יחובר בשלב הבא')).toBeVisible();
  });
});

test.describe('processing a chosen image', () => {
  test('shows a preview with the processed dimensions and size', async ({ page }) => {
    await openPanel(page);
    await pickAlbumImage(page, LANDSCAPE);

    // 2400x1600 fits into a 1280px long edge.
    await expect(page.getByTestId('image-dimensions')).toHaveText('1280×853');
    await expect(page.getByTestId('image-processed-size')).not.toBeEmpty();
    await expect(page.getByText('product-landscape.jpg')).toBeVisible();
  });

  test('passes through a visible processing state', async ({ page }) => {
    await openPanel(page);
    // A MutationObserver catches the transient state without racing on a timeout.
    await page.evaluate(() => {
      const w = window as unknown as { __sawProcessing?: boolean };
      w.__sawProcessing = false;
      const panel = document.querySelector('#image-search-panel')!;
      new MutationObserver(() => {
        if (panel.textContent?.includes('מעבד את התמונה')) w.__sawProcessing = true;
      }).observe(panel, { childList: true, subtree: true, characterData: true });
    });

    await pickAlbumImage(page, LANDSCAPE);
    const saw = await page.evaluate(
      () => (window as unknown as { __sawProcessing?: boolean }).__sawProcessing,
    );
    expect(saw).toBe(true);
  });

  test('leaves an already-small image at its original size', async ({ page }) => {
    await openPanel(page);
    await pickAlbumImage(page, SMALL);
    await expect(page.getByTestId('image-dimensions')).toHaveText('400×300');
  });

  test('replacing the image swaps the preview', async ({ page }) => {
    await openPanel(page);
    await pickAlbumImage(page, LANDSCAPE);
    const first = await page.getByTestId('image-preview').locator('img').getAttribute('src');

    await page.locator('[data-testid="album-input"]').setInputFiles(PORTRAIT);
    await expect(page.getByTestId('image-dimensions')).toHaveText('960×1280');

    const second = await page.getByTestId('image-preview').locator('img').getAttribute('src');
    expect(second).not.toBe(first);
    await expect(page.getByText('product-portrait.jpg')).toBeVisible();
  });

  test('removing the image clears the preview', async ({ page }) => {
    await openPanel(page);
    await pickAlbumImage(page, LANDSCAPE);
    await page.getByRole('button', { name: 'הסר את התמונה שנבחרה' }).click();
    await expect(page.getByTestId('image-preview')).toHaveCount(0);
    await expect(page.getByText('צלמו מוצר או בחרו תמונה מהאלבום')).toBeVisible();
  });

  test('choosing an image triggers no network request', async ({ page }) => {
    await openPanel(page);
    const requests: string[] = [];
    // The preview <img> loads a local blob: URL — that is the object URL being
    // read back from memory, not traffic. Anything http(s) would be a real upload.
    page.on('request', (r) => {
      if (!r.url().startsWith('blob:') && !r.url().startsWith('data:')) requests.push(r.url());
    });
    await pickAlbumImage(page, LANDSCAPE);
    await page.waitForTimeout(500);
    expect(requests).toEqual([]);
  });
});

test.describe('rejected files', () => {
  test('a non-image file reports a friendly error', async ({ page }) => {
    await openPanel(page);
    await page.locator('[data-testid="album-input"]').setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not an image'),
    });

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('אינו תמונה');
    await expect(alert).not.toContainText('Error');
    await expect(page.getByTestId('image-preview')).toHaveCount(0);
  });

  test('a file above 20MB is rejected before processing', async ({ page }) => {
    await openPanel(page);
    await page.locator('[data-testid="album-input"]').setInputFiles({
      name: 'huge.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.alloc(21 * 1024 * 1024, 1),
    });

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('20MB');
    await expect(page.getByTestId('image-preview')).toHaveCount(0);
  });
});

test.describe('mobile, dark mode and offline', () => {
  test.use({ viewport: PHONE });

  test('no horizontal overflow and every control stays tappable', async ({ page }) => {
    await openPanel(page);
    await pickAlbumImage(page, LANDSCAPE);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    const small = await page.evaluate((min) => {
      const offenders: string[] = [];
      document
        .querySelectorAll<HTMLElement>('#image-search-panel button')
        .forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width < min || r.height < min) {
            offenders.push(`${el.textContent?.trim()} ${Math.round(r.width)}x${Math.round(r.height)}`);
          }
        });
      return offenders;
    }, MIN_TARGET);
    expect(small).toEqual([]);
  });

  test('the panel renders in dark mode', async ({ page }) => {
    await page.goto('/#/search');
    await page.click('button[title="מצב כהה"]');
    await page.getByRole('button', { name: 'חיפוש מוצר לפי תמונה' }).click();
    await pickAlbumImage(page, LANDSCAPE);

    const colors = await page.evaluate(() => ({
      html: getComputedStyle(document.documentElement).backgroundColor,
      panel: getComputedStyle(document.querySelector('#image-search-panel')!).backgroundColor,
    }));
    expect(colors.html).toBe('rgb(2, 6, 23)');
    // slate-900 — the card must not stay white on a dark page.
    expect(colors.panel).toBe('rgb(15, 23, 42)');
    await expect(page.getByTestId('image-preview')).toBeVisible();
  });

  test('selecting and compressing an image still works offline', async ({ page, context }) => {
    await openPanel(page);
    await context.setOffline(true);
    try {
      await pickAlbumImage(page, LANDSCAPE);
      await expect(page.getByTestId('image-dimensions')).toHaveText('1280×853');
    } finally {
      await context.setOffline(false);
    }
  });
});

test('navigating away drops the held image instead of keeping stale state', async ({ page }) => {
  await openPanel(page);
  await pickAlbumImage(page, LANDSCAPE);

  await page.goto('/#/watchlist');
  await expect(page.getByTestId('image-preview')).toHaveCount(0);

  await page.goto('/#/search');
  // The panel starts closed again and holds no previous image.
  await expect(page.locator('#image-search-panel')).toHaveCount(0);
  await page.getByRole('button', { name: 'חיפוש מוצר לפי תמונה' }).click();
  await expect(page.getByTestId('image-preview')).toHaveCount(0);
  await expect(page.getByText('צלמו מוצר או בחרו תמונה מהאלבום')).toBeVisible();
});
