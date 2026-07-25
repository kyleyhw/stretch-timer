/**
 * @file Shared domain type definitions (JSDoc only — no runtime code).
 *
 * These typedefs are referenced across modules via `import('./types.js').Name`. Because the
 * references live in JSDoc comments, they are erased at runtime; the browser never loads this
 * file. It exists solely to give the type checker a single source of truth for the data model.
 */

/**
 * A single stretch in the library.
 * @typedef {object} Stretch
 * @property {string} id Stable slug (built-in) or `user-<uuid>` (custom).
 * @property {string} name Display name.
 * @property {string} area Target muscle group / body area.
 * @property {string} description One- or two-sentence how-to.
 * @property {number} defaultSeconds Suggested hold in seconds (per side if perSide).
 * @property {boolean} perSide Whether the stretch is held once per side (left then right).
 */

/**
 * A reference to a stretch inside a routine, with an overridable hold duration.
 * @typedef {object} RoutineItem
 * @property {string} stretchId Id into the stretch library.
 * @property {number} seconds Hold seconds (per side if the stretch is perSide).
 */

/**
 * An ordered routine of stretches.
 * @typedef {object} Routine
 * @property {string} id Stable slug (built-in) or `user-<uuid>` (custom).
 * @property {string} name Display name.
 * @property {string} description Short summary.
 * @property {boolean} builtIn True for seed routines (read-only), false for user routines.
 * @property {RoutineItem[]} items Ordered stretches.
 */

/**
 * A single timed step in an expanded session. A plain hold expands to `[prep?, hold]`; a per-side
 * hold expands to `[prep?, hold(left), switch?, hold(right)]`.
 * @typedef {object} Step
 * @property {'prep' | 'hold' | 'switch'} type Phase kind.
 * @property {number} durationMs Step length in milliseconds.
 * @property {number} stretchIndex Index of the owning routine item (for "stretch N of M").
 * @property {'left' | 'right' | null} side Active side, or null when not per-side.
 * @property {string} stretchName Resolved stretch name (for display).
 * @property {string} stretchDescription Resolved stretch description (for display).
 * @property {string} label Human phase label, e.g. "Get ready", "Hold — left side".
 */

/**
 * Timing settings that govern how a routine expands into steps.
 * @typedef {object} SessionSettings
 * @property {number} prepSeconds Get-ready countdown before each stretch (0 disables).
 * @property {number} switchSeconds Countdown between sides of a per-side stretch (0 disables).
 */

export {};
