/**
 * @file Routine editor: create or edit a user routine (name, description, ordered stretches with
 * per-item durations). Built-in routines are edited as a fresh user-owned copy (handled by the
 * caller, which passes an already-copied routine with a new id).
 */

import { el, clear } from '../ui.js';

/** @typedef {import('../types.js').Routine} Routine */
/** @typedef {import('../types.js').RoutineItem} RoutineItem */
/** @typedef {import('../types.js').Stretch} Stretch */

/**
 * @typedef {object} EditorContext
 * @property {Routine} routine Working routine (user-owned; for built-ins a copy with a new id).
 * @property {Stretch[]} stretches Full library for the picker.
 * @property {Record<string, Stretch>} stretchMap
 * @property {boolean} canDelete Show the Delete button (existing user routine).
 * @property {(routine: Routine) => void} onSave
 * @property {() => void} onDelete
 * @property {() => void} onCancel
 */

/**
 * @param {HTMLElement} container
 * @param {EditorContext} ctx
 * @returns {void}
 */
export function mountEditor(container, ctx) {
  clear(container);

  /** @type {{ id: string, name: string, description: string, builtIn: false, items: RoutineItem[] }} */
  const draft = {
    id: ctx.routine.id,
    name: ctx.routine.name,
    description: ctx.routine.description,
    builtIn: false,
    items: ctx.routine.items.map((it) => ({ ...it })),
  };

  const nameInput = /** @type {HTMLInputElement} */ (
    el('input', { class: 'field-input', type: 'text', placeholder: 'Routine name' })
  );
  nameInput.value = draft.name;
  nameInput.addEventListener('input', () => {
    draft.name = nameInput.value;
    nameInput.classList.remove('field-error');
  });

  const descInput = /** @type {HTMLInputElement} */ (
    el('input', { class: 'field-input', type: 'text', placeholder: 'Description (optional)' })
  );
  descInput.value = draft.description;
  descInput.addEventListener('input', () => {
    draft.description = descInput.value;
  });

  const itemsList = el('ol', { class: 'editor-items' });

  /**
   * @param {RoutineItem} item
   * @param {number} i
   * @returns {HTMLElement}
   */
  function renderItemRow(item, i) {
    const s = ctx.stretchMap[item.stretchId];
    const name = s ? s.name : item.stretchId;
    const secInput = /** @type {HTMLInputElement} */ (
      el('input', {
        class: 'sec-input',
        type: 'number',
        min: '5',
        max: '300',
        step: '5',
        'aria-label': `Seconds for ${name}`,
      })
    );
    secInput.value = String(item.seconds);
    secInput.addEventListener('change', () => {
      const v = Math.max(5, Math.min(300, Number(secInput.value) || item.seconds));
      item.seconds = v;
      secInput.value = String(v);
    });

    const up = el('button', { class: 'mini-btn', 'aria-label': 'Move up', text: '↑' });
    const down = el('button', { class: 'mini-btn', 'aria-label': 'Move down', text: '↓' });
    const del = el('button', { class: 'mini-btn', 'aria-label': 'Remove', text: '✕' });
    up.addEventListener('click', () => {
      if (i > 0) {
        [draft.items[i - 1], draft.items[i]] = [draft.items[i], draft.items[i - 1]];
        renderItems();
      }
    });
    down.addEventListener('click', () => {
      if (i < draft.items.length - 1) {
        [draft.items[i + 1], draft.items[i]] = [draft.items[i], draft.items[i + 1]];
        renderItems();
      }
    });
    del.addEventListener('click', () => {
      draft.items.splice(i, 1);
      renderItems();
    });

    return el(
      'li',
      { class: 'editor-item' },
      el('span', {
        class: 'editor-item-name',
        text: name + (s && s.perSide ? ' · per side' : ''),
      }),
      el(
        'span',
        { class: 'editor-item-controls' },
        secInput,
        el('span', { class: 'sec-unit', text: 's' }),
        up,
        down,
        del,
      ),
    );
  }

  function renderItems() {
    clear(itemsList);
    if (draft.items.length === 0) {
      itemsList.append(
        el('li', { class: 'editor-empty', text: 'No stretches yet — add one below.' }),
      );
      return;
    }
    draft.items.forEach((item, i) => itemsList.append(renderItemRow(item, i)));
  }

  // Picker: stretches grouped by area.
  const picker = /** @type {HTMLSelectElement} */ (el('select', { class: 'field-input' }));
  /** @type {Map<string, Stretch[]>} */
  const byArea = new Map();
  for (const s of ctx.stretches) {
    const list = byArea.get(s.area) ?? [];
    list.push(s);
    byArea.set(s.area, list);
  }
  for (const [area, list] of byArea) {
    const group = el('optgroup', { label: area });
    for (const s of list) group.append(el('option', { value: s.id, text: s.name }));
    picker.append(group);
  }
  const addBtn = el('button', { class: 'ctrl-btn', text: 'Add' });
  addBtn.addEventListener('click', () => {
    const s = ctx.stretchMap[picker.value];
    if (s) {
      draft.items.push({ stretchId: s.id, seconds: s.defaultSeconds });
      renderItems();
    }
  });

  const saveBtn = el('button', { class: 'ctrl-btn start-cta', text: 'Save routine' });
  const errorMsg = el('p', { class: 'editor-error', role: 'alert' });
  saveBtn.addEventListener('click', () => {
    draft.name = nameInput.value.trim();
    if (!draft.name) {
      nameInput.classList.add('field-error');
      nameInput.focus();
      errorMsg.textContent = 'Give the routine a name.';
      return;
    }
    if (draft.items.length === 0) {
      errorMsg.textContent = 'Add at least one stretch.';
      return;
    }
    ctx.onSave({ ...draft });
  });

  const cancelBtn = el('button', { class: 'icon-btn', 'aria-label': 'Cancel', text: '‹' });
  cancelBtn.addEventListener('click', ctx.onCancel);

  const actions = el('div', { class: 'detail-actions editor-actions' }, saveBtn);
  if (ctx.canDelete) {
    const delRoutine = el('button', { class: 'ctrl-btn danger', text: 'Delete routine' });
    delRoutine.addEventListener('click', ctx.onDelete);
    actions.append(delRoutine);
  }

  container.append(
    el(
      'section',
      { class: 'view view-editor' },
      el(
        'header',
        { class: 'detail-header' },
        cancelBtn,
        el('h1', { class: 'detail-title', text: ctx.canDelete ? 'Edit routine' : 'New routine' }),
      ),
      el(
        'label',
        { class: 'field' },
        el('span', { class: 'field-label', text: 'Name' }),
        nameInput,
      ),
      el(
        'label',
        { class: 'field' },
        el('span', { class: 'field-label', text: 'Description' }),
        descInput,
      ),
      el('h2', { class: 'editor-subhead', text: 'Stretches' }),
      itemsList,
      el('div', { class: 'editor-add' }, picker, addBtn),
      errorMsg,
      actions,
    ),
  );

  renderItems();
}
