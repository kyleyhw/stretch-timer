# Stretch Timer

A guided stretching-timer PWA that counts down each stretch hold with audio and haptic cues.
Built as a dependency-free, installable web app that runs offline on desktop and mobile, with
the goal of removing the friction of timing a stretching routine by hand.

> Status: in active development. See [`PROJECT_PLAN.md`](PROJECT_PLAN.md) for phase-by-phase progress.

## What it does

Pick a routine; the app auto-cycles through each stretch, showing a large countdown, a short
"get ready" prep interval, and overall progress ("Stretch 3 of 12"). It beeps and vibrates
when a hold ends, handles per-side stretches (hold one side, switch, hold the other), and
supports pause / resume / skip / back. It ships with a curated library of stretches and lets
you build and save your own routines locally.

## Design decisions

| Decision    | Choice                  | Rationale                                                       |
| ----------- | ----------------------- | --------------------------------------------------------------- |
| Platform    | Vanilla JS PWA          | One codebase for desktop + mobile; installable; offline.        |
| Build step  | None                    | Native ES modules; GitHub Pages serves authored files verbatim. |
| Types       | JSDoc + `tsc --checkJs` | Static checking without transpilation.                          |
| Persistence | `localStorage`          | No backend; user routines stay on-device.                       |

## Directory structure

```
stretch-timer/
├── PROJECT_PLAN.md          # phased development plan (status-tagged)
├── README.md
├── package.json             # dev deps: typescript, prettier; npm scripts
├── tsconfig.base.json       # shared strict compiler options
├── tsconfig.json            # app type-check project (DOM lib)
├── .prettierrc.json         # formatter config
├── .pre-commit-config.yaml  # detect-secrets + tsc + prettier gate
├── .secrets.baseline        # detect-secrets audited baseline
├── .gitignore
├── .nojekyll                # disable Jekyll on GitHub Pages
├── index.html               # single entry; views render into <main>
├── manifest.webmanifest     # PWA manifest (relative start_url/scope)
├── sw.js                    # service worker (offline app-shell cache)
├── css/
│   └── styles.css
├── js/
│   ├── app.js               # bootstrap + service-worker registration
│   ├── router.js            # hash-based view switching
│   ├── timer.js             # drift-free countdown engine
│   ├── session.js           # routine → steps state machine
│   ├── cues.js              # audio beep, vibration, wake lock
│   ├── store.js             # versioned localStorage
│   ├── data.js              # built-in ⊕ user routine merge
│   ├── seed.js              # built-in stretch/routine library
│   ├── ui.js                # small DOM helpers
│   └── views/               # home, routineDetail, player, editor, settings
├── icons/                   # 192 / 512 / maskable / apple-touch
├── docs/                    # architecture + mathematical documentation
└── tests/                   # node:test suites and markdown reports
```

## Documentation index

- [`docs/index.md`](docs/index.md) — documentation hub
- `docs/architecture.md` — module structure and view routing _(forthcoming)_
- `docs/timer-math.md` — drift-free countdown derivation _(forthcoming)_
- `docs/data-model.md` — stretch/routine schema and session expansion _(forthcoming)_

## Core logic and mathematics

The correctness core is the **countdown engine**. Rather than decrementing a counter each frame
(which accumulates timing jitter), remaining time is computed from a fixed target timestamp.
Let a phase have duration $D$ and let $\tau(\cdot)$ be a monotonic clock (`performance.now()`).
Fixing the target at phase start $\tau_0$ as $T = \tau_0 + D$, each frame at clock value $\tau$
reads

$$r(\tau) = T - \tau, \qquad \text{displayed seconds} = \left\lceil r(\tau)/1000 \right\rceil.$$

Because $r$ depends only on the fixed $T$ and the current reading, the instantaneous error is
bounded by one frame interval and does not accumulate. The full derivation, the pause/resume
invariant, the progress fraction, and background-tab reconciliation are documented in
[`docs/timer-math.md`](docs/timer-math.md).

## Development

```bash
npm install            # dev tooling (typescript, prettier)
npm run typecheck      # tsc --checkJs --noEmit over js/
npm test               # node:test unit suites
npm run format         # prettier --write

pre-commit install     # enable the commit-time quality gate
python3 -m http.server # serve locally at http://localhost:8000 (SW + ES modules need a server)
```

`file://` will not work (ES-module CORS and no service worker) — always use a local server. To
reproduce the GitHub Pages subpath, serve the parent directory and browse to
`http://localhost:8000/stretch-timer/`.
