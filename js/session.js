/**
 * @file Session state machine: expands a routine into an ordered list of timed steps and drives
 * them with a single drift-free {@link Countdown} spanning the whole session.
 *
 * The current step is derived from elapsed running time via cumulative step boundaries, so:
 * - skipping is a seek (Countdown.setRemaining) rather than bespoke per-step bookkeeping;
 * - background reconciliation is automatic — elapsed is always `total − remaining` and remaining
 *   is `T − now`, so a forced tick after the tab regains focus lands on the correct step.
 *
 * See docs/data-model.md for the derivation.
 */

import { Countdown } from './timer.js';

/** @typedef {import('./types.js').Stretch} Stretch */
/** @typedef {import('./types.js').Routine} Routine */
/** @typedef {import('./types.js').Step} Step */
/** @typedef {import('./types.js').SessionSettings} SessionSettings */
/** @typedef {import('./timer.js').CountdownDeps} CountdownDeps */

/**
 * @typedef {object} SessionInfo
 * @property {number} stepIndex Current step index (0-based).
 * @property {number} stepCount Total number of steps.
 * @property {number} stretchNumber Current stretch, 1-based (per-side steps share one number).
 * @property {number} stretchCount Number of distinct stretches in the routine.
 * @property {number} fraction Overall progress in [0, 1].
 */

/**
 * @typedef {object} SessionCallbacks
 * @property {(step: Step, info: SessionInfo, prevStep: Step | null) => void} [onStepChange]
 *   Fires when the active step changes, including once at start (prevStep null).
 * @property {(stepRemainingMs: number, step: Step, info: SessionInfo) => void} [onTick]
 *   Fires every frame with the remaining time in the current step.
 * @property {(paused: boolean) => void} [onPauseChange]
 * @property {() => void} [onComplete] Fires once when the whole session finishes.
 * @property {() => void} [onQuit] Fires when the session is abandoned via quit().
 */

/**
 * If the user is more than this many milliseconds into the current stretch, "previous" restarts
 * that stretch; within this guard it jumps to the previous stretch. Mirrors the ~2 s behaviour of
 * media players (skip-back restarts, double skip-back goes to the prior track).
 */
const PREV_RESTART_GUARD_MS = 2000;

/**
 * Expands a routine into a flat, ordered list of timed steps.
 *
 * @param {Routine} routine
 * @param {Record<string, Stretch>} stretchById Library keyed by stretch id.
 * @param {SessionSettings} settings
 * @returns {Step[]}
 */
export function expandRoutine(routine, stretchById, settings) {
  const prepMs = Math.max(0, settings.prepSeconds) * 1000;
  const switchMs = Math.max(0, settings.switchSeconds) * 1000;
  /** @type {Step[]} */
  const steps = [];

  routine.items.forEach((item, i) => {
    const stretch = stretchById[item.stretchId];
    if (!stretch) {
      throw new Error(`expandRoutine: unknown stretchId "${item.stretchId}"`);
    }
    const holdMs = Math.max(0, item.seconds) * 1000;
    const base = {
      stretchIndex: i,
      stretchName: stretch.name,
      stretchDescription: stretch.description,
    };

    if (prepMs > 0) {
      steps.push({
        ...base,
        type: 'prep',
        durationMs: prepMs,
        side: stretch.perSide ? 'left' : null,
        label: 'Get ready',
      });
    }

    if (stretch.perSide) {
      steps.push({
        ...base,
        type: 'hold',
        durationMs: holdMs,
        side: 'left',
        label: 'Hold — left side',
      });
      if (switchMs > 0) {
        steps.push({
          ...base,
          type: 'switch',
          durationMs: switchMs,
          side: 'right',
          label: 'Switch sides',
        });
      }
      steps.push({
        ...base,
        type: 'hold',
        durationMs: holdMs,
        side: 'right',
        label: 'Hold — right side',
      });
    } else {
      steps.push({ ...base, type: 'hold', durationMs: holdMs, side: null, label: 'Hold' });
    }
  });

  return steps;
}

/**
 * Drives an expanded step list to completion. All timing flows through one {@link Countdown}, so
 * the injected clock/scheduler make the whole state machine deterministic under test.
 */
export class Session {
  /**
   * @param {Step[]} steps A non-empty expanded step list (see {@link expandRoutine}).
   * @param {SessionCallbacks} [callbacks]
   * @param {CountdownDeps} [deps]
   */
  constructor(steps, callbacks = {}, deps = {}) {
    if (steps.length === 0) {
      throw new RangeError('Session requires at least one step');
    }
    /** @type {Step[]} */
    this.steps = steps;
    /** @type {SessionCallbacks} */
    this._cb = callbacks;

    /** @type {number[]} Cumulative boundaries; _bounds[j] is elapsed time at the start of step j. */
    this._bounds = [0];
    for (const s of steps) {
      this._bounds.push(this._bounds[this._bounds.length - 1] + s.durationMs);
    }
    /** @type {number} Total session duration. */
    this._total = this._bounds[this._bounds.length - 1];
    /** @type {number} Distinct stretch count (per-side steps do not inflate it). */
    this._stretchCount = new Set(steps.map((s) => s.stretchIndex)).size;

    /** @type {number} Index of the step reported on the previous tick (-1 before start). */
    this._lastStep = -1;
    /** @type {number} Current step index. */
    this._curStep = 0;
    /** @type {boolean} */
    this._paused = false;

    this._cd = new Countdown(
      this._total,
      { onTick: (rem) => this._onTick(rem), onComplete: () => this._onComplete() },
      deps,
    );
  }

