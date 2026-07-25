# Architecture

A dependency-free, no-build vanilla-JS PWA. Native ES modules are shipped verbatim; the type
checker (`tsc --checkJs`) and tests run against those same source files. This document maps the
modules and the cross-cutting concerns; the timing math and data model have their own documents
([`timer-math.md`](timer-math.md), [`data-model.md`](data-model.md)).

## Module layers

Dependencies point downward only; nothing lower imports anything higher.

```
                       ┌───────────────────────────┐
   composition         │          app.js           │  routing table, persistence boot,
                       └───────────────────────────┘  service-worker registration
                                     │
        ┌───────────────┬───────────┼───────────────┬────────────────┐
   views │ home.js  routineDetail.js  player.js   editor.js     settings.js
        └───────────────┴───────────┼───────────────┴────────────────┘
                                     │
   services       router.js      ui.js       cues.js        (browser APIs:
   (browser)     (hash routes) (DOM helpers) (audio/haptic/   Web Audio, Vibration,
                                              wake lock)       Wake Lock, localStorage)
                                     │
   domain     session.js ── timer.js      data.js ── seed.js     store.js     settings.js
   (pure,      (state machine)(countdown) (merge/resolve)(library)(persistence)(prefs)
   tested)                         │
                                types.js  (shared JSDoc typedefs, erased at runtime)

   standalone   sw.js  (service worker; classic script, its own WebWorker type-check project)
```

- **Pure/domain layer** (`timer`, `session`, `store`, `data`, `seed`, `settings`, `types`) contains
  no DOM access and is unit-tested with `node:test` under an injected clock/scheduler/backend.
- **Services** wrap browser APIs behind small interfaces: `router` (hash → view), `ui` (`el`,
  `clear`, `fmtClock`, `confirmModal`), `cues` (audio/haptics/wake lock singletons).
- **Views** are `mount*(container, ctx)` functions. `app.js` supplies each view's `ctx` (data +
  navigation callbacks), so views never import the router or the store directly.

## Rendering and routing

- **Hash routing** (`router.js`): `location.hash` → a matched handler. Handlers may return a
  cleanup function, run before the next view mounts. Hash routes need no server rewrites and never
  404 on refresh — important for a GitHub Pages project page.
- **Render-once, mutate-in-place**: most views build their DOM once. The **player** is the hot path
  — it never rebuilds during a session; each frame updates only the countdown text node, the
  progress-bar width/`aria-valuenow`, and the phase/name labels via retained references. Rebuilding
  per frame would thrash layout and risk interrupting the session.

## State and persistence

- Built-in content (`seed.js`) is immutable and compiled in (offline-ready, no fetch). User
  routines live in `localStorage` via `store.js` and are merged with built-ins by `data.js`
  (`getAllRoutines = [...builtin, ...user]`). Editing a built-in performs **duplicate-and-edit**
  into a new `user-<uuid>` routine, keeping the seed pristine.
- `store.js` is versioned (`stretchTimer.v1.*`) and **memory-first**: every read consults an
  in-memory mirror before the backend, so writes remain readable even after a quota/private-mode
  failure (`persistent` then reports false). See [`../tests/reports/store.md`](../tests/reports/store.md).
- Settings load from and save to the store; the whole app reads them through `settings.js`.

## Timing and cues

- A session runs a **single** drift-free `Countdown` spanning the whole routine; the current step
  is derived from elapsed time (see [`data-model.md`](data-model.md)). This makes skipping a seek
  and background reconciliation automatic.
- `cues.js` schedules the end-of-step beep and count-in ticks on the **Web Audio clock**, so they
  fire on time even when the tab is backgrounded. The AudioContext unlocks on the Start gesture and
  resumes on visibility return. Vibration and Screen Wake Lock are feature-detected and degrade to
  no-ops (both hidden in settings where unsupported).

## PWA

- `manifest.webmanifest` uses relative `start_url`/`scope` (`./`) so it is repo-name-agnostic.
- `sw.js` precaches the app shell (every runtime ES module must be listed) and serves cache-first,
  with a `navigate → index.html` fallback for deep links. It is registered as `sw.js` (relative),
  giving it the correct subpath scope on GitHub Pages. Because there is no build hashing, cache
  invalidation is manual: bump `CACHE` on any asset change; an "update available" toast then
  `postMessage`s `SKIP_WAITING` and reloads on `controllerchange`.
- The service worker is type-checked under its own [`tsconfig.sw.json`](../tsconfig.sw.json)
  (WebWorker lib) since its globals differ from the DOM app.

## Verification

- **Unit** (`node --test`): the pure/domain layer — 26 tests across timer, session, and store —
  each deterministic via injected dependencies. Reports in [`../tests/reports/`](../tests/reports/).
- **Integration** (Playwright + the bundled Chromium): the UI flows (home → detail → player,
  settings, editor + persistence) and the PWA (offline shell, deep link) are driven in a real
  browser during development.
