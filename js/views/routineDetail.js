/**
 * @file Routine detail view: preview a routine's stretches and start it. Per-side blocks render as
 * a labelled group.
 */

import { el, clear } from '../ui.js';
import { getStretch, routineHoldSeconds } from '../data.js';

/** @typedef {import('../types.js').Routine} Routine */
/** @typedef {import('../types.js').StretchRef} StretchRef */

/**
 * @param {HTMLElement} container
 * @param {{ routine: Routine, onStart: () => void, onBack: () => void, onEdit?: () => void }} ctx
 * @returns {void}
 */
export function mountRoutineDetail(container, ctx) {
  clear(container);
  const r = ctx.routine;
  const mins = Math.max(1, Math.round(routineHoldSeconds(r) / 60));
  const stretchCount = r.items.reduce((n, it) => n + ('block' in it ? it.block.length : 1), 0);

  /**
   * @param {StretchRef} refItem
   * @param {boolean} inBlock True when inside a per-side block (both sides implied).
   * @returns {HTMLElement}
   */
  function stretchRow(refItem, inBlock) {
    const s = getStretch(refItem.stretchId);
    const name = s ? s.name : refItem.stretchId;
    const area = s ? s.area : '';
    const perSide = Boolean(s && s.perSide) && !inBlock;
    return el(
      'li',
      { class: `stretch-row${inBlock ? ' stretch-row--sub' : ''}` },
      el(
        'div',
        { class: 'stretch-row-main' },
        el('span', { class: 'stretch-row-name', text: name }),
        el('span', { class: 'stretch-row-area', text: area }),
      ),
      el('span', {
        class: 'stretch-row-time',
        text: `${refItem.seconds}s${perSide ? ' ×2' : ''}`,
      }),
    );
  }

  const rows = el('ol', { class: 'stretch-list' });
  for (const item of r.items) {
    if ('block' in item) {
      rows.append(
        el(
          'li',
          { class: 'stretch-block' },
          el('span', { class: 'stretch-block-label', text: 'Per-side block — each side in turn' }),
          el(
            'ol',
            { class: 'stretch-block-list' },
            item.block.map((sub) => stretchRow(sub, true)),
          ),
        ),
      );
    } else {
      rows.append(stretchRow(item, false));
    }
  }

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
      el('p', { class: 'detail-sub', text: `~${mins} min · ${stretchCount} stretches` }),
      r.description ? el('p', { class: 'detail-desc', text: r.description }) : null,
      rows,
      el('div', { class: 'detail-actions' }, startBtn),
    ),
  );
}
