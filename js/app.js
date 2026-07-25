/**
 * @file Application bootstrap: wires the hash router to the views and renders the shell.
 *
 * Routines and stretches now come from the seed library via the data layer (js/data.js). User
 * routines, settings persistence, cues, and the service worker are added in later phases.
 */

import { createRouter } from './router.js';
import { expandRoutine } from './session.js';
import { mountPlayer } from './views/player.js';
import { mountHome } from './views/home.js';
import { mountRoutineDetail } from './views/routineDetail.js';
import { getAllRoutines, getRoutineById, getStretchMap } from './data.js';
import { el, clear } from './ui.js';

/** Default timing until settings persistence lands (Phase 5/6). */
const DEFAULT_SETTINGS = { prepSeconds: 5, switchSeconds: 3 };

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
  ],
  () => renderNotFound(),
);

function showHome() {
  mountHome(root, {
    routines: getAllRoutines(),
    onOpen: (id) => router.navigate(`/routine/${id}`),
  });
}

/** @param {string} id @returns {void} */
function showDetail(id) {
  const routine = getRoutineById(id);
  if (!routine) return renderNotFound();
  mountRoutineDetail(root, {
    routine,
    onStart: () => router.navigate(`/play/${id}`),
    onBack: () => router.navigate('/'),
  });
}

/** @param {string} id @returns {void | (() => void)} */
function startPlayer(id) {
  const routine = getRoutineById(id);
  if (!routine) return renderNotFound();
  const steps = expandRoutine(routine, getStretchMap(), DEFAULT_SETTINGS);
  return mountPlayer(root, {
    routine,
    steps,
    onExit: () => router.navigate(`/routine/${id}`),
  });
}

function renderNotFound() {
  clear(root);
  const back = el('button', { class: 'ctrl-btn', text: 'Home' });
  back.addEventListener('click', () => router.navigate('/'));
  root.append(el('section', { class: 'view' }, el('p', { text: 'Not found.' }), back));
}

router.start();
