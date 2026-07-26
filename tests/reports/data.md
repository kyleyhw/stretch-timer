# Test Report: Data layer (custom stretches)

- **Module under test:** [`js/data.js`](../../js/data.js) — the built-in ⊕ user stretch merge, the
  `upsert`/`delete` mutators with their persistence sink, and the `stretchInUse` guard.
- **Suite:** [`tests/data.test.js`](../data.test.js), run with `node --test`.
- **Date:** 2026-07-26
- **Result:** 11 / 11 passed, 0 failed. (Full repository suite: 46 / 46.)
- **Runtime:** ~92 ms for the `node --test tests/data.test.js` process, 11 subtests, each < 1 ms.
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

### Share / export tests (6–11)

Six cases cover the share round-trip: a routine plus its referenced custom stretches must survive
encode → link → decode → import on another device, with every id regenerated so imports never
collide with existing content.

| #   | Test                                           | Why (property verified)                                       | Inputs / rationale                                                         |
| --- | ---------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 6   | `encode`/`decode` round-trips (UTF-8 safe)     | base64url survives non-ASCII names (`Café Ω`, `ünïcode`)      | A payload with accented text; deep-equal after a full round-trip           |
| 7   | Payload embeds custom refs, not built-ins      | Only content the recipient lacks travels                      | Routine with a built-in and a custom ref → `stretches` = `[ustr-1]`        |
| 8   | Import regenerates ids, remaps refs, registers | No id collisions; refs (incl. inside blocks) point at new ids | Payload with a block ref to a custom stretch → new ids, built-in untouched |
| 9   | Import rejects an unsupported version          | Forward-compat guard; `v:2` throws rather than corrupts state | `{ v: 2, … }`                                                              |
| 10  | Import drops references it cannot resolve      | A partial/edited payload can't create a routine that crashes  | A `ustr-missing` ref with no embedded stretch → dropped, built-in kept     |
| 11  | Export → import yields an independent copy     | The end-to-end path produces a working, non-aliased routine   | Build → encode → decode → import; ref remapped and resolvable              |

### Test-data rationale

A single fabricated custom stretch (`ustr-x`, non-per-side) is reused via a factory so each case
starts identically; case 5 additionally builds a user routine whose only item is a **block** so the
in-use scan is proven to descend into blocks (the shape most likely to be missed), while a second,
unreferenced custom stretch confirms the negative case. The share tests deliberately include
non-ASCII text (to exercise the UTF-8 → base64url path) and a block-nested reference (the id-remap
path most likely to be missed).

## Failures

None. (During Playwright verification the "fresh device" simulation initially reused the running
app's in-memory library because a hash-only navigation does not reload; the test was corrected to
reboot before importing — the app code was already correct.)
