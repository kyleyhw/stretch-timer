# Stretch Timer

A guided stretching-timer web app: pick a routine and it counts down each stretch with audio and
haptic cues. Installable, works offline, runs on desktop and mobile.

**▶ [Open the app](https://kyleyhw.github.io/stretch-timer/)** — live on GitHub Pages.

## How to run

- **Hosted:** open **[kyleyhw.github.io/stretch-timer](https://kyleyhw.github.io/stretch-timer/)**.
  On mobile, use the browser's _Add to Home Screen_ to install it; it then works offline.
- **Locally:** from the repo root, start any static server and open it in a browser:
  ```bash
  python3 -m http.server 8000   # then open http://localhost:8000
  ```
  A server is required — opening `index.html` as a `file://` won't work (ES modules + service worker).

## How to use

- **Start a routine.** Tap a routine on the home screen to preview its stretches, then **Start**.
- **During a session.** A circular countdown ring shows the time left on the current stretch, with
  "Stretch N of M". Each change flashes the screen and vibrates, and beeps too if sound is on (the
  mute button is in the top corner — sound is off by default). Controls: previous, Pause/Resume,
  skip. Per-side stretches run one side then the other; the close button quits (with a confirm).
- **Make your own.** Tap **New routine**, give it a name, and add stretches (set the seconds for
  each). **New stretch** creates your own custom stretch (name, area, per-side); you can also add a
  **per-side block** — a group performed on one side, then the other — and reorder or remove items.
  Edit or duplicate any built-in routine from its page. Everything is saved on your device.
- **Share a routine.** Open a routine and tap **Share** to copy a link or download a `.json` file;
  opening a shared link (or **Import a routine** in Settings) adds a copy, custom stretches included.
- **Settings.** Choose a theme (Dark / Light / System — dark by default), turn **Pause between
  stretches** on to advance by tapping, adjust get-ready and switch-sides time, sound, count-in
  ticks, vibration, and keep-screen-awake, and manage your custom stretches.

---

Design notes, architecture, and the timing math are in [`docs/`](docs/index.md).
