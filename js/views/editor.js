/**
 * @file Routine editor: create or edit a user routine — name, description, and an ordered list of
 * stretches and/or per-side blocks (each with per-item durations). Built-in routines are edited as
 * a fresh user-owned copy (the caller passes a copy with a new id).
 */

import { el, clear, icon } from '../ui.js';
import { stretchFormModal } from './stretchForm.js';

/** @typedef {import('../types.js').Routine} Routine */
/** @typedef {import('../types.js').RoutineItem} RoutineItem */
/** @typedef {import('../types.js').StretchRef} StretchRef */
/** @typedef {import('../types.js').SideBlock} SideBlock */
/** @typedef {import('../types.js').Stretch} Stretch */
/** @typedef {import('./stretchForm.js').StretchFormData} StretchFormData */

/**
 * @typedef {object} EditorContext
 * @property {Routine} routine Working routine (user-owned; for built-ins a copy with a new id).
 * @property {Stretch[]} stretches Full library for the picker.
 * @property {Record<string, Stretch>} stretchMap
 * @property {boolean} canDelete Show the Delete button (existing user routine).
 * @property {(routine: Routine) => void} onSave
 * @property {() => void} onDelete
 * @property {() => void} onCancel
 * @property {(data: StretchFormData) => Stretch} onCreateStretch Add a custom stretch; returns it.
 */

/**
 * @template T
 * @param {T[]} arr
 * @param {number} i
 * @param {number} j
 * @returns {void}
 */
function swap(arr, i, j) {
  const tmp = arr[i];
  arr[i] = arr[j];
  arr[j] = tmp;
}

/**
 * @param {HTMLElement} container
 * @param {EditorContext} ctx
 * @returns {void}
 */
