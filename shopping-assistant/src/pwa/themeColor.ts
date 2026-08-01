/**
 * Keeps `<meta name="theme-color">` in step with the app's own theme.
 *
 * A `media="(prefers-color-scheme: dark)"` pair is not enough here: the theme
 * is a user choice persisted in the store, so it can disagree with the OS.
 * The tag is rewritten from that single source of truth instead.
 */

export type ThemeName = 'light' | 'dark';

/** slate-100 / slate-950 — the same values `html` paints behind the safe areas. */
export const THEME_COLORS: Record<ThemeName, string> = {
  light: '#f1f5f9',
  dark: '#020617',
};

export function themeColorFor(theme: ThemeName): string {
  return THEME_COLORS[theme];
}

export function syncThemeColor(theme: ThemeName, doc: Document = document): void {
  let meta = doc.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = doc.createElement('meta');
    meta.name = 'theme-color';
    doc.head.appendChild(meta);
  }
  meta.content = themeColorFor(theme);
}
