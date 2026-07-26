/**
 * @file Persistence: versioned, namespaced localStorage with a safe in-memory fallback.
 *
 * Every access is wrapped in try/catch: private-mode and quota-exceeded errors are common and must
 * not crash the app. When the backing store is unavailable or throws, an in-memory Map keeps the
 * app working for the session (routines simply won't persist), and `persistent` reports false.
 *
 * The Store class takes an injectable backend so its logic is unit-tested in Node (which has no
 * localStorage); the exported `store` singleton auto-detects the real one.
 */

/** @typedef {import('./types.js').Routine} Routine */
/** @typedef {import('./types.js').Stretch} Stretch */

/**
 * @typedef {object} StorageLike
 * @property {(key: string) => string | null} getItem
 * @property {(key: string, value: string) => void} setItem
 * @property {(key: string) => void} removeItem
 */

const NS = 'stretchTimer.v1';
export const KEYS = {
  userRoutines: `${NS}.userRoutines`,
  userStretches: `${NS}.userStretches`,
  settings: `${NS}.settings`,
  meta: `${NS}.meta`,
};
export const SCHEMA_VERSION = 1;

/**
 * Return the real localStorage if it is present and writable, else null.
 * @returns {StorageLike | null}
 */
function detectStorage() {
  try {
    const ls = globalThis.localStorage;
    const probe = `${NS}.__probe`;
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}

export class Store {
  /**
   * @param {StorageLike | null} [backend] Injected backend; omit to auto-detect localStorage.
   */
  constructor(backend) {
    /** @type {StorageLike | null} */
    this._backend = backend !== undefined ? backend : detectStorage();
    /** @type {Map<string, string>} In-memory fallback / mirror. */
    this._mem = new Map();
    this._ok = this._backend !== null;

    if (this.getRaw(KEYS.meta) === null) {
      this.setJSON(KEYS.meta, { schemaVersion: SCHEMA_VERSION });
    }
  }

  /** @returns {boolean} True if edits will survive a reload. */
  get persistent() {
    return this._ok;
  }

  /**
   * Memory-first: anything written this session (the mirror) wins, so values remain readable even
   * after a backend write failed. Keys not yet written fall through to the backend.
   * @param {string} key
   * @returns {string | null}
   */
  getRaw(key) {
    if (this._mem.has(key)) {
      return this._mem.get(key) ?? null;
    }
    if (this._backend) {
      try {
        return this._backend.getItem(key);
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * @param {string} key
   * @param {string} value
   * @returns {void}
   */
  setRaw(key, value) {
    this._mem.set(key, value);
    if (this._backend) {
      try {
        this._backend.setItem(key, value);
      } catch {
        this._ok = false;
      }
    }
  }

  /**
   * @template T
   * @param {string} key
   * @param {T} fallback
   * @returns {T}
   */
  getJSON(key, fallback) {
    const raw = this.getRaw(key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  /**
   * @param {string} key
   * @param {unknown} value
   * @returns {void}
   */
  setJSON(key, value) {
    this.setRaw(key, JSON.stringify(value));
  }

  /** @returns {Routine[]} */
  loadUserRoutines() {
    return this.getJSON(KEYS.userRoutines, /** @type {Routine[]} */ ([]));
  }

  /** @param {Routine[]} list @returns {void} */
  saveUserRoutines(list) {
    this.setJSON(KEYS.userRoutines, list);
  }

  /** @returns {Stretch[]} */
  loadUserStretches() {
    return this.getJSON(KEYS.userStretches, /** @type {Stretch[]} */ ([]));
  }

  /** @param {Stretch[]} list @returns {void} */
  saveUserStretches(list) {
    this.setJSON(KEYS.userStretches, list);
  }

  /**
   * @template T
   * @param {T} fallback
   * @returns {T}
   */
  loadSettings(fallback) {
    return { ...fallback, ...this.getJSON(KEYS.settings, {}) };
  }

  /** @param {unknown} settings @returns {void} */
  saveSettings(settings) {
    this.setJSON(KEYS.settings, settings);
  }
}

export const store = new Store();
