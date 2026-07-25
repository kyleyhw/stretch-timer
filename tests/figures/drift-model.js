/**
 * @file Drift comparison model: a drift-free (timestamp-based) countdown vs. a naive
 * per-tick decrement countdown under realistically jittery scheduling.
 *
 * This is analysis/verification tooling, not part of the shipped app. It is imported by the
 * timer unit test (to assert the drift bound) and by the figure generator (to plot it). The
 * app itself contains no randomness; the seeded PRNG here exists only to make the illustrative
 * latency series reproducible.
 */

/**
 * Mulberry32 PRNG — a small, fast, fully deterministic generator. Seeding makes the simulation
 * reproducible across runs and machines.
 * @param {number} seed 32-bit unsigned seed.
 * @returns {() => number} Function yielding floats uniformly in [0, 1).
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @typedef {object} DriftOptions
 * @property {number} [durationSec] Countdown length in seconds (== number of naive ticks).
 * @property {number} [baseLatencyMs] Fixed per-tick scheduling excess.
 * @property {number} [jitterMs] Maximum additional uniform per-tick excess.
 * @property {number} [seed] PRNG seed.
 */

/**
 * @typedef {object} DriftSeries
 * @property {number[]} tick            Tick index k = 0..durationSec.
 * @property {number[]} elapsedRealMs   True elapsed wall-clock time at tick k.
 * @property {number[]} trueRemainingMs Continuous true remaining time, D - elapsedReal.
 * @property {number[]} naiveRemainingMs Naive display (decrement 1 s/tick), in ms.
 * @property {number[]} tsRemainingMs    Timestamp display ceil((D-elapsed)/1000)*1000.
 * @property {number[]} naiveAbsErrorMs
 * @property {number[]} tsAbsErrorMs
 */

/**
 * Simulate a `durationSec`-second countdown sampled once per naive tick.
 *
 * Scheduling model: a `setInterval(fn, 1000)` seconds counter cannot fire early — the HTML
 * event loop only ever runs a timer callback at or after its deadline. Each real tick therefore
 * takes `1000 + baseLatencyMs + U(0, jitterMs)` ms, a strictly non-negative excess. The naive
 * engine assumes exactly 1000 ms elapsed per tick, so its error is the cumulative excess — a
 * one-directional (always-slow) accumulation. The timestamp engine recomputes from true elapsed
 * time each tick, so its only error is sub-second ceil() rounding.
 *
 * baseLatencyMs/jitterMs are illustrative order-of-magnitude values for a busy main thread, not
 * a measurement of any specific device.
 *
 * @param {DriftOptions} [options]
 * @returns {DriftSeries}
 */
export function simulateDrift(options = {}) {
  const durationSec = options.durationSec ?? 300;
  const baseLatencyMs = options.baseLatencyMs ?? 3;
  const jitterMs = options.jitterMs ?? 12;
  const seed = options.seed ?? 0x9e3779b9; // golden-ratio hash constant; arbitrary fixed seed.

  const durationMs = durationSec * 1000;
  const rand = mulberry32(seed);

  /** @type {number[]} */ const tick = [];
  /** @type {number[]} */ const elapsedRealMs = [];
  /** @type {number[]} */ const trueRemainingMs = [];
  /** @type {number[]} */ const naiveRemainingMs = [];
  /** @type {number[]} */ const tsRemainingMs = [];
  /** @type {number[]} */ const naiveAbsErrorMs = [];
  /** @type {number[]} */ const tsAbsErrorMs = [];

  let elapsed = 0;
  for (let k = 0; k <= durationSec; k++) {
    const trueRemaining = durationMs - elapsed;
    const naiveRemaining = durationMs - k * 1000; // believes exactly 1 s per tick
    const tsRemaining = Math.ceil(Math.max(0, trueRemaining) / 1000) * 1000;

    tick.push(k);
    elapsedRealMs.push(elapsed);
    trueRemainingMs.push(trueRemaining);
    naiveRemainingMs.push(naiveRemaining);
    tsRemainingMs.push(tsRemaining);
    naiveAbsErrorMs.push(Math.abs(naiveRemaining - trueRemaining));
    tsAbsErrorMs.push(Math.abs(tsRemaining - Math.max(0, trueRemaining)));

    // Advance real time by one late-firing tick.
    elapsed += 1000 + baseLatencyMs + rand() * jitterMs;
  }

  return {
    tick,
    elapsedRealMs,
    trueRemainingMs,
    naiveRemainingMs,
    tsRemainingMs,
    naiveAbsErrorMs,
    tsAbsErrorMs,
  };
}
