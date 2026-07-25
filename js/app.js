/**
 * @file Application bootstrap: wires the hash router to the views and renders the shell.
 *
 * NOTE: the demo library/routines below are a temporary Phase 3 stand-in so the player can run
 * end-to-end. Phase 4 replaces them with the seed library (js/seed.js) and the built-in/user
 * merge (js/data.js). The service-worker registration is added in Phase 7.
 */

import { createRouter } from './router.js';
import { expandRoutine } from './session.js';
import { mountPlayer } from './views/player.js';
import { el, clear } from './ui.js';

/** @typedef {import('./types.js').Stretch} Stretch */
/** @typedef {import('./types.js').Routine} Routine */

/** @type {Record<string, Stretch>} */
const DEMO_LIBRARY = {
  'neck-roll': {
    id: 'neck-roll',
    name: 'Neck Rolls',
    area: 'Neck',
    description: 'Slowly circle your head, keeping the shoulders relaxed.',
    defaultSeconds: 20,
    perSide: false,
  },
  'shoulder-cross': {
    id: 'shoulder-cross',
    name: 'Cross-Body Shoulder Stretch',
    area: 'Shoulders',
    description: 'Draw one arm across your chest with the opposite hand.',
    defaultSeconds: 20,
    perSide: true,
  },
  hamstring: {
    id: 'hamstring',
    name: 'Standing Hamstring Stretch',
    area: 'Hamstrings',
    description: 'Hinge at the hips and reach toward your toes, back flat.',
    defaultSeconds: 30,
    perSide: false,
  },
  quad: {
    id: 'quad',
    name: 'Standing Quad Stretch',
    area: 'Quadriceps',
    description: 'Pull one heel toward your glute, knees together.',
    defaultSeconds: 20,
    perSide: true,
  },
};

/** @type {Routine[]} */
const DEMO_ROUTINES = [
  {
    id: 'desk-reset',
    name: 'Desk Reset',
    description: 'A quick neck and shoulder loosener.',
    builtIn: true,
    items: [
      { stretchId: 'neck-roll', seconds: 20 },
      { stretchId: 'shoulder-cross', seconds: 20 },
    ],
  },
  {
    id: 'lower-body',
    name: 'Lower Body',
    description: 'Hamstrings and quads.',
    builtIn: true,
    items: [
      { stretchId: 'hamstring', seconds: 30 },
      { stretchId: 'quad', seconds: 20 },
    ],
  },
];

const DEFAULT_SETTINGS = { prepSeconds: 5, switchSeconds: 3 };

const app = document.getElementById('app');
if (!(app instanceof HTMLElement)) {
  throw new Error('missing #app container');
}
const root = app;

/** @param {string} id @returns {Routine | null} */
function routineById(id) {
  return DEMO_ROUTINES.find((r) => r.id === id) ?? null;
}

const router = createRouter(
  [
    { pattern: '/', handler: () => renderHome() },
    { pattern: '/play/:id', handler: (p) => startPlayer(p.id) },
  ],
  () => renderNotFound(),
);

function renderHome() {
  clear(root);
  const list = el(
    'ul',
    { class: 'routine-list' },
    DEMO_ROUTINES.map((r) =>
      el(
        'li',
        { class: 'routine-item' },
        el(
          'div',
          { class: 'routine-meta' },
          el('span', { class: 'routine-title', text: r.name }),
          el('span', {
            class: 'routine-sub',
            text: `${r.items.length} stretches · ${r.description}`,
          }),
        ),
        (() => {
          const btn = el('button', { class: 'start-btn', text: 'Start' });
          btn.addEventListener('click', () => router.navigate(`/play/${r.id}`));
          return btn;
        })(),
      ),
    ),
  );
  root.append(
    el(
      'section',
      { class: 'view view-home' },
      el('header', { class: 'home-header' }, el('h1', { text: 'Stretch Timer' })),
      list,
    ),
  );
}

/** @param {string} id @returns {void | (() => void)} */
function startPlayer(id) {
  const routine = routineById(id);
  if (!routine) return renderNotFound();
  const steps = expandRoutine(routine, DEMO_LIBRARY, DEFAULT_SETTINGS);
  return mountPlayer(root, { routine, steps, onExit: () => router.navigate('/') });
}

function renderNotFound() {
  clear(root);
  const back = el('button', { class: 'ctrl-btn', text: 'Home' });
  back.addEventListener('click', () => router.navigate('/'));
  root.append(el('section', { class: 'view' }, el('p', { text: 'Not found.' }), back));
}

router.start();
