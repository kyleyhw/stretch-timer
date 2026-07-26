/**
 * @file Session player view. Renders the static structure once and mutates only the changing
 * nodes (ring arc, countdown number, labels) each frame.
 *
 * The centrepiece is an SVG ring that encloses the countdown: a faint track with an accent arc that
 * depletes as the step counts down (`stroke-dashoffset` updated every tick, so skips/seeks are
 * instant). Transitions carry three parallel cues so the app is usable on silent: a phase-tinted
 * screen flash, a vibration, and — only when sound is on — an audio beep scheduled on the audio
 * clock (see js/cues.js) so it survives a backgrounded tab. The final three seconds of a hold pulse
 * the ring and number; a header button mutes/unmutes live.
 */

import { el, svg, clear, fmtClock, confirmModal } from '../ui.js';
import { Session } from '../session.js';
import { cues, haptics, wakeLock } from '../cues.js';

/** @typedef {import('../types.js').Routine} Routine */
/** @typedef {import('../types.js').Step} Step */
/** @typedef {import('../settings.js').AppSettings} AppSettings */

/**
 * @typedef {object} PlayerContext
 * @property {Routine} routine
 * @property {Step[]} steps Expanded step list (see expandRoutine).
 * @property {AppSettings} settings
 * @property {(patch: Partial<AppSettings>) => void} onSettingsChange Persist a live setting change.
 * @property {() => void} onExit Called to leave the player (quit or finish).
 */

const RING_R = 46;
const RING_C = 2 * Math.PI * RING_R;

/**
 * Mount the player. Returns a cleanup that stops the session and releases cues/wake lock.
 * @param {HTMLElement} container
 * @param {PlayerContext} ctx
 * @returns {() => void}
 */
