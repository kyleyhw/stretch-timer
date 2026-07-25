/**
 * @file Routine detail view: preview a routine's stretches and start it.
 */

import { el, clear } from '../ui.js';
import { getStretch, routineHoldSeconds } from '../data.js';

/** @typedef {import('../types.js').Routine} Routine */

/**
 * @param {HTMLElement} container
 * @param {{ routine: Routine, onStart: () => void, onBack: () => void, onEdit?: () => void }} ctx
 * @returns {void}
 */
export function mountRoutineDetail(container, ctx) {
  clear(container);
  const r = ctx.routine;
  const mins = Math.max(1, Math.round(routineHoldSeconds(r) / 60));

  const rows = el(
    'ol',
    { class: 'stretch-list' },
    r.items.map((item) => {
      const s = getStretch(item.stretchId);
      const name = s ? s.name : item.stretchId;
      const area = s ? s.area : '';
      const perSide = Boolean(s && s.perSide);
      return el(
        'li',
        { class: 'stretch-row' },
        el(
          'div',
          { class: 'stretch-row-main' },
          el('span', { class: 'stretch-row-name', text: name }),
          el('span', { class: 'stretch-row-area', text: area }),
        ),
        el('span', { class: 'stretch-row-time', text: `${item.seconds}s${perSide ? ' ×2' : ''}` }),
      );
    }),
  );

  const backBtn = el('button', { class: 'icon-btn', 'aria-label': 'Back', text: '‹' });
  backBtn.addEventListener('click', ctx.onBack);

  const startBtn = el('button', { class: 'ctrl-btn start-cta', text: 'Start routine' });
  startBtn.addEventListener('click', ctx.onStart);

  const headerChildren = [backBtn, el('h1', { class: 'detail-title', text: r.name })];
  if (ctx.onEdit) {
    const editBtn = el('button', {
      class: 'icon-btn detail-edit',
      'aria-label': 'Edit',
      text: '✎',
    });
    editBtn.addEventListener('click', ctx.onEdit);
    headerChildren.push(editBtn);
  }

  container.append(
    el(
      'section',
      { class: 'view view-detail' },
      el('header', { class: 'detail-header' }, headerChildren),
      el('p', { class: 'detail-sub', text: `~${mins} min · ${r.items.length} stretches` }),
      r.description ? el('p', { class: 'detail-desc', text: r.description }) : null,
      rows,
      el('div', { class: 'detail-actions' }, startBtn),
    ),
  );
}
