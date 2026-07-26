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
