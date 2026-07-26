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
  getUserRoutines,
  getStretchMap,
  getAllStretches,
  getStretch,
  stretchInUse,
  makeStretchId,
  buildSharePayload,
  encodeShare,
  decodeShare,
  importSharePayload,
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

// --- Share / export ---

test('encodeShare/decodeShare round-trips a payload (UTF-8 safe)', () => {
  const payload = {
    v: 1,
    routine: {
      id: 'x',
      name: 'Café Ω routine',
      description: 'ünïcode',
      builtIn: false,
      items: [{ stretchId: 'chin-tuck', seconds: 30 }],
    },
    stretches: [],
  };
  assert.deepEqual(decodeShare(encodeShare(payload)), payload);
});

test('buildSharePayload embeds referenced custom stretches but not built-ins', () => {
  reset();
  setUserStretches([customStretch('ustr-1')]);
  const routine = {
    id: 'user-r',
    name: 'R',
    description: '',
    builtIn: false,
    items: [
      { stretchId: 'chin-tuck', seconds: 30 }, // built-in — not embedded
      { stretchId: 'ustr-1', seconds: 20 }, // custom — embedded
    ],
  };
  const payload = buildSharePayload(routine);
  assert.equal(payload.v, 1);
  assert.deepEqual(
    payload.stretches.map((s) => s.id),
    ['ustr-1'],
  );
});

test('importSharePayload regenerates ids, remaps refs, and registers the routine', () => {
  reset();
  const payload = {
    v: 1,
    routine: {
      id: 'user-orig',
      name: 'Imported',
      description: 'd',
      builtIn: false,
      items: [
        { stretchId: 'chin-tuck', seconds: 30 },
        { block: [{ stretchId: 'ustr-orig', seconds: 20 }] },
      ],
    },
    stretches: [
      {
        id: 'ustr-orig',
        name: 'Custom C',
        area: 'A',
        description: 'dc',
        defaultSeconds: 20,
        perSide: true,
      },
    ],
  };
  const routine = importSharePayload(payload);

  assert.match(routine.id, /^user-/);
  assert.notEqual(routine.id, 'user-orig');
  assert.ok(getUserRoutines().some((r) => r.id === routine.id));

  const custom = getUserStretches();
  assert.equal(custom.length, 1);
  assert.match(custom[0].id, /^ustr-/);
  assert.notEqual(custom[0].id, 'ustr-orig', 'custom stretch id regenerated');

  const block = routine.items.find((it) => 'block' in it);
  assert.ok(block && 'block' in block);
  assert.equal(block.block[0].stretchId, custom[0].id, 'block ref remapped to the new id');
  assert.ok(getStretch(block.block[0].stretchId), 'remapped ref resolves');

  const plain = routine.items.find((it) => !('block' in it));
  assert.ok(plain && !('block' in plain));
  assert.equal(plain.stretchId, 'chin-tuck', 'built-in ref left unchanged');
});

test('importSharePayload rejects an unsupported version', () => {
  reset();
  assert.throws(
    () => importSharePayload({ v: 2, routine: { items: [] }, stretches: [] }),
    /Unrecognised|unsupported/,
  );
});

test('importSharePayload drops references it cannot resolve', () => {
  reset();
  const routine = importSharePayload({
    v: 1,
    routine: {
      id: 'r',
      name: 'R',
      description: '',
      builtIn: false,
      items: [
        { stretchId: 'chin-tuck', seconds: 30 },
        { stretchId: 'ustr-missing', seconds: 20 }, // not embedded → dropped
      ],
    },
    stretches: [],
  });
  assert.equal(routine.items.length, 1);
  assert.ok(!('block' in routine.items[0]) && routine.items[0].stretchId === 'chin-tuck');
});

test('export → import yields an independent working copy', () => {
  reset();
  setUserStretches([customStretch('ustr-1')]);
  const original = {
    id: 'user-r',
    name: 'Round Trip',
    description: '',
    builtIn: false,
    items: [{ stretchId: 'ustr-1', seconds: 25 }],
  };
  const imported = importSharePayload(decodeShare(encodeShare(buildSharePayload(original))));

  assert.notEqual(imported.id, original.id);
  assert.equal(imported.name, 'Round Trip');
  const ref = imported.items[0];
  assert.ok(!('block' in ref));
  assert.notEqual(ref.stretchId, 'ustr-1', 'ref remapped to the imported copy');
  assert.ok(getStretch(ref.stretchId), 'imported routine resolves against the library');
});
