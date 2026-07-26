/**
 * @file Data layer: resolves stretches by id and merges built-in routines with user-created ones.
 *
 * Built-in content comes from js/seed.js and is never mutated. User routines are held here in
 * memory; js/store.js (Phase 6) loads them from localStorage and calls setUserRoutines, and
 * persists edits. Until then the user list is empty and only built-ins are shown.
 */

import { STRETCHES, ROUTINES as BUILTIN_ROUTINES } from './seed.js';

/** @typedef {import('./types.js').Stretch} Stretch */
/** @typedef {import('./types.js').Routine} Routine */
/** @typedef {import('./types.js').StretchRef} StretchRef */

/** @type {Record<string, Stretch>} Built-in stretches, never mutated. */
const builtinStretchById = Object.fromEntries(STRETCHES.map((s) => [s.id, s]));

/** @type {Stretch[]} User-created stretches (custom library), held in memory. */
let userStretches = [];

/** @type {Record<string, Stretch>} Merged built-in ⊕ user library; rebuilt on every change. */
let stretchById = { ...builtinStretchById };

function rebuildStretchMap() {
  stretchById = {
    ...builtinStretchById,
    ...Object.fromEntries(userStretches.map((s) => [s.id, s])),
  };
}

/** @type {Routine[]} */
let userRoutines = [];

/**
 * Replace the in-memory user routines (called by the store on load/edit).
 * @param {Routine[]} list
 * @returns {void}
 */
export function setUserRoutines(list) {
  userRoutines = list;
}

/** @returns {Routine[]} User routines only. */
export function getUserRoutines() {
  return userRoutines;
}

/** @type {(list: Routine[]) => void} */
let persist = () => {};

/**
 * Register a persistence sink, called with the full user-routine list after every mutation.
 * @param {(list: Routine[]) => void} sink
 * @returns {void}
 */
export function setPersist(sink) {
  persist = sink;
}

/**
 * Insert or replace a user routine by id, then persist.
 * @param {Routine} routine
 * @returns {void}
 */
export function upsertUserRoutine(routine) {
  const exists = userRoutines.some((r) => r.id === routine.id);
  userRoutines = exists
    ? userRoutines.map((r) => (r.id === routine.id ? routine : r))
    : [...userRoutines, routine];
  persist(userRoutines);
}

/**
 * Delete a user routine by id, then persist.
 * @param {string} id
 * @returns {void}
 */
export function deleteUserRoutine(id) {
  userRoutines = userRoutines.filter((r) => r.id !== id);
  persist(userRoutines);
}

/** @returns {string} A fresh unique user-routine id. */
export function makeUserId() {
  return `user-${crypto.randomUUID()}`;
}

/** @returns {string} A fresh unique user-stretch id (distinct prefix from routines). */
export function makeStretchId() {
  return `ustr-${crypto.randomUUID()}`;
}

// --- User stretches (custom library) ---

/** @type {(list: Stretch[]) => void} */
let persistStretches = () => {};

/**
 * Register a persistence sink for user stretches, called with the full list after every mutation.
 * @param {(list: Stretch[]) => void} sink
 * @returns {void}
 */
export function setStretchPersist(sink) {
  persistStretches = sink;
}

/**
 * Replace the in-memory user stretches (called by the store on load).
 * @param {Stretch[]} list
 * @returns {void}
 */
export function setUserStretches(list) {
  userStretches = list;
  rebuildStretchMap();
}

/** @returns {Stretch[]} User stretches only. */
export function getUserStretches() {
  return userStretches;
}

/**
 * Insert or replace a user stretch by id, rebuild the merged map, then persist.
 * @param {Stretch} stretch
 * @returns {void}
 */
export function upsertUserStretch(stretch) {
  const exists = userStretches.some((s) => s.id === stretch.id);
  userStretches = exists
    ? userStretches.map((s) => (s.id === stretch.id ? stretch : s))
    : [...userStretches, stretch];
  rebuildStretchMap();
  persistStretches(userStretches);
}

/**
 * Delete a user stretch by id, rebuild the merged map, then persist.
 * @param {string} id
 * @returns {void}
 */
export function deleteUserStretch(id) {
  userStretches = userStretches.filter((s) => s.id !== id);
  rebuildStretchMap();
  persistStretches(userStretches);
}

/**
 * Whether any routine (built-in or user) references a stretch id — used to guard deletion.
 * @param {string} id
 * @returns {boolean}
 */
export function stretchInUse(id) {
  const uses = (/** @type {Routine} */ r) =>
    r.items.some((it) =>
      'block' in it ? it.block.some((ref) => ref.stretchId === id) : it.stretchId === id,
    );
  return getAllRoutines().some(uses);
}

/** @returns {Routine[]} Built-in routines followed by user routines. */
export function getAllRoutines() {
  return [...BUILTIN_ROUTINES, ...userRoutines];
}

/**
 * @param {string} id
 * @returns {Routine | null}
 */
export function getRoutineById(id) {
  return getAllRoutines().find((r) => r.id === id) ?? null;
}

// --- Share / export ---

/** Current share-payload format version. Bump on any breaking change to the shape. */
const SHARE_VERSION = 1;

