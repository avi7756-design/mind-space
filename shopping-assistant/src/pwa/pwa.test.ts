import { describe, expect, it, vi } from 'vitest';
import { isWithinScope, resolvePwaUrls } from './paths';
import { THEME_COLORS, themeColorFor } from './themeColor';
import { isIos, isIosDevice, isStandaloneDisplay, resolveInstallState } from './install';
import { registerServiceWorker } from './registerServiceWorker';

// ---------- scope resolution ----------

describe('resolvePwaUrls — the deployment path is derived, never hardcoded', () => {
  it('resolves to the app root when served from the domain root', () => {
    const { swUrl, scope } = resolvePwaUrls('./', 'https://example.com/');

    expect(swUrl).toBe('https://example.com/sw.js');
    expect(scope).toBe('https://example.com/');
  });

  it('resolves under the GitHub Pages project path', () => {
    const { swUrl, scope } = resolvePwaUrls(
      './',
      'https://avi7756-design.github.io/mind-space/shopping/',
    );

    expect(swUrl).toBe('https://avi7756-design.github.io/mind-space/shopping/sw.js');
    expect(scope).toBe('https://avi7756-design.github.io/mind-space/shopping/');
  });

  it('resolves from a deep page URL, not just the directory', () => {
    const { scope } = resolvePwaUrls(
      './',
      'https://avi7756-design.github.io/mind-space/shopping/index.html',
    );

    expect(scope).toBe('https://avi7756-design.github.io/mind-space/shopping/');
  });

  it('ignores the hash route entirely', () => {
    const { swUrl } = resolvePwaUrls(
      './',
      'https://avi7756-design.github.io/mind-space/shopping/#/watchlist',
    );

    expect(swUrl).toBe('https://avi7756-design.github.io/mind-space/shopping/sw.js');
  });

  it('accepts an absolute base and still ends in a directory', () => {
    const { scope } = resolvePwaUrls('/mind-space/shopping/', 'https://example.com/anything');

    expect(scope).toBe('https://example.com/mind-space/shopping/');
  });

  it('never reaches the parent scope of the mind-space app', () => {
    const { scope } = resolvePwaUrls(
      './',
      'https://avi7756-design.github.io/mind-space/shopping/',
    );

    expect(scope).not.toBe('https://avi7756-design.github.io/mind-space/');
    expect(scope).not.toBe('https://avi7756-design.github.io/');
    expect(new URL(scope).pathname).toBe('/mind-space/shopping/');
  });
});

describe('isWithinScope', () => {
  const SCOPE = 'https://avi7756-design.github.io/mind-space/shopping/';

  it('accepts our own assets', () => {
    expect(isWithinScope(`${SCOPE}assets/index-abc.js`, SCOPE)).toBe(true);
    expect(isWithinScope(`${SCOPE}icons/icon-192.png`, SCOPE)).toBe(true);
  });

  it('rejects the parent app', () => {
    expect(isWithinScope('https://avi7756-design.github.io/mind-space/index.html', SCOPE)).toBe(
      false,
    );
    expect(isWithinScope('https://avi7756-design.github.io/mind-space/sw.js', SCOPE)).toBe(false);
  });

  it('rejects other origins — supplier links and fonts stay untouched', () => {
    expect(isWithinScope('https://ksp.co.il/product', SCOPE)).toBe(false);
    expect(isWithinScope('https://fonts.googleapis.com/css2?family=Heebo', SCOPE)).toBe(false);
  });
});

// ---------- registration ----------

function fakeContainer() {
  const register = vi.fn().mockResolvedValue({ scope: 'https://example.com/app/' });
  return { register } as unknown as ServiceWorkerContainer & { register: ReturnType<typeof vi.fn> };
}

