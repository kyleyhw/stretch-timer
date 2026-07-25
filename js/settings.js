/**
 * @file App settings: session timing (prep/switch) and cue preferences.
 *
 * Held in memory here; Phase 6 wires localStorage persistence via js/store.js by calling
 * initSettings with the loaded value and a persistence sink. The prep/switch fields are a superset
 * of SessionSettings, so this object can be passed directly to expandRoutine.
 */

/**
 * @typedef {object} AppSettings
 * @property {number} prepSeconds Get-ready countdown before each stretch (0–15).
 * @property {number} switchSeconds Countdown between sides of a per-side stretch (0–10).
 * @property {boolean} sound End-of-step beep and count-in ticks.
 * @property {boolean} countIn Tick each of the final three seconds of a hold.
 * @property {boolean} vibration Haptic buzz at transitions (where supported).
 * @property {boolean} keepAwake Hold a screen wake lock during a session (where supported).
 */

/** @type {AppSettings} */
export const DEFAULT_SETTINGS = {
  prepSeconds: 5,
  switchSeconds: 3,
  sound: true,
  countIn: true,
  vibration: true,
  keepAwake: true,
};

/** @type {AppSettings} */
let current = { ...DEFAULT_SETTINGS };

/** @type {((s: AppSettings) => void) | null} */
let persist = null;

/** @returns {AppSettings} */
export function getSettings() {
  return current;
}

/**
 * Merge a partial update and persist (if a sink is wired).
 * @param {Partial<AppSettings>} patch
 * @returns {AppSettings}
 */
export function updateSettings(patch) {
  current = { ...current, ...patch };
  if (persist) persist(current);
  return current;
}

/**
 * Initialise from a loaded value and register a persistence sink (Phase 6).
 * @param {Partial<AppSettings>} loaded
 * @param {(s: AppSettings) => void} sink
 * @returns {void}
 */
export function initSettings(loaded, sink) {
  current = { ...DEFAULT_SETTINGS, ...loaded };
  persist = sink;
}
