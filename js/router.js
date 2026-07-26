/**
 * @file Hash-based router. GitHub Pages needs no server rewrites for hash routes, and refreshes
 * never 404. Each handler may return a cleanup function that runs before the next view mounts.
 */

/** @typedef {Record<string, string>} RouteParams */

/**
 * @typedef {object} Route
 * @property {string} pattern Path pattern, e.g. "/play/:id".
 * @property {(params: RouteParams) => void | (() => void)} handler Returns an optional cleanup.
 */

/**
 * Match a path against a pattern, extracting `:param` segments.
 * @param {string} pattern
 * @param {string} path
 * @returns {RouteParams | null}
 */
function match(pattern, path) {
  const pp = pattern.split('/').filter(Boolean);
  const xp = path.split('/').filter(Boolean);
  if (pp.length !== xp.length) return null;
  /** @type {RouteParams} */
  const params = {};
  for (let i = 0; i < pp.length; i++) {
    const seg = pp[i];
    if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(xp[i]);
    else if (seg !== xp[i]) return null;
  }
  return params;
}

/**
 * @param {Route[]} routes
 * @param {() => void | (() => void)} [notFound]
 * @returns {{ start: () => void, navigate: (path: string) => void }}
 */
export function createRouter(routes, notFound) {
  /** @type {(() => void) | null} */
  let cleanup = null;

  /** @param {void | (() => void)} c */
  function setCleanup(c) {
    cleanup = typeof c === 'function' ? c : null;
  }

  function resolve() {
    const raw = location.hash.replace(/^#/, '') || '/';
    const qIndex = raw.indexOf('?');
    const path = (qIndex >= 0 ? raw.slice(0, qIndex) : raw) || '/';
    const query = new URLSearchParams(qIndex >= 0 ? raw.slice(qIndex + 1) : '');
    if (cleanup) cleanup();
    cleanup = null;
    for (const route of routes) {
      const params = match(route.pattern, path);
      if (params) {
        // Query-string values (e.g. ?d=… on an import link) are exposed as params too.
        for (const [k, v] of query) if (!(k in params)) params[k] = v;
        setCleanup(route.handler(params));
        return;
      }
    }
    if (notFound) setCleanup(notFound());
  }

  window.addEventListener('hashchange', resolve);
  return {
    start: resolve,
    /** @param {string} path */
    navigate: (path) => {
      location.hash = path;
    },
  };
}
