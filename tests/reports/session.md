# Test Report: Session state machine

- **Module under test:** [`js/session.js`](../../js/session.js) — `expandRoutine` and `Session`.
- **Suite:** [`tests/session.test.js`](../session.test.js), run with `node --test`.
- **Date:** 2026-07-26
- **Result:** 20 / 20 passed, 0 failed. (Full repository suite: 34 / 34.)
- **Runtime:** 104 ms for the whole `node --test tests/session.test.js` process, 20 subtests;
  every subtest is < 1 ms because the session is driven by a virtual clock — no real time passes
  even for the simulated 83-second routine or the 100-second "hidden tab" gap.
- **Static analysis:** `npm run typecheck` passes with no diagnostics.

## What was tested and why

The session layer is where a routine becomes a sequence of timed steps and where every player
control (advance, skip, pause, quit, background recovery) is defined. Correctness here is what the
user actually experiences as "the app". A fixed two-item routine is used throughout — one plain
stretch (A, 30 s) and one per-side stretch (B, 20 s/side) with 5 s prep and 3 s switch — giving the
step boundaries `0, 5, 35, 40, 60, 63, 83 s`.

| #   | Test                                                            | Why (property verified)                                                 | Inputs / rationale                                                                                 |
| --- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | Plain → `[prep, hold]`; per-side → `[prep, hold, switch, hold]` | Expansion shape and per-side handling                                   | The two-item routine exercises both kinds in one pass                                              |
| 2   | `prepSeconds 0` drops prep; `switchSeconds 0` drops switch      | Zero-duration phases are omitted, not emitted                           | The two boundary settings that change the step count                                               |
| 3   | Unknown stretch id throws                                       | Fail loudly on a dangling reference                                     | An item pointing at a missing id                                                                   |
| 4   | Steps auto-advance in order to completion                       | Whole-timeline progression and completion                               | 1 s/frame across all 83 s (boundaries are 1 s multiples, so each transition is hit exactly)        |
| 5   | Progress fraction monotonic, reaches 1                          | `P = E/S` never regresses                                               | Full run; every tick's fraction recorded                                                           |
| 6   | Stretch number counts distinct stretches                        | Per-side steps share one "N of M"                                       | Checks all four B-steps report stretch 2                                                           |
| 7   | Pause halts ticking; resume lossless                            | Paused wall-time contributes nothing (delegates to the timer invariant) | Pause at 2 s, idle 50 s, resume, +3 s → elapsed 5 s                                                |
| 8   | `next()` skips to next stretch's first step                     | Skip-forward abandons remaining sides                                   | Skip from 10 s into A → lands on prep(B) at 35 s                                                   |
| 9   | `prev()` restarts current stretch when well into it             | Media-player skip-back semantics (> 2 s guard)                          | 70 s in (deep in B) → restart B at 35 s                                                            |
| 10  | `prev()` near a start jumps to previous stretch                 | The other side of the 2 s guard                                         | 0.5 s into B → jumps back to A at 0 s                                                              |
| 11  | `quit()` stops without `onComplete`                             | Abandon must not look like completion                                   | Quit 10 s in, then advance 100 s                                                                   |
| 12  | `reconcile()` lands on the correct step after a hidden gap      | Background recovery via the single-timeline model                       | Advance the clock 40 s with **no frames**, then reconcile → step 3; then past the end → completion |

### Test-data rationale

The two-item routine is the smallest fixture that contains both a plain and a per-side stretch,
which together generate all three step types (`prep`, `hold`, `switch`) and both side values. All
durations are whole seconds so that a 1 s/frame drive lands exactly on every boundary, making the
expected `onStepChange` sequence deterministic. The reconcile test deliberately advances the clock
**without delivering frames** to emulate a backgrounded tab (where `requestAnimationFrame` is
suspended), then verifies a single `reconcile()` call recovers the correct step.

### Per-side block tests (13–15)

Three cases cover the side-block construct (a group performed all-on-one-side, then the other):

| #   | Test                                              | Why                                                                   | Inputs / rationale                                                                 |
| --- | ------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 13  | Block runs all stretches one side, then the other | Grouped-by-side expansion, sides, durations, monotonic per-hold index | Block `[X 30 s, Y 20 s]`, 5 s prep / 3 s switch → prep, X_L, Y_L, switch, X_R, Y_R |
| 14  | Block honours prep/switch = 0                     | Zero-duration phases omitted inside blocks too                        | Same block, prep/switch 0 → four holds only                                        |
| 15  | Session plays block all-left then all-right       | End-to-end order and progress count                                   | 1 s holds; assert `X:left, Y:left, X:right, Y:right` and stretch count 4           |

### Pause-between-stretches tests (16–20)

Five cases cover `Step.itemIndex` and the optional "wait at each routine item" mode (`autoAdvance`
off). The boundary that pauses is a **new routine item**, so a per-side stretch's own prep/hold/sides
and a block's inner holds flow without interruption; only the jump from one item to the next waits.

| #   | Test                                                   | Why (property verified)                                   | Inputs / rationale                                                                        |
| --- | ------------------------------------------------------ | --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 16  | `itemIndex` groups a block; plain items each increment | The pause boundary is per-item, not per-hold              | `a`, block`[x,y]`, `a` → itemIndex `0,0,1,1,1,1,1,1,2,2` vs stretchIndex diverging        |
| 17  | Auto-advance off waits at each item until `proceed()`  | Gate fires on item crossing; clock frozen at the boundary | Play item 0, assert `onWaiting` at 35 s, clock frozen through +50 s, `proceed()` finishes |
| 18  | No wait within one item (per-side / block)             | Left→right inside an item never interrupts                | Single per-side stretch, switch 1 s → plays `hold-L, switch, hold-R`, zero waits          |
| 19  | Auto-advance on (default) plays straight through       | Default behaviour unchanged; `onWaiting` never fires      | Full run, assert 0 waits, 1 completion                                                    |
| 20  | `next()` plays through the gate (explicit navigation)  | A deliberate skip should not drop into the wait state     | Skip from A into B → lands on prep(B) playing, `waiting` false                            |

## Failures

None. One type error caught pre-runtime by `tsc` during development (`Array.at()` returning
`T | undefined` compared with `>=`) was fixed by capturing the value with an explicit fallback
before comparison; all tests then passed.
