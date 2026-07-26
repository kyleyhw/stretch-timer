# Test Report: Data layer (custom stretches)

- **Module under test:** [`js/data.js`](../../js/data.js) — the built-in ⊕ user stretch merge, the
  `upsert`/`delete` mutators with their persistence sink, and the `stretchInUse` guard.
- **Suite:** [`tests/data.test.js`](../data.test.js), run with `node --test`.
- **Date:** 2026-07-26
- **Result:** 5 / 5 passed, 0 failed. (Full repository suite: 40 / 40.)
- **Runtime:** ~90 ms for the `node --test tests/data.test.js` process, 5 subtests, each < 1 ms.
- **Static analysis:** `npm run typecheck` passes with no diagnostics.

## What was tested and why

Custom stretches let a user extend the library, so the data layer must merge them over the built-ins
without dropping either, keep the merged map consistent after every mutation, and never let a routine
be left pointing at a deleted stretch. The module holds process-wide state (the user library and
routines), so each test first resets that state to a clean slate and installs a no-op persistence
sink; one test swaps in a recording sink to assert persistence fires.

| #   | Test                                        | Why (property verified)                                  | Inputs / rationale                                                       |
| --- | ------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | `makeStretchId` unique, `ustr-` prefix      | Custom ids never collide with built-ins or user routines | Two calls compared; prefix asserted                                      |
| 2   | User stretches merge into map + list        | The custom library extends, not replaces, the built-ins  | Add one custom stretch; assert count +1 and a built-in still resolves    |
| 3   | Upsert adds then updates in place; persists | Editing by id mutates rather than duplicates, and saves  | Upsert id `ustr-1`, then upsert same id with new seconds; sink called ×2 |
| 4   | Delete removes from the merged map          | A deleted custom stretch disappears from every lookup    | Delete then assert `getStretch` null and absent from `getAllStretches`   |
| 5   | `stretchInUse` detects plain and block refs | The delete guard sees every reference shape              | Routine with a block referencing `ustr-1`; `ustr-2` reported unused      |

### Test-data rationale

A single fabricated custom stretch (`ustr-x`, non-per-side) is reused via a factory so each case
starts identically; case 5 additionally builds a user routine whose only item is a **block** so the
in-use scan is proven to descend into blocks (the shape most likely to be missed), while a second,
unreferenced custom stretch confirms the negative case.

## Failures

None.