/**
 * @typedef {object} SharePayload
 * @property {number} v Format version.
 * @property {Routine} routine The routine (ids are regenerated on import).
 * @property {Stretch[]} stretches Referenced custom stretches, so they travel with the routine.
 */

/** @param {unknown} v @returns {number} */
function clampSeconds(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(1, Math.min(3600, n)) : 30;
}

/** @param {Uint8Array} bytes @returns {string} URL-safe base64 (no padding). */
function toBase64Url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** @param {string} str @returns {Uint8Array} */
function fromBase64Url(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Build a self-contained share payload for a routine: the routine plus any **custom** stretches it
 * references (built-ins exist everywhere, so they are not embedded).
 * @param {Routine} routine
 * @returns {SharePayload}
 */
export function buildSharePayload(routine) {
  /** @type {Set<string>} */
  const ids = new Set();
  for (const it of routine.items) {
    if ('block' in it) for (const ref of it.block) ids.add(ref.stretchId);
    else ids.add(it.stretchId);
  }
  const stretches = [...ids]
    .filter((id) => id.startsWith('ustr-'))
    .map((id) => stretchById[id])
    .filter(/** @returns {s is Stretch} */ (s) => Boolean(s));
  return { v: SHARE_VERSION, routine, stretches };
}

/**
 * Encode a payload as a URL-safe base64 string (UTF-8 → bytes → base64url).
 * @param {SharePayload} payload
 * @returns {string}
 */
export function encodeShare(payload) {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

/**
 * Decode a share string back into a payload (throws on malformed input).
 * @param {string} code
 * @returns {SharePayload}
 */
export function decodeShare(code) {
  return JSON.parse(new TextDecoder().decode(fromBase64Url(code)));
}

/**
 * Import a share payload into the user's library: version-checked, with **all** ids regenerated
 * (routine + custom stretches, refs remapped) so imports never collide with existing content.
 * Unresolvable references are dropped; an empty result throws. Returns the new routine.
 * @param {unknown} payload
 * @returns {Routine}
 */
export function importSharePayload(payload) {
  const p = /** @type {any} */ (payload);
  if (!p || p.v !== SHARE_VERSION || !p.routine || !Array.isArray(p.routine.items)) {
    throw new Error('Unrecognised or unsupported share data.');
  }

  // Regenerate custom-stretch ids and add them to the library.
  /** @type {Map<string, string>} */
  const idMap = new Map();
  const incoming = Array.isArray(p.stretches) ? p.stretches : [];
  for (const s of incoming) {
    if (!s || typeof s.id !== 'string') continue;
    const newId = makeStretchId();
    idMap.set(s.id, newId);
    upsertUserStretch({
      id: newId,
      name: String(s.name ?? 'Custom stretch'),
      area: String(s.area ?? ''),
      description: String(s.description ?? ''),
      defaultSeconds: clampSeconds(s.defaultSeconds),
      perSide: Boolean(s.perSide),
    });
  }

  const remap = (/** @type {string} */ id) => idMap.get(id) ?? id;
  const resolvable = (/** @type {string} */ id) => getStretch(id) !== null;
  const mapRef = (/** @type {any} */ r) => ({
    stretchId: remap(String(r.stretchId)),
    seconds: clampSeconds(r.seconds),
  });

  /** @type {import('./types.js').RoutineItem[]} */
  const items = [];
  for (const it of p.routine.items) {
    if (it && 'block' in it && Array.isArray(it.block)) {
      const block = it.block
        .map(mapRef)
        .filter((/** @type {StretchRef} */ r) => resolvable(r.stretchId));
      if (block.length) items.push({ block });
    } else if (it && typeof it.stretchId === 'string') {
      const ref = mapRef(it);
      if (resolvable(ref.stretchId)) items.push(ref);
    }
  }
  if (items.length === 0) throw new Error('This routine has no usable stretches to import.');

  /** @type {Routine} */
  const routine = {
    id: makeUserId(),
    name: String(p.routine.name ?? 'Imported routine'),
    description: String(p.routine.description ?? ''),
    builtIn: false,
    items,
  };
  upsertUserRoutine(routine);
  return routine;
}

/** @returns {Record<string, Stretch>} The stretch library keyed by id. */
export function getStretchMap() {
  return stretchById;
}

/** @returns {Stretch[]} The full stretch library: built-in followed by user stretches. */
export function getAllStretches() {
  return [...STRETCHES, ...userStretches];
}

/**
 * @param {string} id
 * @returns {Stretch | null}
 */
export function getStretch(id) {
  return stretchById[id] ?? null;
}

/**
 * Estimated total hold time of a routine in seconds (per-side stretches counted twice). Prep and
 * switch intervals are excluded, so this is a lower bound used only for the "~N min" label.
 * @param {Routine} routine
 * @returns {number}
 */
export function routineHoldSeconds(routine) {
  return routine.items.reduce((total, item) => {
    if ('block' in item) {
      // Every stretch in the block is performed on both sides.
      const perSideTotal = item.block.reduce((sum, ref) => sum + ref.seconds, 0);
      return total + perSideTotal * 2;
    }
    const stretch = stretchById[item.stretchId];
    const sides = stretch && stretch.perSide ? 2 : 1;
    return total + item.seconds * sides;
  }, 0);
}
