/**
 * @file Application bootstrap: wires the hash router to the views and renders the shell.
 *
 * Routines and stretches come from the seed library via the data layer. Settings are in memory
 * (persistence in Phase 6); the service worker is added in Phase 7.
 */

import { createRouter } from './router.js';
import { expandRoutine } from './session.js';
import { mountPlayer } from './views/player.js';
import { mountHome } from './views/home.js';
import { mountRoutineDetail } from './views/routineDetail.js';
import { mountSettings } from './views/settings.js';
import { getAllRoutines, getRoutineById, getStretchMap } from './data.js';
import { getSettings, updateSettings } from './settings.js';
import { cues, haptics, wakeLock } from './cues.js';
import { el, clear } from './ui.js';

const app = document.getElementById('app');
if (!(app instanceof HTMLElement)) {
  throw new Error('missing #app container');
}
const root = app;

const router = createRouter(
  [
    { pattern: '/', handler: () => showHome() },
    { pattern: '/routine/:id', handler: (p) => showDetail(p.id) },
    { pattern: '/play/:id', handler: (p) => startPlayer(p.id) },
    { pattern: '/settings', handler: () => showSettings() },
  ],
  () => renderNotFound(),
);

function showHome() {
  mountHome(root, {
    routines: getAllRoutines(),
    onOpen: (id) => router.navigate(`/routine/${id}`),
    onSettings: () => router.navigate('/settings'),
  });
}

/** @param {string} id @returns {void} */
function showDetail(id) {
  const routine = getRoutineById(id);
  if (!routine) return renderNotFound();
  mountRoutineDetail(root, {
    routine,
    onStart: () => {
      cues.unlock(); // this click is the user gesture that unlocks audio (iOS)
      router.navigate(`/play/${id}`);
    },
    onBack: () => router.navigate('/'),
  });
}

/** @param {string} id @returns {void | (() => void)} */
function startPlayer(id) {
  const routine = getRoutineById(id);
  if (!routine) return renderNotFound();
  const settings = getSettings();
  const steps = expandRoutine(routine, getStretchMap(), settings);
  return mountPlayer(root, {
    routine,
    steps,
    settings,
    onExit: () => router.navigate(`/routine/${id}`),
  });
}

function showSettings() {
  mountSettings(root, {
    settings: getSettings(),
    onChange: (patch) => updateSettings(patch),
    onBack: () => router.navigate('/'),
    caps: { vibration: haptics.supported, wakeLock: wakeLock.supported },
  });
}

function renderNotFound() {
  clear(root);
  const back = el('button', { class: 'ctrl-btn', text: 'Home' });
  back.addEventListener('click', () => router.navigate('/'));
  root.append(el('section', { class: 'view' }, el('p', { text: 'Not found.' }), back));
}

router.start();
