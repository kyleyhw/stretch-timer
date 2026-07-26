# Data Model and Session Expansion

This document specifies the domain schema, the layout used for on-device persistence, and the
mathematics of the session state machine in [`js/session.js`](../js/session.js). Type definitions
live in [`js/types.js`](../js/types.js).

## 1. Domain schema

A **stretch** is a library entry; a **routine** is an ordered list of references to stretches with
(optionally overridden) hold durations.

```jsonc
// Stretch
{ "id": "hamstring-standing", "name": "Standing Hamstring Stretch",
  "area": "Hamstrings", "description": "Hinge at the hips…",
  "defaultSeconds": 30, "perSide": false }

// Routine
{ "id": "post-run-lower", "name": "Post-run lower body", "description": "…",
  "builtIn": true,
  "items": [ { "stretchId": "hamstring-standing", "seconds": 30 }, … ] }
```

A routine references stretches **by id**; each item may override the hold `seconds` while
`perSide` remains a property of the stretch. Ids are namespaced — built-ins use human slugs, user
content uses `user-<uuid>` — so the two never collide.

## 2. Persistence layout (localStorage)

Built-in content is compiled into [`js/seed.js`](../js/seed.js) (Phase 4) and is **never
mutated**. User content lives only in `localStorage` under versioned, namespaced keys (finalised
in Phase 6):

| Key                            | Value                                        |
| ------------------------------ | -------------------------------------------- |
| `stretchTimer.v1.userRoutines` | `Routine[]` with `builtIn: false`            |
| `stretchTimer.v1.settings`     | `{ prepSeconds, switchSeconds, sound, … }`   |
| `stretchTimer.v1.meta`         | `{ schemaVersion: 1 }` for future migrations |

Editing a built-in performs **duplicate-and-edit** — a deep copy into `userRoutines` with a fresh
id — so seed content stays pristine and upgradeable across releases.

## 3. Session expansion

`expandRoutine(routine, stretchById, settings)` flattens a routine into an ordered list of timed
**steps**. Let $p$ = `prepSeconds`, $w$ = `switchSeconds` (each in seconds; a value of $0$
suppresses that step). For routine item $i$ referencing a stretch with hold $h_i$ seconds:

| Stretch kind | Expanded steps (in order)                                                           |
| ------------ | ----------------------------------------------------------------------------------- |
| plain        | $[\text{prep}(p)]?,\ \text{hold}(h_i)$                                              |
| per-side     | $[\text{prep}(p)]?,\ \text{hold}_L(h_i),\ [\text{switch}(w)]?,\ \text{hold}_R(h_i)$ |

Every step carries its owning `stretchIndex` $= i$, so per-side holds all report the same "stretch
$N$ of $M$" even though they are three or four steps.

## 4. Progress and the single-timeline model

Let the expansion produce steps with durations $d_0, \dots, d_{L-1}$ and cumulative boundaries

$$ C_0 = 0, \qquad C_j = \sum_{k<j} d_k, \qquad S = C_L \ \text{(total session length)}. $$

The session runs **one** [`Countdown`](../js/timer.js) of length $S$ (not one per step). Its
drift-free remaining $r$ gives the elapsed running time directly:

$$ E = S - r, \qquad r = \max(0,\, T - \tau) \quad\text{(from timer-math §3)}. $$

From a single quantity $E$ the entire display is derived:

$$
j^\*(E) = \max\{\, j : C_j \le E \,\}, \qquad
\rho_{\text{step}} = C_{j^\*+1} - E, \qquad
P = \frac{E}{S} \in [0,1],
$$

where $j^\*$ is the current step (capped at $L-1$), $\rho_{\text{step}}$ is the countdown shown for
that step, and $P$ drives the progress bar. The displayed "stretch number" is
$\text{stretchIndex}(j^\*) + 1$, and $M$ is the number of distinct `stretchIndex` values. Because
$P$ and $j^\*$ are pure functions of $E$, progress is monotonic non-decreasing by construction
(asserted in [`tests/session.test.js`](../tests/session.test.js)).

## 5. Background reconciliation — for free

Since $E = S - r$ and $r$ is recomputed from the monotonic clock on every read, `reconcile()`
simply re-evaluates $j^\*(E)$ at the current instant. When the tab was hidden — pausing
`requestAnimationFrame` — a single forced tick on `visibilitychange → visible` lands on the correct
step no matter how long the gap was; if $E \ge S$, the countdown fires completion on its next
frame. No separate catch-up bookkeeping is required — this is the payoff of the single-timeline
model over one-countdown-per-step.

## 6. Skip semantics

Skipping is a **seek** on the session timeline, i.e. `Countdown.setRemaining(S - E_{\text{target}})`:

- **next** → $E_{\text{target}} = C_{\text{first step of stretch } (i+1)}$ (past the last stretch,
  the session finishes);
- **prev** → if $E - C_{\text{first step of stretch } i} > 2000$ ms, restart the current stretch
  ($E_{\text{target}} = C_{\text{first step of stretch } i}$); otherwise jump to
  $C_{\text{first step of stretch } (i-1)}$.

The $2000$ ms guard mirrors the familiar media-player behaviour: skip-back restarts the current
item, but a second quick skip-back goes to the previous one.

## 7. Per-side blocks

A routine item may be a **side block**: an ordered group of stretches performed together on one
side, then repeated on the other, rather than switching sides within each stretch. A block
$[A, B, C]$ expands to

$$[\text{prep}?,\ A_L, B_L, C_L,\ \text{switch}?,\ A_R, B_R, C_R],$$

all of side $L$ then all of side $R$, with a single get-ready before the block and one switch
between sides. The block drives the sides, so each sub-stretch's own `perSide` flag is ignored
inside it.

Unlike a plain per-side stretch — whose $L$/$R$ holds share one $\text{stretchIndex}$ because they
run back-to-back — each block hold is temporally separate, so **each hold gets its own
$\text{stretchIndex}$** from the running unit counter. Progress numbering stays monotonic
($A_L, B_L, C_L$ at units $u, u{+}1, u{+}2$; $A_R, B_R, C_R$ at $u{+}3, u{+}4, u{+}5$) and skip
navigates hold-by-hold. For a routine with no blocks the counter equals the item index, so all
earlier behaviour is unchanged.

The data shape is a discriminated union: a routine item is either a `StretchRef`
(`{ stretchId, seconds }`) or a `SideBlock` (`{ block: StretchRef[] }`), distinguished at runtime by
`'block' in item`. See [`js/types.js`](../js/types.js), the expansion in
[`js/session.js`](../js/session.js), and the block tests in
[`tests/session.test.js`](../tests/session.test.js). The built-in **Climbing** routine
([`js/seed.js`](../js/seed.js)) uses a block for its deep-lunge / hamstring / quad trio.
