# Test Report: Countdown timer engine

- **Module under test:** [`js/timer.js`](../../js/timer.js) — the `Countdown` class.
- **Suite:** [`tests/timer.test.js`](../timer.test.js), run with the Node built-in test runner
  (`node --test`).
- **Date:** 2026-07-25
- **Result:** 9 / 9 passed, 0 failed.
- **Runtime:** 99.9 ms total (whole `node --test` process, 9 subtests; each subtest < 1 ms —
  the engine is driven by a virtual clock, so no real time elapses).
- **Static analysis:** `npm run typecheck` (`tsc --checkJs` over both the app and tests
  projects) passes with no diagnostics.

## What was tested and why

The engine is the correctness core of the app: an inaccurate or drifting hold timer defeats the
product's single purpose. Because it is driven by an injected clock and manual frame scheduler,
every case is deterministic and free of wall-clock flakiness.

| #   | Test                                              | Why (property verified)                                                        | Inputs and rationale                                                                                                 |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| 1   | `remainingMs` is a pure function of the clock     | No per-frame accumulation; remaining is always `T − now` (eq. 3.1)             | 30 s countdown probed at t = 0, 10 s, ~30 s, and past the end — covers start, mid, near-zero, and the clamp boundary |
| 2   | `remainingSeconds` uses `ceil`                    | Display shows full duration at start and hits 0 only at the true end (eq. 4.1) | Probes at 30 000, 29 999, 29 000, 1, and 0 ms remaining — the exact points where `ceil` changes integer output       |
| 3   | `onTick` clamped and monotonically non-increasing | Display never jumps backwards or goes negative under irregular frames          | Frame gaps `[200, 50, 900, 1000, 3000, 1000]` ms — deliberately uneven, including a gap that overshoots the end      |
| 4   | `onComplete` fires exactly once                   | No missed or duplicated completion; loop self-cancels                          | 1 s countdown crossed in two 600 ms frames, then extra frames past the end                                           |
| 5   | Pause captures exact remaining; resume lossless   | Pause/resume invariant (§6): paused wall-time contributes nothing              | Pause at 10 s into a 30 s hold, idle 100 s, resume, advance 5 s                                                      |
| 6   | Total running time equals the duration            | Sum of running intervals across a pause equals `D` exactly                     | 4 s run + 60 s paused + 6 s run on a 10 s hold                                                                       |
| 7   | `stop` freezes remaining, suppresses `onComplete` | Quit semantics: no completion cue after an intentional stop                    | Stop 2 s into a 5 s hold, then advance 10 s                                                                          |
| 8   | Constructor rejects negative duration             | Guard against invalid configuration                                            | `new Countdown(-1)` — the one invalid boundary input                                                                 |
| 9   | Drift-free vs. naive under jitter                 | The headline property: bounded error vs. unbounded drift                       | 300 s countdown, seeded jitter `3 + U(0,12)` ms/tick (see below)                                                     |

### Test-data rationale for the drift case (#9)

The 300 s duration is long enough for the naive error to grow visibly past the ±1 s rounding
band. The jitter model `1000 + 3 + U(0, 12)` ms per tick is one-directional (timers fire late,
never early — [HTML spec](https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#timers)),
which is what makes naive drift accumulate rather than average out. The `U(0,12)` term is drawn
from a **seeded** Mulberry32 PRNG (seed `0x9E3779B9`) so the figure and assertions are exactly
reproducible. The test both (a) reproduces the timestamp arm with the real `Countdown` and checks
it equals the analytic drift-free series at every tick, and (b) asserts the naive final error
exceeds 2 s and is monotonically non-decreasing.

## Visualization

![Countdown drift: naive decrement vs. drift-free timestamp](figures/timer-drift.svg)

**Interpretation.** X axis: true elapsed wall-clock time (s). Y axis: the number the user would
see (displayed remaining, s). The **grey** band is the true remaining time; the **blue**
drift-free line lies on top of it throughout; the **red dashed** naive line pulls above and, at
the 300 s mark (when the hold should be over), still reads ≈ 2.7 s. Measured final naive drift in
this run: **2.68 s**. Takeaway: the timestamp formulation keeps the displayed value correct to
sub-second rounding for the whole hold, independent of how many frames elapsed.

## Failures

None. No fixes were required.
