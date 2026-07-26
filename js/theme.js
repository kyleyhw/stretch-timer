/**
 * @file Theme application. Sets `data-theme` on the document root so the CSS token layer
 * (`:root`, `:root[data-theme='light']`, `:root[data-theme='system']`) resolves the right palette,
 * and keeps the `theme-color` meta in sync so the browser chrome matches. The `system` preference
 * defers the light/dark choice to the OS via `prefers-color-scheme`; we subscribe to changes so the
 * meta colour tracks the OS while in that mode.
 */

/** @typedef {import('./settings.js').ThemePref} ThemePref */

/** Browser-chrome colour per resolved (concrete) theme; matches `--bg` in css/styles.css. */
const THEME_COLOR = { dark: '#141110', light: '#faf5ee' };

/** @type {MediaQueryList | null} */
let darkQuery = null;
/** @type {ThemePref} */
let currentPref = 'dark';

/** @returns {MediaQueryList | null} */
function getDarkQuery() {
  if (darkQuery) return darkQuery;
  if (typeof matchMedia !== 'function') return null;
  darkQuery = matchMedia('(prefers-color-scheme: dark)');
  darkQuery.addEventListener('change', () => {
    if (currentPref === 'system') updateMeta('dark');
  });
  return darkQuery;
}

/**
 * The concrete light/dark a preference resolves to right now.
 * @param {ThemePref} pref
 * @returns {'dark' | 'light'}
 */
export function resolveTheme(pref) {
  if (pref === 'system') return getDarkQuery()?.matches === false ? 'light' : 'dark';
  return pref;
}

/**
 * Update the `theme-color` meta to match the resolved theme.
 * @param {ThemePref} pref
 * @returns {void}
 */
function updateMeta(pref) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[resolveTheme(pref)]);
}

/**
 * Apply a theme preference: stamp `data-theme` on <html> and sync the chrome colour.
 * @param {ThemePref} pref
 * @returns {void}
 */
export function applyTheme(pref) {
  currentPref = pref;
  getDarkQuery(); // ensure the system-change subscription exists
  document.documentElement.dataset.theme = pref;
  updateMeta(pref);
}
