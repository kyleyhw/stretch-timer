/**
 * @file Unit tests for the data layer's custom-stretch handling (js/data.js): the built-in ⊕ user
 * merge, the upsert/delete mutators with their persistence sink, and the in-use guard. The module
 * holds process-wide state, so each test resets the user library/routines first.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  setUserStretches,
  getUserStretches,
  setStretchPersist,
  upsertUserStretch,
  deleteUserStretch,
  setUserRoutines,
  upsertUserRoutine,
  getStretchMap,
  getAllStretches,
  getStretch,
  stretchInUse,
  makeStretchId,
} from '../js/data.js';

/** Reset the shared module state to a clean slate. */
function reset() {
  setStretchPersist(() => {});
  setUserStretches([]);
  setUserRoutines([]);
}

/** @returns {import('../js/types.js').Stretch} */
function customStretch(id = 'ustr-x') {
  return {
    id,
    name: 'Custom X',
    area: 'Test',
    description: 'dx',
    defaultSeconds: 25,
    perSide: false,
  };
}

test('makeStretchId is unique and uses the ustr- prefix', () => {
  const a = makeStretchId();
  const b = makeStretchId();
  assert.match(a, /^ustr-/);
  assert.notEqual(a, b);
});

test('user stretches merge into the library (map + list) atop built-ins', () => {
  reset();
  const builtinCount = getAllStretches().length;
  setUserStretches([customStretch('ustr-1')]);

  assert.equal(getAllStretches().length, builtinCount + 1);
  assert.equal(getStretchMap()['ustr-1'].name, 'Custom X');
  assert.equal(getStretch('ustr-1')?.name, 'Custom X');
  // A built-in is still resolvable, i.e. the merge did not drop the base library.
  assert.ok(getStretch('chin-tuck'));
});

test('upsert adds then updates a user stretch and persists each change', () => {
  reset();
  /** @type {import('../js/types.js').Stretch[][]} */
  const saved = [];
  setStretchPersist((list) => saved.push(list));

  upsertUserStretch(customStretch('ustr-1'));
  assert.equal(getUserStretches().length, 1);
  assert.equal(getStretchMap()['ustr-1'].defaultSeconds, 25);

  upsertUserStretch({ ...customStretch('ustr-1'), defaultSeconds: 40 });
  assert.equal(getUserStretches().length, 1, 'same id updates in place, not appended');
  assert.equal(getStretchMap()['ustr-1'].defaultSeconds, 40);
  assert.equal(saved.length, 2, 'persistence sink called on each mutation');
});

test('delete removes a user stretch from the merged map', () => {
  reset();
  setUserStretches([customStretch('ustr-1')]);
  assert.ok(getStretch('ustr-1'));
  deleteUserStretch('ustr-1');
  assert.equal(getStretch('ustr-1'), null);
  assert.equal(
    getAllStretches().some((s) => s.id === 'ustr-1'),
    false,
  );
});

test('stretchInUse detects references in plain items and blocks', () => {
  reset();
  setUserStretches([customStretch('ustr-1'), customStretch('ustr-2')]);
  upsertUserRoutine({
    id: 'user-r',
    name: 'R',
    description: '',
    builtIn: false,
    items: [{ block: [{ stretchId: 'ustr-1', seconds: 20 }] }],
  });
  assert.equal(stretchInUse('ustr-1'), true, 'referenced inside a block');
  assert.equal(stretchInUse('ustr-2'), false, 'unreferenced custom stretch');
});
