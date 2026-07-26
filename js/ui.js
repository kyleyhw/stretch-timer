/**
 * @file Minimal dependency-free DOM helpers used by all views.
 */

/** @typedef {Node | string | number | null | undefined} Child */

/**
 * Create an element. Special props: `class`, `text`, `dataset` (object), and `on<Event>` handler
 * functions; everything else is set as an attribute. Children may be nodes, strings, or arrays.
 * @param {string} tag
 * @param {Record<string, unknown>} [props]
 * @param {...(Child | Child[])} children
 * @returns {HTMLElement}
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined) continue;
    if (key === 'class') node.className = String(value);
    else if (key === 'text') node.textContent = String(value);
    else if (key === 'dataset' && typeof value === 'object') {
      Object.assign(node.dataset, /** @type {Record<string, string>} */ (value));
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), /** @type {EventListener} */ (value));
    } else {
      node.setAttribute(key, String(value));
    }
  }
  appendChildren(node, children);
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Create a namespaced SVG element. All props are set as attributes (`class` included); children may
 * be nodes, strings, or arrays. Kept separate from `el` because SVG requires createElementNS.
 * @param {string} tag
 * @param {Record<string, unknown>} [props]
 * @param {...(Child | Child[])} children
 * @returns {SVGElement}
 */
export function svg(tag, props = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined) continue;
    node.setAttribute(key, String(value));
  }
  appendChildren(node, children);
  return node;
}

/**
 * @param {Element} node
 * @param {Array<Child | Child[]>} children
 * @returns {void}
 */
function appendChildren(node, children) {
  for (const child of children) {
    if (Array.isArray(child)) {
      appendChildren(node, child);
    } else if (child !== null && child !== undefined) {
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
  }
}

/**
 * Remove all children of a node.
 * @param {HTMLElement} node
 * @returns {void}
 */
export function clear(node) {
  node.replaceChildren();
}

/**
 * Format a whole-second count as `S`, `SS`, or `M:SS`.
 * @param {number} totalSeconds
 * @returns {string}
 */
export function fmtClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s < 60) return String(s);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Show a modal confirmation dialog. Resolves true if confirmed, false on cancel / backdrop /
 * Escape.
 * @param {string} message
 * @param {string} [confirmText]
 * @returns {Promise<boolean>}
 */
export function confirmModal(message, confirmText = 'Confirm') {
  return new Promise((resolve) => {
    const cancel = el('button', { class: 'ctrl-btn', text: 'Cancel' });
    const ok = el('button', { class: 'ctrl-btn danger', text: confirmText });
    const overlay = el(
      'div',
      { class: 'modal-overlay' },
      el(
        'div',
        { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
        el('p', { class: 'modal-msg', text: message }),
        el('div', { class: 'modal-actions' }, cancel, ok),
      ),
    );
    /** @param {KeyboardEvent} e */
    const onKey = (e) => {
      if (e.key === 'Escape') finish(false);
    };
    /** @param {boolean} value */
    const finish = (value) => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve(value);
    };
    cancel.addEventListener('click', () => finish(false));
    ok.addEventListener('click', () => finish(true));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish(false);
    });
    document.addEventListener('keydown', onKey);
    document.body.append(overlay);
    ok.focus();
  });
}
