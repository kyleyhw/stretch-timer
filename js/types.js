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
 * @typedef {object} StretchRef
 * @property {string} stretchId Id into the stretch library.
 * @property {number} seconds Hold seconds (per side if the stretch is perSide).
 */

/**
 * A per-side block: its stretches are performed as a group on one side, then repeated on the other
 * (all-left, switch, all-right). The block drives the sides, so each sub-stretch's own perSide flag
 * is ignored inside it.
 * @typedef {object} SideBlock
 * @property {StretchRef[]} block Ordered stretches performed together per side.
 */

/**
 * An item in a routine: either a single stretch reference or a per-side block. Discriminate at
 * runtime with `'block' in item`.
 * @typedef {StretchRef | SideBlock} RoutineItem
 */

/**
 * An ordered routine of stretches.
 * @typedef {object} Routine
 * @property {string} id Stable slug (built-in) or `user-<uuid>` (custom).
 * @property {string} name Display name.
 * @property {string} description Short summary.
 * @property {boolean} builtIn True for seed routines (read-only), false for user routines.
 * @property {RoutineItem[]} items Ordered stretches and/or per-side blocks.
 */

/**
 * A single timed step in an expanded session. A plain hold expands to `[prep?, hold]`; a per-side
 * hold expands to `[prep?, hold(left), switch?, hold(right)]`.
 * @typedef {object} Step
 * @property {'prep' | 'hold' | 'switch'} type Phase kind.
 * @property {number} durationMs Step length in milliseconds.
 * @property {number} stretchIndex Running hold-unit index (for "stretch N of M"); a block's inner
 *   holds each get their own value.
 * @property {number} itemIndex Index of the routine item that produced this step; a block's inner
 *   holds and a stretch's own prep/hold/sides all share one. The "pause between stretches" boundary.
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
