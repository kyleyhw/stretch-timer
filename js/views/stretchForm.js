/**
 * @file A modal form for creating or editing a custom stretch. Shared by the routine editor
 * ("+ New stretch") and the Settings "Your stretches" section. Resolves to the entered fields, or
 * null if cancelled.
 */

import { el } from '../ui.js';

/**
 * @typedef {object} StretchFormData
 * @property {string} name
 * @property {string} area
 * @property {string} description
 * @property {number} defaultSeconds
 * @property {boolean} perSide
 */

/**
 * @param {string} labelText
 * @param {HTMLElement} input
 * @returns {HTMLElement}
 */
function field(labelText, input) {
  return el(
    'label',
    { class: 'field' },
    el('span', { class: 'field-label', text: labelText }),
    input,
  );
}

/**
 * Show the stretch form. Resolves with the entered data, or null on cancel / backdrop / Escape.
 * @param {string} title
 * @param {Partial<StretchFormData>} [initial]
 * @returns {Promise<StretchFormData | null>}
 */
export function stretchFormModal(title, initial = {}) {
  return new Promise((resolve) => {
    const nameInput = /** @type {HTMLInputElement} */ (
      el('input', { class: 'field-input', type: 'text', placeholder: 'e.g. Neck side stretch' })
    );
    nameInput.value = initial.name ?? '';

    const areaInput = /** @type {HTMLInputElement} */ (
      el('input', { class: 'field-input', type: 'text', placeholder: 'e.g. Neck' })
    );
    areaInput.value = initial.area ?? '';

    const descInput = /** @type {HTMLInputElement} */ (
      el('input', { class: 'field-input', type: 'text', placeholder: 'How to do it (optional)' })
    );
    descInput.value = initial.description ?? '';

    const secInput = /** @type {HTMLInputElement} */ (
      el('input', {
        class: 'field-input',
        type: 'number',
        min: '5',
        max: '300',
        step: '5',
      })
    );
    secInput.value = String(initial.defaultSeconds ?? 30);

    const perSideInput = /** @type {HTMLInputElement} */ (
      el('input', { type: 'checkbox', class: 'toggle-input' })
    );
    perSideInput.checked = initial.perSide ?? false;
    const perSideRow = el(
      'label',
      { class: 'setting-row' },
      el('span', { class: 'setting-label', text: 'Per side (left then right)' }),
      el('span', { class: 'toggle' }, perSideInput, el('span', { class: 'toggle-track' })),
    );

    const err = el('p', { class: 'editor-error', role: 'alert' });
    const cancel = el('button', { class: 'ctrl-btn', text: 'Cancel' });
    const save = el('button', { class: 'ctrl-btn primary', text: 'Save' });

    const overlay = el(
      'div',
      { class: 'modal-overlay' },
      el(
        'div',
        { class: 'modal modal-form', role: 'dialog', 'aria-modal': 'true' },
        el('h2', { class: 'modal-title', text: title }),
        field('Name', nameInput),
        field('Area', areaInput),
        field('Description', descInput),
        field('Default seconds', secInput),
        perSideRow,
        err,
        el('div', { class: 'modal-actions' }, cancel, save),
      ),
    );

    /** @param {StretchFormData | null} value */
    const finish = (value) => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve(value);
    };
    /** @param {KeyboardEvent} e */
    const onKey = (e) => {
      if (e.key === 'Escape') finish(null);
    };

    cancel.addEventListener('click', () => finish(null));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish(null);
    });
    save.addEventListener('click', () => {
      const name = nameInput.value.trim();
      if (!name) {
        nameInput.classList.add('field-error');
        nameInput.focus();
        err.textContent = 'Give the stretch a name.';
        return;
      }
      const defaultSeconds = Math.max(5, Math.min(300, Number(secInput.value) || 30));
      finish({
        name,
        area: areaInput.value.trim(),
        description: descInput.value.trim(),
        defaultSeconds,
        perSide: perSideInput.checked,
      });
    });

    document.addEventListener('keydown', onKey);
    document.body.append(overlay);
    nameInput.focus();
  });
}
