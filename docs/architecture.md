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
                       └───────────────────────────┘  theme + service-worker registration
                                     │
     ┌──────────┬──────────────┬─────┼──────┬───────────┬───────────┬────────────┐
 views │ home  routineDetail  player  editor  settings  stretchForm  shareModal
     └──────────┴──────────────┴─────┼──────┴───────────┴───────────┴────────────┘
                                     │
   services   router.js    ui.js         theme.js     cues.js      (browser APIs:
   (browser)  (hash+VT)  (el/svg/icon,  (data-theme, (audio/haptic  Web Audio, Vibration,
                          modals)        theme-color) /wake lock)   Wake Lock, localStorage)
                                     │
   domain    session.js ── timer.js    data.js ── seed.js    store.js    settings.js
   (pure,     (state machine)(countdown)(merge/resolve/     (library)(persistence)(prefs)
   tested)                        │      share/import)
                               types.js  (shared JSDoc typedefs, erased at runtime)

   standalone   sw.js  (service worker; classic script, its own WebWorker type-check project)
```

- **Pure/domain layer** (`timer`, `session`, `store`, `data`, `seed`, `settings`, `types`) contains
  no DOM access and is unit-tested with `node:test` under an injected clock/scheduler/backend.
- **Services** wrap browser APIs behind small interfaces: `router` (hash → view, with View
  Transitions), `ui` (`el`, `svg`, `icon`, `clear`, `fmtClock`, `confirmModal`), `theme` (applies
  the palette via `data-theme` and keeps `theme-color` in sync), `cues` (audio/haptics/wake lock).
- **Views** are `mount*(container, ctx)` functions. `app.js` supplies each view's `ctx` (data +
  navigation callbacks), so views never import the router or the store directly. `stretchForm` and
  `shareModal` are modal sub-views reused by the editor/settings and the detail view.
- **Icons** are a single inline-SVG set (`ui.icon`, `currentColor`), so the whole UI is emoji-free
  and theme-aware.

## Rendering and routing

- **Hash routing** (`router.js`): `location.hash` → a matched handler; a `?key=value` suffix (used
  by import links, `#/import?d=…`) is parsed into the same params object. Handlers may return a
  cleanup function, run before the next view mounts. Hash routes need no server rewrites and never
  404 on refresh — important for a GitHub Pages project page. Route changes cross-fade via the
  **View Transitions API** where supported (skipped under `prefers-reduced-motion`); browsers
  without it fall back to each view's own `view-in` entrance animation.
- **Render-once, mutate-in-place**: most views build their DOM once. The **player** is the hot path
  — it never rebuilds during a session; each frame updates only the countdown text node, the SVG
  ring's `stroke-dashoffset`, and the phase/name labels via retained references. Rebuilding per
  frame would thrash layout and risk interrupting the session.

## State and persistence

- Built-in content (`seed.js`) is immutable and compiled in (offline-ready, no fetch). User
  routines **and** user stretches live in `localStorage` via `store.js` and are merged with
  built-ins by `data.js` (`getAllRoutines = [...builtin, ...user]`; the stretch library likewise
  merges a `ustr-<uuid>` custom set over the built-in map). Editing a built-in performs
  **duplicate-and-edit** into a new `user-<uuid>` routine, keeping the seed pristine. Deleting a
  custom stretch is blocked while any routine references it.
- **Share/export** (`data.js`): a routine plus the custom stretches it references encodes to a
  UTF-8 → base64url payload (`{ v, routine, stretches }`), carried as a `#/import?d=…` link or a
  `.json` file. Import version-checks, regenerates every id (routine + custom stretches, refs
  remapped), and drops unresolvable references, so an import can never collide with or corrupt
  existing content.
- `store.js` is versioned (`stretchTimer.v1.*`) and **memory-first**: every read consults an
  in-memory mirror before the backend, so writes remain readable even after a quota/private-mode
  failure (`persistent` then reports false). See [`../tests/reports/store.md`](../tests/reports/store.md).
- Settings load from and save to the store; the whole app reads them through `settings.js`.

## Timing and cues

- A session runs a **single** drift-free `Countdown` spanning the whole routine; the current step
  is derived from elapsed time (see [`data-model.md`](data-model.md)). This makes skipping a seek
  and background reconciliation automatic.
- `cues.js` schedules the end-of-step beep and count-in ticks on the **Web Audio clock**, so they
  fire on time even when the tab is backgrounded. The AudioContext unlocks on the Start gesture (or
  the in-player unmute) and resumes on visibility return. Sound is **off by default**; because the
  app must be usable silent, every transition also carries a phase-tinted screen flash and a
  vibration. Vibration and Screen Wake Lock are feature-detected and degrade to no-ops.
- **Pause between stretches** is optional (`settings.autoAdvance`): when off, the session freezes at
  each new routine item and waits for a tap. The boundary is keyed to a step's `itemIndex`, so a
  per-side stretch or a block flows uninterrupted and only genuine item changes wait (see
  [`data-model.md`](data-model.md)).

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

- **Unit** (`node --test`): the pure/domain layer — 46 tests across timer, session, store, and data
  — each deterministic via injected dependencies. Reports in [`../tests/reports/`](../tests/reports/).
- **Integration** (Playwright + the bundled Chromium): the UI flows (home → detail → player,
  settings, editor + persistence), the new-feature flows (theme toggle, in-player mute, pause-between
  Continue, custom-stretch create/use/manage, share → clean-boot import), and the PWA (offline
  shell, deep link) are driven in a real browser during development.
