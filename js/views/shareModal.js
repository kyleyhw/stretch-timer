/**
 * @file "Share routine" modal: shows a copyable import link and a .json download. Purely
 * presentational — the caller passes the already-encoded link, the JSON text, and a filename.
 */

import { el, icon } from '../ui.js';

/**
 * @param {{ link: string, json: string, filename: string }} opts
 * @returns {void}
 */
export function shareModal({ link, json, filename }) {
  const linkInput = /** @type {HTMLInputElement} */ (
    el('input', { class: 'field-input', type: 'text', readonly: 'readonly' })
  );
  linkInput.value = link;
  linkInput.addEventListener('focus', () => linkInput.select());

  const copyBtn = el('button', { class: 'ctrl-btn', 'aria-label': 'Copy link' }, icon('share'));
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      linkInput.select(); // clipboard blocked (insecure context) — fall back to a selection
      try {
        document.execCommand('copy');
      } catch {
        /* leave it selected for a manual copy */
      }
    }
    copyBtn.classList.add('is-active');
    copyBtn.textContent = 'Copied';
    setTimeout(() => {
      copyBtn.classList.remove('is-active');
      copyBtn.replaceChildren(icon('share'));
    }, 1400);
  });

  const downloadBtn = el(
    'button',
    { class: 'ctrl-btn' },
    icon('download'),
    el('span', { text: 'Download .json' }),
  );
  downloadBtn.addEventListener('click', () => {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = /** @type {HTMLAnchorElement} */ (el('a', { href: url, download: filename }));
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  const close = el('button', { class: 'ctrl-btn primary', text: 'Done' });

  const overlay = el(
    'div',
    { class: 'modal-overlay' },
    el(
      'div',
      { class: 'modal modal-form', role: 'dialog', 'aria-modal': 'true' },
      el('h2', { class: 'modal-title', text: 'Share routine' }),
      el('p', {
        class: 'settings-note',
        text: 'Anyone who opens this link gets a copy — custom stretches included.',
      }),
      el('div', { class: 'share-link-row' }, linkInput, copyBtn),
      el('div', { class: 'editor-add-buttons' }, downloadBtn),
      el('div', { class: 'modal-actions' }, close),
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
  close.addEventListener('click', finish);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) finish();
  });
  document.addEventListener('keydown', onKey);
  document.body.append(overlay);
  copyBtn.focus();
}