describe('registerServiceWorker', () => {
  const PAGE = 'https://avi7756-design.github.io/mind-space/shopping/';

  it('registers the Shopping script with an explicit Shopping scope', async () => {
    const container = fakeContainer();
    await registerServiceWorker({
      container,
      baseUrl: './',
      pageHref: PAGE,
      isProduction: true,
    });

    expect(container.register).toHaveBeenCalledWith(`${PAGE}sw.js`, { scope: PAGE });
  });

  it('does not register in development', async () => {
    const container = fakeContainer();
    const result = await registerServiceWorker({
      container,
      baseUrl: './',
      pageHref: PAGE,
      isProduction: false,
    });

    expect(container.register).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('returns null instead of throwing when registration fails', async () => {
    const container = {
      register: vi.fn().mockRejectedValue(new Error('SecurityError')),
    } as unknown as ServiceWorkerContainer;

    await expect(
      registerServiceWorker({ container, baseUrl: './', pageHref: PAGE, isProduction: true }),
    ).resolves.toBeNull();
  });

  it('is a no-op where service workers are unsupported', async () => {
    await expect(
      registerServiceWorker({
        container: undefined,
        baseUrl: './',
        pageHref: PAGE,
        isProduction: true,
      }),
    ).resolves.toBeNull();
  });

  it('never unregisters anything', () => {
    // Guards the audit's core promise: the mind-space registration is left alone.
    expect(registerServiceWorker.toString()).not.toContain('unregister');
    expect(registerServiceWorker.toString()).not.toContain('getRegistrations');
  });
});

// ---------- theme colour ----------

describe('theme colour', () => {
  it('matches the background painted behind the safe areas', () => {
    expect(THEME_COLORS.light).toBe('#f1f5f9'); // slate-100
    expect(THEME_COLORS.dark).toBe('#020617'); // slate-950
  });

  it('maps each theme to its own colour', () => {
    expect(themeColorFor('light')).not.toBe(themeColorFor('dark'));
  });
});

// ---------- install state ----------

describe('iOS detection', () => {
  it('recognises iPhone and iPad', () => {
    expect(isIos('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
    expect(isIos('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe(true);
  });

  it('does not mistake desktop browsers for iOS', () => {
    expect(isIos('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(false);
    expect(isIos('Mozilla/5.0 (X11; Linux x86_64)')).toBe(false);
  });

  it('recognises iPadOS, which reports a desktop Safari user agent', () => {
    const IPAD_OS = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';

    expect(isIosDevice(IPAD_OS, 5)).toBe(true);
    expect(isIosDevice(IPAD_OS, 0), 'a real Mac has no touch points').toBe(false);
  });
});

describe('standalone detection', () => {
  it('trusts the display-mode media query', () => {
    expect(isStandaloneDisplay(true, undefined)).toBe(true);
  });

  it('falls back to the legacy iOS flag', () => {
    expect(isStandaloneDisplay(false, true)).toBe(true);
  });

  it('is false in an ordinary browser tab', () => {
    expect(isStandaloneDisplay(false, false)).toBe(false);
    expect(isStandaloneDisplay(false, undefined)).toBe(false);
  });
});

describe('resolveInstallState', () => {
  it('an installed app never offers installation again', () => {
    expect(resolveInstallState({ standalone: true, hasPrompt: true, ios: false })).toBe('installed');
    expect(resolveInstallState({ standalone: true, hasPrompt: false, ios: true })).toBe('installed');
  });

  it('offers the button only once the browser has offered installation', () => {
    expect(resolveInstallState({ standalone: false, hasPrompt: true, ios: false })).toBe(
      'available',
    );
  });

  it('gives iOS instructions, since it never fires the prompt event', () => {
    expect(resolveInstallState({ standalone: false, hasPrompt: false, ios: true })).toBe(
      'ios-manual',
    );
  });

  it('shows nothing where installation is not on offer', () => {
    expect(resolveInstallState({ standalone: false, hasPrompt: false, ios: false })).toBe(
      'unavailable',
    );
  });
});