export function mountEditor(container, ctx) {
  clear(container);

  // Local, growable copies so a stretch created mid-edit is immediately pickable without a remount.
  /** @type {Stretch[]} */
  const library = [...ctx.stretches];
  /** @type {Record<string, Stretch>} */
  const stretchMap = { ...ctx.stretchMap };

  /** @type {{ id: string, name: string, description: string, builtIn: false, items: RoutineItem[] }} */
  const draft = {
    id: ctx.routine.id,
    name: ctx.routine.name,
    description: ctx.routine.description,
    builtIn: false,
    items: ctx.routine.items.map((it) =>
      'block' in it ? { block: it.block.map((r) => ({ ...r })) } : { ...it },
    ),
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

  const itemsList = el('div', { class: 'editor-items' });

  /** @param {HTMLSelectElement} select Populate (or repopulate) a picker with the library by area. */
  function populatePicker(select) {
    clear(select);
    /** @type {Map<string, Stretch[]>} */
    const byArea = new Map();
    for (const s of library) {
      const list = byArea.get(s.area) ?? [];
      list.push(s);
      byArea.set(s.area, list);
    }
    for (const [area, list] of byArea) {
      const group = el('optgroup', { label: area || 'Other' });
      for (const s of list) group.append(el('option', { value: s.id, text: s.name }));
      select.append(group);
    }
  }

  /** @returns {HTMLSelectElement} A fresh stretch picker grouped by area. */
  function buildPicker() {
    const select = /** @type {HTMLSelectElement} */ (el('select', { class: 'field-input' }));
    populatePicker(select);
    return select;
  }

  /**
   * @typedef {object} RowOps
   * @property {boolean} canUp
   * @property {boolean} canDown
   * @property {() => void} onUp
   * @property {() => void} onDown
   * @property {() => void} onRemove
   */

  /**
   * @param {StretchRef} refItem
   * @param {RowOps} ops
   * @param {boolean} sub True when the row is inside a block.
   * @returns {HTMLElement}
   */
  function refRow(refItem, ops, sub) {
    const s = stretchMap[refItem.stretchId];
    const name = s ? s.name : refItem.stretchId;
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
    secInput.value = String(refItem.seconds);
    secInput.addEventListener('change', () => {
      const v = Math.max(5, Math.min(300, Number(secInput.value) || refItem.seconds));
      refItem.seconds = v;
      secInput.value = String(v);
    });

    const up = /** @type {HTMLButtonElement} */ (
      el('button', { class: 'mini-btn', 'aria-label': 'Move up' }, icon('up'))
    );
    const down = /** @type {HTMLButtonElement} */ (
      el('button', { class: 'mini-btn', 'aria-label': 'Move down' }, icon('down'))
    );
    const del = el('button', { class: 'mini-btn', 'aria-label': 'Remove' }, icon('close'));
    up.disabled = !ops.canUp;
    down.disabled = !ops.canDown;
    up.addEventListener('click', ops.onUp);
    down.addEventListener('click', ops.onDown);
    del.addEventListener('click', ops.onRemove);

    return el(
      'div',
      { class: `editor-item${sub ? ' editor-item--sub' : ''}` },
      el('span', { class: 'editor-item-name', text: name }),
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

  /**
   * @param {SideBlock} blockItem
   * @param {number} index Position in draft.items.
   * @returns {HTMLElement}
   */
  function blockCard(blockItem, index) {
    const up = /** @type {HTMLButtonElement} */ (
      el('button', { class: 'mini-btn', 'aria-label': 'Move block up' }, icon('up'))
    );
    const down = /** @type {HTMLButtonElement} */ (
      el('button', { class: 'mini-btn', 'aria-label': 'Move block down' }, icon('down'))
    );
    const del = el('button', { class: 'mini-btn', 'aria-label': 'Remove block' }, icon('close'));
    up.disabled = index === 0;
    down.disabled = index === draft.items.length - 1;
    up.addEventListener('click', () => {
      swap(draft.items, index, index - 1);
      renderItems();
    });
    down.addEventListener('click', () => {
      swap(draft.items, index, index + 1);
      renderItems();
    });
    del.addEventListener('click', () => {
      draft.items.splice(index, 1);
      renderItems();
    });

    const subList = el('div', { class: 'editor-block-list' });
    if (blockItem.block.length === 0) {
      subList.append(el('p', { class: 'editor-empty', text: 'Add stretches to this block.' }));
    } else {
      blockItem.block.forEach((sub, j) => {
        subList.append(
          refRow(
            sub,
            {
              canUp: j > 0,
              canDown: j < blockItem.block.length - 1,
              onUp: () => {
                swap(blockItem.block, j, j - 1);
                renderItems();
              },
              onDown: () => {
                swap(blockItem.block, j, j + 1);
                renderItems();
              },
              onRemove: () => {
                blockItem.block.splice(j, 1);
                renderItems();
              },
            },
            true,
          ),
        );
      });
    }

    const picker = buildPicker();
    const addBtn = el('button', { class: 'ctrl-btn', text: 'Add to block' });
    addBtn.addEventListener('click', () => {
      const s = stretchMap[picker.value];
      if (s) {
        blockItem.block.push({ stretchId: s.id, seconds: s.defaultSeconds });
        renderItems();
      }
    });

    return el(
      'div',
      { class: 'editor-block-card' },
      el(
        'div',
        { class: 'editor-block-header' },
        el('span', { class: 'editor-block-title', text: 'Per-side block' }),
        el('span', { class: 'editor-item-controls' }, up, down, del),
      ),
      subList,
      el('div', { class: 'editor-add editor-block-add' }, picker, addBtn),
    );
  }

  function renderItems() {
    clear(itemsList);
    if (draft.items.length === 0) {
      itemsList.append(
        el('p', { class: 'editor-empty', text: 'No stretches yet — add one below.' }),
      );
      return;
    }
    draft.items.forEach((item, i) => {
      if ('block' in item) {
        itemsList.append(blockCard(item, i));
      } else {
        itemsList.append(
          refRow(
            item,
            {
              canUp: i > 0,
              canDown: i < draft.items.length - 1,
              onUp: () => {
                swap(draft.items, i, i - 1);
                renderItems();
              },
              onDown: () => {
                swap(draft.items, i, i + 1);
                renderItems();
              },
              onRemove: () => {
                draft.items.splice(i, 1);
                renderItems();
              },
            },
            false,
          ),
        );
      }
    });
  }

  // Top-level add controls.
  const topPicker = buildPicker();
  const addStretchBtn = el('button', { class: 'ctrl-btn', text: 'Add' });
  addStretchBtn.addEventListener('click', () => {
    const s = stretchMap[topPicker.value];
    if (s) {
      draft.items.push({ stretchId: s.id, seconds: s.defaultSeconds });
      renderItems();
    }
  });
  const addBlockBtn = el(
    'button',
    { class: 'ctrl-btn' },
    icon('plus'),
    el('span', { text: 'Per-side block' }),
  );
  addBlockBtn.addEventListener('click', () => {
    draft.items.push({ block: [] });
    renderItems();
  });

  const newStretchBtn = el(
    'button',
    { class: 'ctrl-btn' },
    icon('plus'),
    el('span', { text: 'New stretch' }),
  );
  newStretchBtn.addEventListener('click', async () => {
    const data = await stretchFormModal('New stretch');
    if (!data) return;
    const created = ctx.onCreateStretch(data);
    library.push(created);
    stretchMap[created.id] = created;
    populatePicker(topPicker);
    topPicker.value = created.id; // created stretch joins the library and is selected
    renderItems(); // refresh block pickers so the new stretch is pickable there too
  });

  const saveBtn = el('button', { class: 'ctrl-btn start-cta', text: 'Save routine' });
  const errorMsg = el('p', { class: 'editor-error', role: 'alert' });
  saveBtn.addEventListener('click', () => {
    draft.name = nameInput.value.trim();
    // Drop empty blocks before validating.
    draft.items = draft.items.filter((it) => !('block' in it) || it.block.length > 0);
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

  const cancelBtn = el('button', { class: 'icon-btn', 'aria-label': 'Cancel' }, icon('back'));
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
      el('div', { class: 'editor-add' }, topPicker, addStretchBtn),
      el('div', { class: 'editor-add-buttons' }, newStretchBtn, addBlockBtn),
      errorMsg,
      actions,
    ),
  );

  renderItems();
}