  /** @returns {boolean} */
  get paused() {
    return this._paused;
  }

  /** @returns {boolean} */
  get running() {
    return this._cd.running;
  }

  /** @returns {boolean} */
  get completed() {
    return this._cd.completed;
  }

  /** @returns {number} Elapsed running time in milliseconds. */
  elapsedMs() {
    return this._total - this._cd.remainingMs();
  }

  /** @returns {Step} The current step. */
  currentStep() {
    return this.steps[this._curStep];
  }

  /**
   * Starts the session from the beginning. The immediate tick emits the first onStepChange.
   * @returns {void}
   */
  start() {
    this._lastStep = -1;
    this._curStep = 0;
    this._paused = false;
    this._cd.start();
  }

  /**
   * Largest step index j with boundary <= elapsed, capped at the last step.
   * @param {number} elapsed
   * @returns {number}
   */
  _stepIndexAt(elapsed) {
    let j = 0;
    while (j < this.steps.length - 1 && this._bounds[j + 1] <= elapsed) {
      j++;
    }
    return j;
  }

  /**
   * @param {Step} step
   * @returns {SessionInfo}
   */
  _info(step) {
    const elapsed = this.elapsedMs();
    return {
      stepIndex: this._curStep,
      stepCount: this.steps.length,
      stretchNumber: step.stretchIndex + 1,
      stretchCount: this._stretchCount,
      fraction: this._total > 0 ? Math.min(1, Math.max(0, elapsed / this._total)) : 1,
    };
  }

  /**
   * Frame handler: derive the current step from elapsed time, emit step changes, then emit the
   * per-step remaining.
   * @param {number} sessionRemaining Remaining ms in the whole session.
   * @returns {void}
   */
  _onTick(sessionRemaining) {
    const elapsed = this._total - sessionRemaining;
    const j = this._stepIndexAt(elapsed);
    this._curStep = j;
    const step = this.steps[j];

    if (j !== this._lastStep) {
      const prev = this._lastStep >= 0 ? this.steps[this._lastStep] : null;
      this._lastStep = j;
      if (this._cb.onStepChange) this._cb.onStepChange(step, this._info(step), prev);
    }

    const stepRemaining = Math.max(0, this._bounds[j + 1] - elapsed);
    if (this._cb.onTick) this._cb.onTick(stepRemaining, step, this._info(step));
  }

  /** @returns {void} */
  _onComplete() {
    if (this._cb.onComplete) this._cb.onComplete();
  }

  /**
   * Re-synchronises the display to the current clock (call on visibilitychange → visible). Because
   * the underlying countdown is drift-free, this lands on the correct step no matter how long the
   * tab was hidden; completion itself fires from the countdown's own next frame.
   * @returns {void}
   */
  reconcile() {
    if (this._paused || this._cd.completed) return;
    this._onTick(this._cd.remainingMs());
  }

  /** @returns {void} */
  pause() {
    if (this._paused || this._cd.completed) return;
    this._cd.pause();
    this._paused = true;
    if (this._cb.onPauseChange) this._cb.onPauseChange(true);
  }

  /** @returns {void} */
  resume() {
    if (!this._paused) return;
    this._cd.resume();
    this._paused = false;
    if (this._cb.onPauseChange) this._cb.onPauseChange(false);
  }

  /** @returns {void} */
  togglePause() {
    if (this._paused) this.resume();
    else this.pause();
  }

  /**
   * First step index belonging to a given stretch.
   * @param {number} stretchIndex
   * @returns {number}
   */
  _firstStepOfStretch(stretchIndex) {
    return this.steps.findIndex((s) => s.stretchIndex === stretchIndex);
  }

  /**
   * Seek so the given step becomes current, resuming the loop if needed, and emit immediately.
   * @param {number} j
   * @returns {void}
   */
  _seekToStep(j) {
    this._paused = false;
    this._cd.setRemaining(this._total - this._bounds[j]);
    if (!this._cd.running) this._cd.resume();
    this._onTick(this._cd.remainingMs());
  }

  /**
   * Skip forward to the first step of the next stretch (skips remaining sides of the current one).
   * Past the last stretch, finishes the session.
   * @returns {void}
   */
  next() {
    const cur = this.steps[this._curStep].stretchIndex;
    const j = this._firstStepOfStretch(cur + 1);
    if (j < 0) {
      this._finish();
    } else {
      this._seekToStep(j);
    }
  }

  /**
   * Skip back. If more than {@link PREV_RESTART_GUARD_MS} into the current stretch, restart it;
   * otherwise jump to the previous stretch.
   * @returns {void}
   */
  prev() {
    const cur = this.steps[this._curStep].stretchIndex;
    const firstOfCur = this._firstStepOfStretch(cur);
    const intoStretch = this.elapsedMs() - this._bounds[firstOfCur];
    if (intoStretch > PREV_RESTART_GUARD_MS) {
      this._seekToStep(firstOfCur);
    } else {
      this._seekToStep(this._firstStepOfStretch(Math.max(0, cur - 1)));
    }
  }

  /** @returns {void} */
  _finish() {
    this._cd.stop();
    this._paused = false;
    if (this._cb.onComplete) this._cb.onComplete();
  }

  /**
   * Abandon the session without firing onComplete.
   * @returns {void}
   */
  quit() {
    this._cd.stop();
    this._paused = false;
    if (this._cb.onQuit) this._cb.onQuit();
  }
}
