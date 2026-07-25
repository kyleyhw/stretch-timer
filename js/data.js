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

/** @type {Record<string, Stretch>} */
const stretchById = Object.fromEntries(STRETCHES.map((s) => [s.id, s]));

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
    const stretch = stretchById[item.stretchId];
    const sides = stretch && stretch.perSide ? 2 : 1;
    return total + item.seconds * sides;
  }, 0);
}
