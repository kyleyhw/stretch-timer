# Project Development Plan

This document outlines the planned phases and tasks for developing **Stretch Timer**, a
guided stretching-timer Progressive Web App (PWA). Status tags are updated immediately upon
task completion.

**Legend:** `[pending]` · `[in-progress]` · `[completed]`

Fixed engineering decisions (rationale in [`docs/`](docs/index.md)):

- Dependency-free vanilla JS + native browser ES modules; **no build step** (shipped files are
  the authored files, served verbatim by GitHub Pages).
- Static typing via **JSDoc annotations** checked by `tsc --checkJs --noEmit` (TypeScript 7).
- Quality gate: `pre-commit` running `detect-secrets`, `tsc`, and Prettier.
- Unit tests for pure-logic modules via the Node built-in test runner (`node:test`); markdown
  reports with runtimes in [`tests/reports/`](tests/reports/).

---

## Phase 0: Repository setup & tooling

1. [completed] Verify toolchain (Node, npm, `tsc`, `pre-commit`, `detect-secrets`) and sync with remote.
2. [completed] `package.json` (dev deps `typescript`, `prettier`; scripts), `tsconfig.base.json` + `tsconfig.json` (`checkJs`, `noEmit`, `strict`), `.prettierrc.json`.
3. [completed] `.gitignore` (`.env`, `.DS_Store`, `node_modules/`) and `.nojekyll` before first commit.
4. [completed] `.pre-commit-config.yaml` (`detect-secrets` + `.secrets.baseline`, local `tsc` + Prettier hooks).
5. [completed] Seed `PROJECT_PLAN.md`, `README.md`, `docs/index.md`, `tests/reports/`; validate `pre-commit run --all-files`; initial commit + push.

## Phase 1: Timer engine (correctness core)

6. [completed] `docs/timer-math.md`: derive drift-free countdown, pause/resume invariant, `Math.ceil` display rule.
7. [completed] `js/timer.js` — timestamp-based countdown engine, JSDoc-typed.
8. [completed] `tests/timer.test.js` (`node:test`): accuracy, monotonicity, pause/resume; drift visualization vs. naive decrement.
9. [completed] `tests/reports/timer.md` (runtime, what/why/data rationale); typecheck + tests green; commit + push.

## Phase 2: Session state machine

10. [completed] `docs/data-model.md`: routine→steps expansion, per-side flow, progress fraction, background reconciliation.
11. [completed] `js/session.js` — step expansion + state machine (prep/hold/switch/skip/reconcile), JSDoc-typed.
12. [completed] `tests/session.test.js` + `tests/reports/session.md`; typecheck + tests green; commit + push.

## Phase 3: App shell & player UI

13. [completed] `index.html`, `css/styles.css` (mobile-first, safe-area), `js/router.js` (hash), `js/ui.js`, `js/app.js`.
14. [completed] `js/views/player.js` wired to `session` + `timer` against a hardcoded routine; manual verification (Playwright); commit + push.

## Phase 4: Built-in content & browsing

15. [completed] `js/seed.js` (25 stretches, 4 routines) and `js/data.js` (built-in ⊕ user merge, id resolution).
16. [completed] `js/views/home.js`, `js/views/routineDetail.js` → launch real sessions; commit + push.

## Phase 5: Cues & minimal settings

17. [completed] `js/cues.js` — Web Audio unlock on Start, audio-clock-scheduled end beep + count-in ticks, `navigator.vibrate`, Screen Wake Lock (all feature-detected).
18. [completed] Settings view (`js/views/settings.js`) + `js/settings.js` (prep/switch/sound/count-in/vibration/keep-awake); verified in Chromium (audio unlock, applied settings, no errors); commit + push.

## Phase 6: Editor & persistence

19. [completed] `js/store.js` — versioned `localStorage` with in-memory fallback (5 unit tests); wired into `data.js`/`settings.js`.
20. [completed] `js/views/editor.js` — create/edit/reorder/delete user routines; duplicate-to-edit for built-ins; verified persistence + delete in Chromium; commit + push.

## Phase 7: PWA, offline & install

21. [completed] `manifest.webmanifest` (relative `start_url`/`scope`) and icons (192/512/maskable/apple-touch, rendered stopwatch glyph).
22. [completed] `sw.js` cache-first app shell + navigation fallback + versioned cache/update prompt (typed via `tsconfig.sw.json`); registered in `app.js`; verified offline shell + deep link in Chromium; commit + push.

## Phase 8: Polish, accessibility & deploy

23. [completed] Mobile-first responsive layout, ≥44 px targets, ARIA live regions + `progressbar`, `prefers-reduced-motion`, quit-confirm modal, unload guard.
24. [completed] Finalized `docs/` (architecture, timer-math, data-model) and `README.md` (ASCII tree, docs index, math overview, install/deploy) with cross-links.
25. [completed] Added GitHub Pages deploy workflow (`.github/workflows/deploy-pages.yml`); verified relative-path + service-worker scope at the `/stretch-timer/` subpath in Chromium. **Remaining one-time user step:** enable Pages (Settings → Pages → source: GitHub Actions) and merge to the default branch to go live.

## Phase 9: Custom "Climbing" set & per-side blocks (follow-up)

26. [completed] Per-side **block** construct: `SideBlock` type (discriminated union with `StretchRef`), `expandRoutine` grouping (all-left → switch → all-right, one progress unit per hold), editor create/edit UI, detail rendering; 3 unit tests.
27. [completed] Built-in **Climbing** routine — shoulders ×2, standing/seated straddle, groin (frog), supermodel, butterfly, 4 forearm variants, calves, a deep-lunge/hamstring/quad per-side block, and pigeon; 30 s holds. Verified in Chromium that the block plays all-left then all-right (19 units).
28. [pending] Re-author the pre-existing commits to `kyleyhw <kyleyhw@gmail.com>` — blocked by the permission classifier; needs a user-approved allow-rule (or a manual `git rebase --root … && git push --force-with-lease`). New commits already use the correct identity.
