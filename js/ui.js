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
 * Inline line-icon set (Lucide-style): 24×24, drawn with `currentColor` so each icon inherits the
 * colour of its button. Kept as markup strings and parsed into the SVG namespace via innerHTML.
 * @type {Record<string, string>}
 */
const ICON_PATHS = {
  back: '<polyline points="15 18 9 12 15 6"/>',
  forward: '<polyline points="9 18 15 12 9 6"/>',
  up: '<polyline points="18 15 12 9 6 15"/>',
  down: '<polyline points="6 9 12 15 18 9"/>',
  close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
  // Sliders (the "settings/adjust" motif).
  settings:
    '<line x1="21" y1="4" x2="14" y2="4"/><line x1="10" y1="4" x2="3" y2="4"/>' +
    '<line x1="21" y1="12" x2="12" y2="12"/><line x1="8" y1="12" x2="3" y2="12"/>' +
    '<line x1="21" y1="20" x2="16" y2="20"/><line x1="12" y1="20" x2="3" y2="20"/>' +
    '<line x1="14" y1="2" x2="14" y2="6"/><line x1="8" y1="10" x2="8" y2="14"/>' +
    '<line x1="16" y1="18" x2="16" y2="22"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  share:
    '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>' +
    '<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
  download:
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/>' +
    '<line x1="12" y1="15" x2="12" y2="3"/>',
  prev: '<polygon points="19 20 9 12 19 4"/><line x1="5" y1="19" x2="5" y2="5"/>',
  next: '<polygon points="5 4 15 12 5 20"/><line x1="19" y1="5" x2="19" y2="19"/>',
  play: '<polygon points="6 4 20 12 6 20"/>',
  soundOn:
    '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19"/>' +
    '<path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
  soundOff:
    '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19"/>' +
    '<line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/>',
};

/** Icons that read better filled than stroked. */
const FILLED_ICONS = new Set(['prev', 'next', 'play']);

/**
 * Build an inline SVG icon by name (see {@link ICON_PATHS}). Inherits colour via `currentColor` and
 * sizes to `1.25em` by default (overridable in CSS). Decorative by default (`aria-hidden`); give the
 * enclosing button an `aria-label`.
 * @param {keyof typeof ICON_PATHS | string} name
 * @param {string} [extraClass] Extra class(es) for sizing/spacing.
 * @returns {SVGElement}
 */
export function icon(name, extraClass) {
  const node = document.createElementNS(SVG_NS, 'svg');
  node.setAttribute('viewBox', '0 0 24 24');
  node.setAttribute('fill', FILLED_ICONS.has(name) ? 'currentColor' : 'none');
  node.setAttribute('stroke', 'currentColor');
  node.setAttribute('stroke-width', '2');
  node.setAttribute('stroke-linecap', 'round');
  node.setAttribute('stroke-linejoin', 'round');
  node.setAttribute('class', extraClass ? `icon ${extraClass}` : 'icon');
  node.setAttribute('aria-hidden', 'true');
  node.innerHTML = ICON_PATHS[name] ?? '';
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
