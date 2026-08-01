import { useEffect, useState } from 'react';

/**
 * Install affordance.
 *
 * No pop-up, no interstitial: the control lives in Settings and only appears
 * when the browser has actually offered installation. iOS never fires
 * `beforeinstallprompt`, so it gets a short instruction instead of a button
 * that would do nothing.
 */

/** Chromium-only event; not in lib.dom yet. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallState =
  /** Already running from the home screen. */
  | 'installed'
  /** The browser offered installation — show a button. */
  | 'available'
  /** iOS: possible, but only through the Share sheet. */
  | 'ios-manual'
  /** Nothing to offer (desktop browser without support, or already dismissed). */
  | 'unavailable';

// ---------- pure detection helpers (testable without a browser) ----------

export function isIos(userAgent: string): boolean {
  // iPadOS 13+ reports a desktop Safari UA, hence the Macintosh + touch check
  // is handled by the caller passing maxTouchPoints through `isIosDevice`.
  return /iphone|ipad|ipod/i.test(userAgent);
}

export function isIosDevice(userAgent: string, maxTouchPoints: number): boolean {
  if (isIos(userAgent)) return true;
  return /macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

export function isStandaloneDisplay(
  matchesStandalone: boolean,
  navigatorStandalone: boolean | undefined,
): boolean {
  // `navigator.standalone` is the legacy iOS signal; the media query covers
  // every other engine.
  return matchesStandalone || navigatorStandalone === true;
}

export function resolveInstallState(input: {
  standalone: boolean;
  hasPrompt: boolean;
  ios: boolean;
}): InstallState {
  if (input.standalone) return 'installed';
  if (input.hasPrompt) return 'available';
  if (input.ios) return 'ios-manual';
  return 'unavailable';
}

// ---------- hook ----------

function readStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return isStandaloneDisplay(
    window.matchMedia('(display-mode: standalone)').matches,
    nav.standalone,
  );
}

function readIos(): boolean {
  if (typeof window === 'undefined') return false;
  return isIosDevice(window.navigator.userAgent, window.navigator.maxTouchPoints);
}

export function useInstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(readStandalone);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      // Suppress the browser's own mini-infobar; the Settings button replaces it.
      event.preventDefault();
      setPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setPrompt(null);
      setStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const state = resolveInstallState({
    standalone,
    hasPrompt: prompt !== null,
    ios: readIos(),
  });

  async function install(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!prompt) return 'unavailable';
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    // The event is single-use — drop it either way so the button cannot be
    // clicked into a no-op.
    setPrompt(null);
    return outcome;
  }

  return { state, install };
}
