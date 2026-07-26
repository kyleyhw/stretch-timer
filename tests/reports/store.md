# Test Report: Persistence store

- **Module under test:** [`js/store.js`](../../js/store.js) — the `Store` class.
- **Suite:** [`tests/store.test.js`](../store.test.js), run with `node --test`.
- **Date:** 2026-07-26
- **Result:** 6 / 6 passed, 0 failed. (Full repository suite: 40 / 40.)
- **Runtime:** ~95 ms for the `node --test tests/store.test.js` process, 6 subtests, each < 1 ms.
- **Static analysis:** `npm run typecheck` passes with no diagnostics.

## What was tested and why

The store must never crash the app: private-browsing mode and quota-exceeded errors are common,
and losing the ability to read this session's own writes would be a data-loss bug. A fake backend
is injected (Node has no `localStorage`) so every branch — working, absent, and throwing — is
covered deterministically.

| #   | Test                                           | Why (property verified)                                             | Inputs / rationale                                                                      |
| --- | ---------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | Round-trips routines; merges settings          | Serialization is lossless; settings load merges over defaults       | Save one routine and partial settings; read back and check the merge fills missing keys |
| 6   | Round-trips user stretches                     | The custom-stretch library persists losslessly (M3)                 | Save one custom stretch (per-side); read back and compare                               |
| 2   | Writes schema meta on init                     | Version marker is present for future migrations                     | Fresh store; read `meta`                                                                |
| 3   | Non-persistent but usable with no backend      | App still works when `localStorage` is unavailable                  | `new Store(null)`; write then read in-session                                           |
| 4   | Memory fallback when writes throw              | A quota error degrades to in-memory, and `persistent` reports false | Backend whose `setItem` always throws; write then read                                  |
| 5   | `getJSON` returns the fallback on corrupt data | Malformed stored JSON never throws                                  | Pre-seed the key with `'{ not valid json'`                                              |

### Test-data rationale

Three backend doubles isolate the branches: a working `Map`-backed store (happy path), `null`
(no storage), and a throwing `setItem` (quota). Case 4 verifies the design point that reads are
**memory-first**, so data written after a backend failure remains readable for the session — the
constructor's own meta write already fails there, which is why `persistent` is false from the
start. Case 5 uses deliberately truncated JSON to confirm `JSON.parse` failures are swallowed.

## Failures

None at test time. During development the memory-first read fix (§ case 4) was made after writing
the test exposed that a quota-throwing backend would otherwise hide this session's writes; the
`getRaw` lookup was changed to consult the in-memory mirror before the backend.
