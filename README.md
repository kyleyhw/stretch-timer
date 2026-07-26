# Stretch Timer

A guided stretching-timer web app: pick a routine and it counts down each stretch with audio and
haptic cues. Installable, works offline, runs on desktop and mobile.

## How to run

- **Hosted:** open `https://kyleyhw.github.io/stretch-timer/` (once GitHub Pages is enabled).
  On mobile, use the browser's _Add to Home Screen_ to install it; it then works offline.
- **Locally:** from the repo root, start any static server and open it in a browser:
  ```bash
  python3 -m http.server 8000   # then open http://localhost:8000
  ```
  A server is required — opening `index.html` as a `file://` won't work (ES modules + service worker).

## How to use

- **Start a routine.** Tap a routine on the home screen to preview its stretches, then **Start**.
- **During a session.** A large countdown shows the time left on the current stretch, with a
  progress bar and "Stretch N of M". It beeps and vibrates at each change. Controls: **⏮** previous,
  **Pause/Resume**, **⏭** skip. Per-side stretches run one side then the other. **✕** quits (with a
  confirm).
- **Make your own.** Tap **+ New routine**, give it a name, and add stretches (set the seconds for
  each). You can add a **per-side block** — a group performed on one side, then the other — and
  reorder or remove items. Edit (**✎**) or duplicate any built-in routine from its page. Your
  routines are saved on your device.
- **Settings (⚙).** Adjust get-ready time, switch-sides time, sound, count-in ticks, vibration, and
  keep-screen-awake.

---

Design notes, architecture, and the timing math are in [`docs/`](docs/index.md).
