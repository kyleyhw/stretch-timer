/**
 * @file Session player view. Renders the static structure once and mutates only the changing
 * nodes (countdown text, progress width, labels) each frame — never rebuilding the DOM per tick.
 */

import { el, clear, fmtClock } from '../ui.js';
import { Session } from '../session.js';

/** @typedef {import('../types.js').Routine} Routine */
/** @typedef {import('../types.js').Step} Step */

/**
 * @typedef {object} PlayerContext
 * @property {Routine} routine
 * @property {Step[]} steps Expanded step list (see expandRoutine).
 * @property {() => void} onExit Called to leave the player (quit or finish).
 */

/**
 * Mount the player. Returns a cleanup that stops the session and removes listeners.
 * @param {HTMLElement} container
 * @param {PlayerContext} ctx
 * @returns {() => void}
 */
export function mountPlayer(container, ctx) {
  clear(container);

  const progressFill = el('div', { class: 'progress-fill' });
  const routineName = el('span', { class: 'routine-name', text: ctx.routine.name });
  const progressCount = el('span', { class: 'progress-count' });
  const phaseLabel = el('p', { class: 'phase-label', 'aria-live': 'polite' });
  const stretchName = el('h1', { class: 'stretch-name', 'aria-live': 'polite' });
  const stretchDesc = el('p', { class: 'stretch-desc' });
  const countdown = el('div', {
    class: 'countdown',
    role: 'timer',
    'aria-live': 'off',
    text: '--',
  });
  const prevBtn = el('button', {
    class: 'ctrl-btn',
    'aria-label': 'Previous stretch',
    text: '⏮',
  });
  const toggleBtn = el('button', { class: 'ctrl-btn primary', text: 'Pause' });
  const nextBtn = el('button', { class: 'ctrl-btn', 'aria-label': 'Skip stretch', text: '⏭' });
  const quitBtn = el('button', { class: 'icon-btn', 'aria-label': 'Quit', text: '✕' });
  const controls = el('div', { class: 'controls' }, prevBtn, toggleBtn, nextBtn);

  const view = el(
    'section',
    { class: 'view view-player' },
    el('header', { class: 'player-header' }, routineName, progressCount, quitBtn),
    el('div', { class: 'progress-bar' }, progressFill),
    phaseLabel,
    stretchName,
    stretchDesc,
    countdown,
    controls,
  );
  container.append(view);

  const session = new Session(ctx.steps, {
    onStepChange: (step, info) => {
      view.dataset.phase = step.type;
      phaseLabel.textContent = step.side ? `${step.label}` : step.label;
      stretchName.textContent = step.stretchName;
      stretchDesc.textContent = step.type === 'hold' ? step.stretchDescription : '';
      progressCount.textContent = `Stretch ${info.stretchNumber} of ${info.stretchCount}`;
    },
    onTick: (remMs, _step, info) => {
      countdown.textContent = fmtClock(Math.ceil(remMs / 1000));
      progressFill.style.width = `${(info.fraction * 100).toFixed(1)}%`;
    },
    onPauseChange: (paused) => {
      toggleBtn.textContent = paused ? 'Resume' : 'Pause';
      view.dataset.paused = String(paused);
    },
    onComplete: showComplete,
    onQuit: ctx.onExit,
  });

  function showComplete() {
    view.dataset.phase = 'done';
    phaseLabel.textContent = 'Complete';
    stretchName.textContent = 'All done ✓';
    stretchDesc.textContent = `${ctx.routine.name} finished.`;
    countdown.textContent = '';
    progressFill.style.width = '100%';
    clear(controls);
    const back = el('button', { class: 'ctrl-btn primary', text: 'Back to routines' });
    back.addEventListener('click', ctx.onExit);
    controls.append(back);
  }

  prevBtn.addEventListener('click', () => session.prev());
  nextBtn.addEventListener('click', () => session.next());
  toggleBtn.addEventListener('click', () => session.togglePause());
  quitBtn.addEventListener('click', () => session.quit());

  const onVisibility = () => {
    if (document.visibilityState === 'visible') session.reconcile();
  };
  document.addEventListener('visibilitychange', onVisibility);

  session.start();

  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    session.dispose();
  };
}
