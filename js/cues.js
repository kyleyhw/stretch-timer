/**
 * @file Session cues: audio beeps (Web Audio API), haptics (Vibration API), and a screen wake
 * lock. Exposed as three singletons: `cues`, `haptics`, `wakeLock`.
 *
 * Platform notes:
 * - Web Audio requires the AudioContext to be created/resumed from a user gesture (iOS/Chrome
 *   autoplay policy). Call `cues.unlock()` from the Start tap. The context is suspended when the
 *   page is hidden (iOS), so `cues.resume()` is called again on visibility return.
 * - Beeps and count-in ticks are scheduled on the audio clock, which keeps running while a tab is
 *   backgrounded, so cues fire on time even without frame updates.
 * - The Vibration API is unsupported on iOS Safari; `haptics` feature-detects and no-ops.
 * - Screen Wake Lock is unsupported on some browsers and auto-releases when the page hides, so it
 *   is re-acquired on visibility return; where unsupported it degrades to a no-op.
 */

const END_FREQ = 880; // A5 — end-of-step beep.
const TICK_FREQ = 1320; // higher, softer — count-in ticks.

class AudioCues {
  constructor() {
    /** @type {AudioContext | null} */
    this._ctx = null;
    /** @type {OscillatorNode[]} */
    this._scheduled = [];
    this._enabled = true;
  }

  /** @param {boolean} on @returns {void} */
  setEnabled(on) {
    this._enabled = on;
    if (!on) this.cancel();
  }

  /** @returns {boolean} */
  get ready() {
    return this._ctx !== null;
  }

  /**
   * Create/resume the context from a user gesture and play a silent blip to fully unlock audio on
   * iOS. Safe to call repeatedly.
   * @returns {void}
   */
  unlock() {
    if (!this._ctx) {
      const AC = window.AudioContext ?? /** @type {any} */ (window).webkitAudioContext;
      if (!AC) return;
      this._ctx = new AC();
    }
    void this._ctx.resume();
    this._tone(this._ctx.currentTime, 1, 0.01, 0);
  }

  /** Resume the context after returning from background. @returns {void} */
  resume() {
    void this._ctx?.resume();
  }

  /**
   * @param {number} atTime Audio-clock time (seconds).
   * @param {number} freq
   * @param {number} durSec
   * @param {number} volume 0..1
   * @returns {void}
   */
  _tone(atTime, freq, durSec, volume) {
    if (!this._ctx) return;
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t = Math.max(atTime, ctx.currentTime);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.01);
    gain.gain.linearRampToValueAtTime(0, t + durSec);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + durSec + 0.02);
    this._scheduled.push(osc);
    osc.onended = () => {
      this._scheduled = this._scheduled.filter((o) => o !== osc);
      try {
        gain.disconnect();
      } catch {
        /* already disconnected */
      }
    };
  }

  /** Beep immediately (e.g. on completion). @returns {void} */
  beepNow() {
    if (this._enabled && this._ctx) this._tone(this._ctx.currentTime, END_FREQ, 0.16, 0.2);
  }

  /**
   * Schedule the end-of-step beep and optional count-in ticks on the audio clock. Replaces any
   * previously scheduled cues.
   * @param {number} remainingSec Seconds left in the current step.
   * @param {{ endBeep?: boolean, countIn?: number }} [opts]
   * @returns {void}
   */
  scheduleStep(remainingSec, opts = {}) {
    this.cancel();
    if (!this._enabled || !this._ctx || remainingSec <= 0) return;
    const t0 = this._ctx.currentTime;
    if (opts.endBeep) this._tone(t0 + remainingSec, END_FREQ, 0.16, 0.2);
    const countIn = opts.countIn ?? 0;
    for (let k = 1; k <= countIn; k++) {
      const at = t0 + remainingSec - k;
      if (at > t0 + 0.02) this._tone(at, TICK_FREQ, 0.05, 0.08);
    }
  }

  /** Cancel all scheduled (not-yet-finished) tones. @returns {void} */
  cancel() {
    for (const osc of this._scheduled) {
      try {
        osc.stop();
      } catch {
        /* already stopped */
      }
    }
    this._scheduled = [];
  }
}

class Haptics {
  constructor() {
    this._enabled = true;
  }

  /** @param {boolean} on @returns {void} */
  setEnabled(on) {
    this._enabled = on;
  }

  /** @returns {boolean} */
  get supported() {
    return typeof navigator !== 'undefined' && 'vibrate' in navigator;
  }

  /** @param {number | number[]} pattern @returns {void} */
  buzz(pattern) {
    if (this._enabled && this.supported) {
      try {
        navigator.vibrate(pattern);
      } catch {
        /* ignore */
      }
    }
  }
}

class WakeLock {
  constructor() {
    /** @type {any} */
    this._sentinel = null;
    this._want = false;
  }

  /** @returns {boolean} */
  get supported() {
    return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  }

  /** @returns {Promise<void>} */
  async request() {
    this._want = true;
    if (!this.supported) return;
    try {
      this._sentinel = await /** @type {any} */ (navigator).wakeLock.request('screen');
    } catch {
      /* denied or not visible */
    }
  }

  /** Re-acquire after a visibility change if still wanted. @returns {Promise<void>} */
  async reacquire() {
    if (this._want && !this._sentinel) await this.request();
  }

  /** @returns {Promise<void>} */
  async release() {
    this._want = false;
    try {
      await this._sentinel?.release?.();
    } catch {
      /* ignore */
    }
    this._sentinel = null;
  }
}

export const cues = new AudioCues();
export const haptics = new Haptics();
export const wakeLock = new WakeLock();
