/**
 * @file Application bootstrap: wires persistence, the hash router, and the views.
 *
 * User routines and settings are loaded from localStorage on boot and saved on every change (via
 * the data-layer persistence sink and the settings sink). The service worker is added in Phase 7.
 */

import { createRouter } from './router.js';
import { expandRoutine } from './session.js';
import { mountPlayer } from './views/player.js';
import { mountHome } from './views/home.js';
import { mountRoutineDetail } from './views/routineDetail.js';
import { mountSettings } from './views/settings.js';
import { mountEditor } from './views/editor.js';
import {
  getAllRoutines,
  getRoutineById,
  getStretchMap,
  getAllStretches,
  setUserRoutines,
  setPersist,
  upsertUserRoutine,
  deleteUserRoutine,
  makeUserId,
} from './data.js';
import { store } from './store.js';
import { getSettings, updateSettings, initSettings, DEFAULT_SETTINGS } from './settings.js';
import { applyTheme } from './theme.js';
import { cues, haptics, wakeLock } from './cues.js';
import { el, clear } from './ui.js';

// --- Persistence boot ---
setUserRoutines(store.loadUserRoutines());
setPersist((list) => store.saveUserRoutines(list));
initSettings(store.loadSettings(DEFAULT_SETTINGS), (s) => store.saveSettings(s));
applyTheme(getSettings().theme);

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
    { pattern: '/new', handler: () => showEditor(null) },
    { pattern: '/edit/:id', handler: (p) => showEditor(p.id) },
  ],
  () => renderNotFound(),
);

function showHome() {
  mountHome(root, {
    routines: getAllRoutines(),
    onOpen: (id) => router.navigate(`/routine/${id}`),
    onNew: () => router.navigate('/new'),
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
    onEdit: () => router.navigate(`/edit/${id}`),
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
    onSettingsChange: (patch) => updateSettings(patch),
    onExit: () => router.navigate(`/routine/${id}`),
  });
}

function showSettings() {
  mountSettings(root, {
    settings: getSettings(),
    onChange: (patch) => {
      updateSettings(patch);
      if (patch.theme) applyTheme(patch.theme);
    },
    onBack: () => router.navigate('/'),
    caps: { vibration: haptics.supported, wakeLock: wakeLock.supported },
  });
}

/** @param {string | null} id @returns {void} */
function showEditor(id) {
  /** @type {import('./types.js').Routine} */
  let draft;
  let canDelete = false;

  if (id === null) {
    draft = { id: makeUserId(), name: '', description: '', builtIn: false, items: [] };
  } else {
    const routine = getRoutineById(id);
    if (!routine) return renderNotFound();
    if (routine.builtIn) {
      // Duplicate-and-edit: a fresh user-owned copy.
      draft = {
        id: makeUserId(),
        name: `${routine.name} (copy)`,
        description: routine.description,
        builtIn: false,
        items: routine.items.map((it) => ({ ...it })),
      };
    } else {
      draft = routine;
      canDelete = true;
    }
  }

  mountEditor(root, {
    routine: draft,
    stretches: getAllStretches(),
    stretchMap: getStretchMap(),
    canDelete,
    onSave: (r) => {
      upsertUserRoutine(r);
      router.navigate(`/routine/${r.id}`);
    },
    onDelete: () => {
      if (id && canDelete) deleteUserRoutine(id);
      router.navigate('/');
    },
    onCancel: () => router.navigate(id && canDelete ? `/routine/${id}` : '/'),
  });
}

function renderNotFound() {
  clear(root);
  const back = el('button', { class: 'ctrl-btn', text: 'Home' });
  back.addEventListener('click', () => router.navigate('/'));
  root.append(el('section', { class: 'view' }, el('p', { text: 'Not found.' }), back));
}

router.start();

registerServiceWorker();

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    location.reload();
  });
  navigator.serviceWorker
    .register('sw.js')
    .then((reg) => {
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateToast(reg);
          }
        });
      });
    })
    .catch(() => {
      /* offline or unsupported — the app still works */
    });
}

/** @param {ServiceWorkerRegistration} reg @returns {void} */
function showUpdateToast(reg) {
  const toast = el('button', { class: 'toast', text: 'Update available — tap to refresh' });
  toast.addEventListener('click', () => reg.waiting?.postMessage('SKIP_WAITING'));
  document.body.append(toast);
}
