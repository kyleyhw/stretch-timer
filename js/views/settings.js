/**
 * @file Settings view: prep/switch timing and cue preferences. Changes are applied immediately
 * via the onChange sink.
 */

import { el, clear, icon } from '../ui.js';
import { stretchFormModal } from './stretchForm.js';

/** @typedef {import('../settings.js').AppSettings} AppSettings */
/** @typedef {import('../settings.js').ThemePref} ThemePref */
/** @typedef {import('../types.js').Stretch} Stretch */

/**
 * @typedef {object} SettingsContext
 * @property {AppSettings} settings
 * @property {(patch: Partial<AppSettings>) => void} onChange
 * @property {() => void} onBack
 * @property {{ vibration: boolean, wakeLock: boolean }} caps Capability flags for optional cues.
 * @property {() => Stretch[]} getCustomStretches Current custom-stretch library.
 * @property {(id: string) => boolean} isStretchInUse Whether a routine references the stretch.
 * @property {(stretch: Stretch) => void} onStretchSave Persist an edited custom stretch.
 * @property {(id: string) => void} onStretchDelete Delete a custom stretch.
 * @property {(raw: string) => string | null} onImport Import a routine from link/JSON; error or null.
 */

/**
 * Modal to import a routine from a pasted link/JSON or a .json file.
 * @param {(raw: string) => string | null} onImport
 * @returns {void}
 */
function openImportModal(onImport) {
  const textarea = /** @type {HTMLTextAreaElement} */ (
    el('textarea', {
      class: 'field-input',
      rows: '4',
      placeholder: 'Paste a share link or JSON',
    })
  );
  const fileInput = /** @type {HTMLInputElement} */ (
    el('input', { type: 'file', accept: '.json,application/json', class: 'field-input' })
  );
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    if (file) textarea.value = await file.text();
  });

  const err = el('p', { class: 'editor-error', role: 'alert' });
  const cancel = el('button', { class: 'ctrl-btn', text: 'Cancel' });
  const doImport = el('button', { class: 'ctrl-btn primary', text: 'Import' });

  const overlay = el(
    'div',
    { class: 'modal-overlay' },
    el(
      'div',
      { class: 'modal modal-form', role: 'dialog', 'aria-modal': 'true' },
      el('h2', { class: 'modal-title', text: 'Import a routine' }),
      textarea,
      el('p', { class: 'settings-note', text: 'or choose a file' }),
      fileInput,
      err,
      el('div', { class: 'modal-actions' }, cancel, doImport),
    ),
  );

  const finish = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  /** @param {KeyboardEvent} e */
  const onKey = (e) => {
    if (e.key === 'Escape') finish();
  };
  cancel.addEventListener('click', finish);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) finish();
  });
  doImport.addEventListener('click', () => {
    const error = onImport(textarea.value);
    if (error) err.textContent = error;
    else finish(); // success navigates away
  });
  document.addEventListener('keydown', onKey);
  document.body.append(overlay);
  textarea.focus();
}

/**
 * A labelled on/off switch backed by a checkbox.
 * @param {string} label
 * @param {boolean} value
 * @param {boolean} disabled
 * @param {(on: boolean) => void} onToggle
 * @returns {HTMLElement}
 */
function toggleRow(label, value, disabled, onToggle) {
  const input = el('input', { type: 'checkbox', class: 'toggle-input' });
  const checkbox = /** @type {HTMLInputElement} */ (input);
  checkbox.checked = value;
  checkbox.disabled = disabled;
  checkbox.addEventListener('change', () => onToggle(checkbox.checked));
  return el(
    'label',
    { class: `setting-row${disabled ? ' setting-row--disabled' : ''}` },
    el('span', { class: 'setting-label', text: label }),
    el('span', { class: 'toggle' }, checkbox, el('span', { class: 'toggle-track' })),
  );
}

/**
 * A labelled segmented control (single-select). Options render as pills; the active one is tinted.
 * @param {string} label
 * @param {ReadonlyArray<{ value: string, label: string }>} options
 * @param {string} value
 * @param {(v: string) => void} onSelect
 * @returns {HTMLElement}
 */
function segmentedRow(label, options, value, onSelect) {
  const buttons = options.map((opt) => {
    const b = el('button', {
      class: `segmented-option${opt.value === value ? ' is-active' : ''}`,
      text: opt.label,
    });
    b.addEventListener('click', () => {
      for (const other of buttons) other.classList.remove('is-active');
      b.classList.add('is-active');
      onSelect(opt.value);
    });
    return b;
  });
  return el(
    'div',
    { class: 'setting-row setting-full' },
    el('span', { class: 'setting-label', text: label }),
    el('div', { class: 'segmented' }, buttons),
  );
}

/**
 * A stepper (− value +) for an integer setting.
 * @param {string} label
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @param {(v: number) => void} onSet
 * @returns {HTMLElement}
 */
function stepperRow(label, value, min, max, onSet) {
  const valueEl = el('span', { class: 'stepper-value', text: `${value}s` });
  let v = value;
  /** @param {number} next */
  const apply = (next) => {
    v = Math.min(max, Math.max(min, next));
    valueEl.textContent = `${v}s`;
    onSet(v);
  };
  const minus = el(
    'button',
    { class: 'stepper-btn', 'aria-label': `Decrease ${label}` },
    icon('minus'),
  );
  const plus = el(
    'button',
    { class: 'stepper-btn', 'aria-label': `Increase ${label}` },
    icon('plus'),
  );
  minus.addEventListener('click', () => apply(v - 1));
  plus.addEventListener('click', () => apply(v + 1));
  return el(
    'div',
    { class: 'setting-row' },
    el('span', { class: 'setting-label', text: label }),
    el('span', { class: 'stepper' }, minus, valueEl, plus),
  );
}

