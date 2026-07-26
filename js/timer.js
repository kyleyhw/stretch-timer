/**
 * @file Drift-free countdown timer engine.
 *
 * The remaining time of a countdown is computed as the difference between a fixed target
 * timestamp and the current reading of a monotonic clock, rather than by decrementing an
 * accumulator each frame. This makes the displayed error bounded by a single sampling
 * interval and independent of the number of frames, so scheduling jitter (variable frame
 * rate, background-tab throttling, event-loop latency) cannot accumulate.
 *
 * See docs/timer-math.md for the derivation.
 */

/**
 * A monotonic clock returning a timestamp in milliseconds. Must be non-decreasing;
 * `performance.now()` is the browser default.
 * @typedef {() => number} Clock
 */

/**
 * Schedules `callback` to run on the next animation frame and returns a cancellation handle.
 * @typedef {(callback: () => void) => number} Scheduler
 */

/**
 * Cancels a frame previously scheduled by a {@link Scheduler}.
 * @typedef {(handle: number) => void} Canceller
 */

/**
 * @typedef {object} CountdownCallbacks
 * @property {(remainingMs: number) => void} [onTick] Invoked every frame with the clamped
 *   remaining milliseconds (always >= 0).
 * @property {() => void} [onComplete] Invoked exactly once when the countdown reaches zero.
 */

/**
 * Injectable dependencies. All default to the browser environment; tests override them to
 * drive the timer deterministically.
 * @typedef {object} CountdownDeps
 * @property {Clock} [now]
 * @property {Scheduler} [schedule]
 * @property {Canceller} [cancel]
 */

/** @type {Scheduler} */
const defaultSchedule = (callback) => requestAnimationFrame(callback);

/** @type {Canceller} */
const defaultCancel = (handle) => cancelAnimationFrame(handle);

/** @type {Clock} */
const defaultNow = () => performance.now();

/**
 * A single-interval countdown. One instance times one hold; the session layer creates a new
 * countdown per step. Safe to query at any time via {@link Countdown#remainingMs}.
 */
export class Countdown {
  /**
   * @param {number} durationMs Non-negative countdown duration in milliseconds.
   * @param {CountdownCallbacks} [callbacks]
   * @param {CountdownDeps} [deps]
   */
  constructor(durationMs, callbacks = {}, deps = {}) {
    if (!(durationMs >= 0)) {
      throw new RangeError(`durationMs must be >= 0, received ${durationMs}`);
    }
    /** @type {number} */
    this.durationMs = durationMs;
    /** @type {((remainingMs: number) => void) | undefined} */
    this._onTick = callbacks.onTick;
    /** @type {(() => void) | undefined} */
    this._onComplete = callbacks.onComplete;
    /** @type {Clock} */
    this._now = deps.now ?? defaultNow;
    /** @type {Scheduler} */
    this._schedule = deps.schedule ?? defaultSchedule;
    /** @type {Canceller} */
    this._cancel = deps.cancel ?? defaultCancel;

    /** @type {number} Absolute target time; meaningful only while running. */
    this._endAt = 0;
    /** @type {number} Remaining ms while paused/idle; the resume anchor. */
    this._remaining = durationMs;
    /** @type {number | null} Active scheduler handle, or null when not running. */
    this._handle = null;
    /** @type {boolean} */
    this._running = false;
    /** @type {boolean} */
    this._completed = false;
  }

  /** @returns {boolean} True while the frame loop is active. */
  get running() {
    return this._running;
  }

  /** @returns {boolean} True once the countdown has reached zero. */
  get completed() {
    return this._completed;
  }

  /**
   * Remaining milliseconds, clamped to >= 0. Pure function of the current clock reading; safe
   * to call at any time, whether running, paused, or completed.
   * @returns {number}
   */
  remainingMs() {
    if (this._running) {
      return Math.max(0, this._endAt - this._now());
    }
    return this._remaining;
  }

  /**
   * Remaining whole seconds for display: ceil(remainingMs / 1000). Shows the full duration at
   * the start and reaches 0 only at the instant the countdown completes.
   * @returns {number}
   */
  remainingSeconds() {
    return Math.ceil(this.remainingMs() / 1000);
  }

  /**
   * Re-anchors the countdown to a specific remaining time (a seek). Clears the completed flag so
   * the countdown can run again. While running, it adjusts the target relative to now; while
   * paused or stopped, it updates the stored remaining used on the next resume. Used by the
   * session layer to skip between steps.
   * @param {number} remainingMs Clamped to >= 0.
   * @returns {void}
   */
  setRemaining(remainingMs) {
    const r = Math.max(0, remainingMs);
    this._completed = false;
    if (this._running) {
      this._endAt = this._now() + r;
    } else {
      this._remaining = r;
    }
  }

  /**
   * Starts (or restarts) the countdown from its full duration, emitting an immediate tick so
   * the UI shows the full duration at once.
   * @returns {void}
   */
  start() {
    this._stopLoop();
    this._completed = false;
    this._remaining = this.durationMs;
    this._endAt = this._now() + this.durationMs;
    this._running = true;
    this._tick();
  }

  /**
   * Pauses the countdown, capturing the exact remaining time so resume is lossless. No-op if
   * not running.
   * @returns {void}
   */
  pause() {
    if (!this._running) return;
    this._remaining = Math.max(0, this._endAt - this._now());
    this._stopLoop();
    this._running = false;
  }

  /**
   * Resumes a paused countdown by re-anchoring the target to now + remaining. No-op if already
   * running or completed.
   * @returns {void}
   */
  resume() {
    if (this._running || this._completed) return;
    this._endAt = this._now() + this._remaining;
    this._running = true;
    this._tick();
  }

  /**
   * Hard-stops the countdown without firing onComplete, freezing the remaining time.
   * @returns {void}
   */
  stop() {
    if (this._running) {
      this._remaining = Math.max(0, this._endAt - this._now());
    }
    this._stopLoop();
    this._running = false;
  }

  /**
   * Cancels any scheduled frame.
   * @returns {void}
   */
  _stopLoop() {
    if (this._handle !== null) {
      this._cancel(this._handle);
      this._handle = null;
    }
  }

  /**
   * One frame: emit the clamped remaining, then either complete or schedule the next frame.
   * @returns {void}
   */
  _tick() {
    const remaining = Math.max(0, this._endAt - this._now());
    if (this._onTick) this._onTick(remaining);
    // A tick handler may pause/stop the countdown (e.g. the session waiting at an item boundary);
    // honour that instead of rescheduling another frame.
    if (!this._running) return;
    if (remaining <= 0) {
      this._remaining = 0;
      this._running = false;
      this._completed = true;
      this._stopLoop();
      if (this._onComplete) this._onComplete();
      return;
    }
    this._handle = this._schedule(() => this._tick());
  }
}