export function mountPlayer(container, ctx) {
  clear(container);
  // Local, mutable copy so the in-player mute button can flip `sound` without touching the shared
  // settings object; persistence goes through ctx.onSettingsChange.
  const settings = { ...ctx.settings };

  const routineName = el('span', { class: 'routine-name', text: ctx.routine.name });
  const muteBtn = el('button', { class: 'icon-btn', 'aria-label': 'Toggle sound' });
  const quitBtn = el('button', { class: 'icon-btn', 'aria-label': 'Quit', text: '✕' });

  const stretchName = el('h1', { class: 'stretch-name', 'aria-live': 'polite' });
  const stretchDesc = el('p', { class: 'stretch-desc' });
  const progressCount = el('span', { class: 'progress-count', 'aria-live': 'polite' });
  const phaseLabel = el('p', { class: 'phase-label', 'aria-live': 'polite' });
  const countdown = el('div', {
    class: 'countdown',
    role: 'timer',
    'aria-live': 'off',
    text: '--',
  });

  const ringArc = svg('circle', {
    class: 'ring-arc',
    cx: '50',
    cy: '50',
    r: String(RING_R),
    'stroke-dasharray': String(RING_C),
    'stroke-dashoffset': '0',
  });
  const ringCenter = el('div', { class: 'ring-center' }, phaseLabel, countdown);
  const ringWrap = el(
    'div',
    { class: 'ring-wrap' },
    svg(
      'svg',
      { class: 'ring', viewBox: '0 0 100 100', 'aria-hidden': 'true' },
      svg('circle', { class: 'ring-track', cx: '50', cy: '50', r: String(RING_R) }),
      ringArc,
    ),
    ringCenter,
  );

  const prevBtn = el('button', { class: 'ctrl-btn', 'aria-label': 'Previous stretch', text: '⏮' });
  const toggleBtn = el('button', { class: 'ctrl-btn primary', text: 'Pause' });
  const nextBtn = el('button', { class: 'ctrl-btn', 'aria-label': 'Skip stretch', text: '⏭' });
  const controls = el('div', { class: 'controls' }, prevBtn, toggleBtn, nextBtn);

  const view = el(
    'section',
    { class: 'view view-player' },
    el(
      'header',
      { class: 'player-header' },
      routineName,
      el('div', { class: 'player-header-actions' }, muteBtn, quitBtn),
    ),
    el('div', { class: 'player-stage' }, stretchName, ringWrap, stretchDesc, progressCount),
    controls,
  );
  container.append(view);

  // Full-screen phase-tinted flash — the primary "something changed" cue when muted.
  const flash = el('div', { class: 'flash', 'aria-hidden': 'true' });
  document.body.append(flash);

  cues.setEnabled(settings.sound);
  haptics.setEnabled(settings.vibration);
  if (settings.keepAwake) void wakeLock.request();

  let cueStep = -1;
  let shownSecs = -1;

  /** @param {Step['type']} type */
  function flashPhase(type) {
    flash.style.background = `var(--${type})`;
    flash.classList.remove('flash-on');
    void flash.offsetWidth; // reflow so the animation restarts on a rapid re-trigger
    flash.classList.add('flash-on');
  }

  function tickNumber() {
    countdown.classList.remove('is-tick');
    void countdown.offsetWidth;
    countdown.classList.add('is-tick');
  }

  function renderMute() {
    muteBtn.textContent = settings.sound ? '🔊' : '🔇';
    muteBtn.setAttribute('aria-pressed', String(settings.sound));
    muteBtn.classList.toggle('is-active', settings.sound);
  }
  renderMute();

  const session = new Session(ctx.steps, {
    onStepChange: (step, info, prev) => {
      view.dataset.phase = step.type;
      phaseLabel.textContent = step.label;
      stretchName.textContent = step.stretchName;
      stretchDesc.textContent = step.type === 'hold' ? step.stretchDescription : '';
      progressCount.textContent = `Stretch ${info.stretchNumber} of ${info.stretchCount}`;
      shownSecs = -1; // force the countdown text to refresh on the next tick
      ringWrap.classList.remove('is-countin');
      if (prev) {
        flashPhase(step.type);
        haptics.buzz(prev.type === 'hold' ? 60 : 25);
      }
    },
    onTick: (remMs, step, info) => {
      // Ring depletion: full at the start of a step, empty at its end. Updated every frame for
      // smooth motion; because there is no CSS transition on the offset, skips/seeks jump instantly.
      const frac = step.durationMs > 0 ? Math.max(0, Math.min(1, remMs / step.durationMs)) : 0;
      ringArc.setAttribute('stroke-dashoffset', String(RING_C * (1 - frac)));

      const secs = Math.ceil(remMs / 1000);
      if (secs !== shownSecs) {
        shownSecs = secs;
        countdown.textContent = fmtClock(secs);
        const counting = step.type === 'hold' && secs >= 1 && secs <= 3;
        ringWrap.classList.toggle('is-countin', counting);
        if (!counting) tickNumber();
      }

      if (info.stepIndex !== cueStep) {
        cueStep = info.stepIndex;
        cues.scheduleStep(remMs / 1000, {
          endBeep: settings.sound,
          countIn: settings.sound && settings.countIn && step.type === 'hold' ? 3 : 0,
        });
      }
    },
    onPauseChange: (paused) => {
      toggleBtn.textContent = paused ? 'Resume' : 'Pause';
      view.dataset.paused = String(paused);
      if (paused) cues.cancel();
      else cueStep = -1; // force a reschedule on the next tick
    },
    onComplete: () => {
      showComplete();
      cues.beepNow();
      haptics.buzz([60, 40, 60]);
      void wakeLock.release();
    },
    onQuit: () => {
      cues.cancel();
      void wakeLock.release();
      ctx.onExit();
    },
  });

  function showComplete() {
    view.dataset.phase = 'done';
    ringWrap.classList.remove('is-countin');
    ringArc.setAttribute('stroke-dashoffset', '0'); // ring full to celebrate completion
    phaseLabel.textContent = 'Complete';
    stretchName.textContent = 'All done';
    stretchDesc.textContent = `${ctx.routine.name} finished.`;
    countdown.style.display = 'none';
    ringCenter.append(
      svg(
        'svg',
        { class: 'checkmark', viewBox: '0 0 52 52', 'aria-hidden': 'true' },
        svg('path', { d: 'M14 27 L22 35 L38 17' }),
      ),
    );
    clear(controls);
    const back = el('button', { class: 'ctrl-btn primary', text: 'Back to routines' });
    back.addEventListener('click', ctx.onExit);
    controls.append(back);
  }

  muteBtn.addEventListener('click', () => {
    settings.sound = !settings.sound;
    cues.setEnabled(settings.sound);
    if (settings.sound) cues.unlock(); // this tap is a user gesture — safe to unlock audio (iOS)
    ctx.onSettingsChange({ sound: settings.sound });
    cueStep = -1; // reschedule cues for the current step under the new setting
    renderMute();
  });

  prevBtn.addEventListener('click', () => session.prev());
  nextBtn.addEventListener('click', () => session.next());
  toggleBtn.addEventListener('click', () => session.togglePause());
  quitBtn.addEventListener('click', async () => {
    if (session.completed) {
      ctx.onExit();
      return;
    }
    const wasPaused = session.paused;
    if (!wasPaused) session.pause();
    const confirmed = await confirmModal('Quit this routine?', 'Quit');
    if (confirmed) session.quit();
    else if (!wasPaused) session.resume();
  });

  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      session.reconcile();
      cues.resume();
      void wakeLock.reacquire();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  /** @param {BeforeUnloadEvent} e */
  const onBeforeUnload = (e) => {
    if (!session.completed) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', onBeforeUnload);

  session.start();

  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('beforeunload', onBeforeUnload);
    flash.remove();
    cues.cancel();
    void wakeLock.release();
    session.dispose();
  };
}