/**
 * @param {HTMLElement} container
 * @param {SettingsContext} ctx
 * @returns {void}
 */
export function mountSettings(container, ctx) {
  clear(container);
  const s = ctx.settings;

  const backBtn = el('button', { class: 'icon-btn', 'aria-label': 'Back' }, icon('back'));
  backBtn.addEventListener('click', ctx.onBack);

  // Count-in depends on Sound: build its input up-front so the Sound toggle can disable it live.
  const countInInput = /** @type {HTMLInputElement} */ (
    el('input', { type: 'checkbox', class: 'toggle-input' })
  );
  countInInput.checked = s.countIn;
  countInInput.disabled = !s.sound;
  countInInput.addEventListener('change', () => ctx.onChange({ countIn: countInInput.checked }));
  const countInRow = el(
    'label',
    { class: `setting-row${s.sound ? '' : ' setting-row--disabled'}` },
    el('span', { class: 'setting-label', text: 'Count-in ticks (last 3s)' }),
    el('span', { class: 'toggle' }, countInInput, el('span', { class: 'toggle-track' })),
  );

  const rows = [
    segmentedRow(
      'Theme',
      [
        { value: 'dark', label: 'Dark' },
        { value: 'light', label: 'Light' },
        { value: 'system', label: 'System' },
      ],
      s.theme,
      (v) => ctx.onChange({ theme: /** @type {ThemePref} */ (v) }),
    ),
    stepperRow('Get-ready time', s.prepSeconds, 0, 15, (v) => ctx.onChange({ prepSeconds: v })),
    stepperRow('Switch-sides time', s.switchSeconds, 0, 10, (v) =>
      ctx.onChange({ switchSeconds: v }),
    ),
    toggleRow('Pause between stretches', !s.autoAdvance, false, (on) =>
      ctx.onChange({ autoAdvance: !on }),
    ),
    toggleRow('Sound', s.sound, false, (on) => {
      ctx.onChange({ sound: on });
      countInInput.disabled = !on;
      countInRow.classList.toggle('setting-row--disabled', !on);
    }),
    countInRow,
  ];
  if (ctx.caps.vibration) {
    rows.push(toggleRow('Vibration', s.vibration, false, (on) => ctx.onChange({ vibration: on })));
  }
  if (ctx.caps.wakeLock) {
    rows.push(
      toggleRow('Keep screen awake', s.keepAwake, false, (on) => ctx.onChange({ keepAwake: on })),
    );
  }

  // "Your stretches": manage the custom library (edit/delete). Rebuilt in place after each change.
  const stretchesList = el('div', { class: 'settings-list' });
  function renderStretches() {
    clear(stretchesList);
    const list = ctx.getCustomStretches();
    if (list.length === 0) {
      stretchesList.append(
        el('p', {
          class: 'settings-note',
          text: 'None yet. Create one with "New stretch" while building a routine.',
        }),
      );
      return;
    }
    for (const s of list) {
      const inUse = ctx.isStretchInUse(s.id);
      const editBtn = /** @type {HTMLButtonElement} */ (
        el('button', { class: 'mini-btn', 'aria-label': `Edit ${s.name}` }, icon('edit'))
      );
      const delBtn = /** @type {HTMLButtonElement} */ (
        el('button', { class: 'mini-btn', 'aria-label': `Delete ${s.name}` }, icon('close'))
      );
      delBtn.disabled = inUse;
      if (inUse) delBtn.title = 'Used by a routine — remove it there first';
      editBtn.addEventListener('click', async () => {
        const data = await stretchFormModal('Edit stretch', s);
        if (!data) return;
        ctx.onStretchSave({ id: s.id, ...data });
        renderStretches();
      });
      delBtn.addEventListener('click', () => {
        ctx.onStretchDelete(s.id);
        renderStretches();
      });
      const meta = s.perSide ? `${s.area || 'Custom'} · per side` : s.area || 'Custom';
      stretchesList.append(
        el(
          'div',
          { class: 'setting-row' },
          el(
            'span',
            { class: 'setting-label' },
            el('span', { class: 'stretch-mg-name', text: s.name }),
            el('span', { class: 'stretch-mg-area', text: meta }),
          ),
          el('span', { class: 'editor-item-controls' }, editBtn, delBtn),
        ),
      );
    }
  }
  renderStretches();

  const importBtn = el(
    'button',
    { class: 'ctrl-btn' },
    icon('download'),
    el('span', { text: 'Import a routine' }),
  );
  importBtn.addEventListener('click', () => openImportModal(ctx.onImport));

  container.append(
    el(
      'section',
      { class: 'view view-settings' },
      el(
        'header',
        { class: 'detail-header' },
        backBtn,
        el('h1', { class: 'detail-title', text: 'Settings' }),
      ),
      el('div', { class: 'settings-list' }, rows),
      el('h2', { class: 'settings-subhead', text: 'Your stretches' }),
      stretchesList,
      el('h2', { class: 'settings-subhead', text: 'Routines' }),
      el('div', { class: 'editor-add-buttons' }, importBtn),
    ),
  );
}
