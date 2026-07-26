/**
 * @file Settings view: prep/switch timing and cue preferences. Changes are applied immediately
 * via the onChange sink.
 */

import { el, clear, icon } from '../ui.js';

/** @typedef {import('../settings.js').AppSettings} AppSettings */
/** @typedef {import('../settings.js').ThemePref} ThemePref */

/**
 * @typedef {object} SettingsContext
 * @property {AppSettings} settings
 * @property {(patch: Partial<AppSettings>) => void} onChange
 * @property {() => void} onBack
 * @property {{ vibration: boolean, wakeLock: boolean }} caps Capability flags for optional cues.
 */

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
    ),
  );
}
