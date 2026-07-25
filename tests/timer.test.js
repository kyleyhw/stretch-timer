/**
 * @file Unit tests for the drift-free countdown engine (js/timer.js).
 *
 * The engine is driven by an injected clock and manual frame scheduler, so every test is
 * deterministic and runs in zero wall-clock time — no real timers, no flakiness.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Countdown } from '../js/timer.js';
import { simulateDrift } from './figures/drift-model.js';

/**
 * A controllable clock plus a manual frame scheduler for driving {@link Countdown}.
 * `advance`/`setTime` move virtual time; `frame` runs the pending frame callbacks once.
 * @param {number} [start]
 */
function makeHarness(start = 0) {
  let t = start;
  /** @type {Map<number, () => void>} */
  const pending = new Map();
  let nextHandle = 1;
  return {
    /** @type {() => number} */
    now: () => t,
    /** @type {(cb: () => void) => number} */
    schedule: (cb) => {
      const h = nextHandle++;
      pending.set(h, cb);
      return h;
    },
    /** @type {(h: number) => void} */
    cancel: (h) => {
      pending.delete(h);
    },
    /** @param {number} dt */
    advance: (dt) => {
      t += dt;
    },
    /** @param {number} v */
    setTime: (v) => {
      t = v;
    },
    /** Run every currently-pending frame callback once. */
    frame: () => {
      const cbs = [...pending.values()];
      pending.clear();
      for (const cb of cbs) cb();
    },
    pendingCount: () => pending.size,
  };
}

test('remainingMs is a pure function of the clock (no accumulation)', () => {
  const h = makeHarness();
  const cd = new Countdown(30_000, {}, h);
  cd.start();
  assert.equal(cd.remainingMs(), 30_000);
  h.advance(10_000);
  assert.equal(cd.remainingMs(), 20_000);
  h.advance(19_999);
  assert.equal(cd.remainingMs(), 1);
  h.advance(5_000); // past the end -> clamped, never negative
  assert.equal(cd.remainingMs(), 0);
});

test('remainingSeconds uses ceil: full duration at start, zero only at the end', () => {
  const h = makeHarness();
  const cd = new Countdown(30_000, {}, h);
  cd.start();
  assert.equal(cd.remainingSeconds(), 30);
  h.advance(1); // 29_999 ms left
  assert.equal(cd.remainingSeconds(), 30);
  h.advance(999); // 29_000 ms left
  assert.equal(cd.remainingSeconds(), 29);
  h.setTime(29_999); // 1 ms left
  assert.equal(cd.remainingSeconds(), 1);
  h.setTime(30_000); // exactly 0 ms left
  assert.equal(cd.remainingSeconds(), 0);
});

test('onTick emits clamped, monotonically non-increasing remaining each frame', () => {
  const h = makeHarness();
  /** @type {number[]} */
  const ticks = [];
  const cd = new Countdown(5_000, { onTick: (r) => ticks.push(r) }, h);
  cd.start(); // immediate tick at 5000
  for (const dt of [200, 50, 900, 1000, 3000, 1000]) {
    h.advance(dt);
    h.frame();
  }
  assert.equal(ticks[0], 5_000);
  for (let i = 1; i < ticks.length; i++) {
    assert.ok(
      ticks[i] <= ticks[i - 1],
      `tick ${i} (${ticks[i]}) not <= previous (${ticks[i - 1]})`,
    );
    assert.ok(ticks[i] >= 0, 'tick must be clamped >= 0');
  }
  assert.equal(ticks.at(-1), 0);
});

test('onComplete fires exactly once when the countdown reaches zero', () => {
  const h = makeHarness();
  let completes = 0;
  const cd = new Countdown(1_000, { onComplete: () => completes++ }, h);
  cd.start();
  h.advance(600);
  h.frame();
  assert.equal(completes, 0);
  assert.equal(cd.completed, false);
  h.advance(600); // now past 1000
  h.frame();
  assert.equal(completes, 1);
  assert.equal(cd.completed, true);
  h.advance(1_000); // extra frames must not re-fire
  h.frame();
  assert.equal(completes, 1);
});

test('pause captures exact remaining; resume is lossless across an idle gap', () => {
  const h = makeHarness();
  const cd = new Countdown(30_000, {}, h);
  cd.start();
  h.advance(10_000);
  cd.pause();
  assert.equal(cd.running, false);
  assert.equal(cd.remainingMs(), 20_000);
  h.advance(100_000); // real time passes while paused
  assert.equal(cd.remainingMs(), 20_000); // unchanged
  cd.resume();
  assert.equal(cd.running, true);
  h.advance(5_000);
  assert.equal(cd.remainingMs(), 15_000);
});

test('total real running time equals the duration despite pauses', () => {
  const h = makeHarness();
  let completes = 0;
  const cd = new Countdown(10_000, { onComplete: () => completes++ }, h);
  cd.start();
  h.advance(4_000);
  cd.pause();
  h.advance(60_000); // paused: does not count
  cd.resume();
  h.advance(6_000); // 4000 + 6000 = 10000 ms of running time
  h.frame();
  assert.equal(completes, 1);
  assert.equal(cd.remainingMs(), 0);
});

test('stop freezes remaining and suppresses onComplete', () => {
  const h = makeHarness();
  let completes = 0;
  const cd = new Countdown(5_000, { onComplete: () => completes++ }, h);
  cd.start();
  h.advance(2_000);
  cd.stop();
  assert.equal(cd.remainingMs(), 3_000);
  h.advance(10_000);
  h.frame();
  assert.equal(completes, 0);
  assert.equal(cd.remainingMs(), 3_000);
});

test('constructor rejects a negative duration', () => {
  assert.throws(() => new Countdown(-1), RangeError);
});

test('drift-free engine tracks true time under jitter; naive decrement does not', () => {
  const series = simulateDrift({ durationSec: 300, seed: 0x9e3779b9 });
  const n = series.tick.length;

  // Reproduce the timestamp arm with the real engine: set the clock to each sampled real time
  // and read the display. It must equal the model's timestamp series exactly, proving the
  // engine implements the drift-free formula r = T - now.
  const h = makeHarness();
  const cd = new Countdown(300_000, {}, h);
  cd.start();
  for (let k = 0; k < n; k++) {
    h.setTime(series.elapsedRealMs[k]);
    assert.equal(
      cd.remainingSeconds() * 1000,
      series.tsRemainingMs[k],
      `engine disagrees with drift-free model at tick ${k}`,
    );
  }

  // Timestamp error stays within one second (pure ceil rounding), bounded regardless of ticks.
  const tsMax = Math.max(...series.tsAbsErrorMs);
  assert.ok(tsMax < 1000, `timestamp error should be sub-second, got ${tsMax} ms`);

  // Naive error accumulates past two seconds by the end and never self-corrects.
  const naiveFinal = series.naiveAbsErrorMs.at(-1) ?? 0;
  assert.ok(naiveFinal > 2000, `naive error should exceed 2 s, got ${naiveFinal} ms`);
  for (let k = 1; k < n; k++) {
    assert.ok(
      series.naiveAbsErrorMs[k] >= series.naiveAbsErrorMs[k - 1] - 1e-9,
      `naive error decreased at tick ${k} (not monotonic)`,
    );
  }
});
