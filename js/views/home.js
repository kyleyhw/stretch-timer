/**
 * @file Home view: the list of all routines (built-in + user). Tapping a routine opens its detail.
 */

import { el, clear, icon } from '../ui.js';
import { routineHoldSeconds } from '../data.js';

/** @typedef {import('../types.js').Routine} Routine */

/**
 * @param {HTMLElement} container
 * @param {{
 *   routines: Routine[],
 *   onOpen: (id: string) => void,
 *   onNew?: () => void,
 *   onSettings?: () => void,
 * }} ctx
 * @returns {void}
 */
export function mountHome(container, ctx) {
  clear(container);

  const list = el(
    'ul',
    { class: 'routine-list' },
    ctx.routines.map((r) => {
      const mins = Math.max(1, Math.round(routineHoldSeconds(r) / 60));
      const item = el(
        'li',
        { class: 'routine-item routine-item--tappable', role: 'button', tabindex: '0' },
        el(
          'div',
          { class: 'routine-meta' },
          el('span', { class: 'routine-title', text: r.name }),
          el('span', {
            class: 'routine-sub',
            text: `~${mins} min · ${r.items.length} stretches${r.builtIn ? '' : ' · custom'}`,
          }),
        ),
        el('span', { class: 'chevron', 'aria-hidden': 'true' }, icon('forward')),
      );
      const open = () => ctx.onOpen(r.id);
      item.addEventListener('click', open);
      item.addEventListener('keydown', (e) => {
        if (e instanceof KeyboardEvent && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          open();
        }
      });
      return item;
    }),
  );

  const titleRow = el('div', { class: 'home-title-row' }, el('h1', { text: 'Stretch Timer' }));
  if (ctx.onSettings) {
    const gear = el('button', { class: 'icon-btn', 'aria-label': 'Settings' }, icon('settings'));
    gear.addEventListener('click', ctx.onSettings);
    titleRow.append(gear);
  }

  const header = el(
    'header',
    { class: 'home-header' },
    titleRow,
    el('p', { class: 'home-sub', text: 'Pick a routine to begin.' }),
  );

  const section = el('section', { class: 'view view-home' }, header, list);

  if (ctx.onNew) {
    const newBtn = el(
      'button',
      { class: 'ctrl-btn new-routine-btn' },
      icon('plus'),
      el('span', { text: 'New routine' }),
    );
    newBtn.addEventListener('click', ctx.onNew);
    section.append(newBtn);
  }

  container.append(section);
}
