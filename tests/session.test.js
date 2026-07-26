/**
 * @file Unit tests for the session state machine (js/session.js): routine expansion and the
 * step-driving Session, all under a deterministic injected clock/scheduler.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expandRoutine, Session } from '../js/session.js';

/** @typedef {import('../js/types.js').Stretch} Stretch */
/** @typedef {import('../js/types.js').Routine} Routine */

/** Controllable clock + manual frame scheduler (same contract as the timer harness). */
function makeHarness(start = 0) {
  let t = start;
  /** @type {Map<number, () => void>} */
  const pending = new Map();
  let nextHandle = 1;
  return {
    now: () => t,
    /** @type {(cb: () => void) => number} */
    schedule: (cb) => {
      const h = nextHandle++;
      pending.set(h, cb);
      return h;
    },
    /** @type {(h: number) => void} */
    cancel: (h) => {
      pending.delete(h);
    },
    /** @param {number} dt */
    advance: (dt) => {
      t += dt;
    },
    frame: () => {
      const cbs = [...pending.values()];
      pending.clear();
      for (const cb of cbs) cb();
    },
  };
}

/** @type {Record<string, Stretch>} */
const LIBRARY = {
  a: { id: 'a', name: 'A', area: 'x', description: 'da', defaultSeconds: 30, perSide: false },
  b: { id: 'b', name: 'B', area: 'y', description: 'db', defaultSeconds: 20, perSide: true },
};

/** @type {Routine} */
const ROUTINE = {
  id: 'r',
  name: 'R',
  description: '',
  builtIn: true,
  items: [
    { stretchId: 'a', seconds: 30 },
    { stretchId: 'b', seconds: 20 },
  ],
};

const SETTINGS = { prepSeconds: 5, switchSeconds: 3 };

// Expanded step layout (ms): boundaries at 0, 5000, 35000, 40000, 60000, 63000, 83000.
//  0 prep(a,null) 5000 | 1 hold(a,null) 30000 | 2 prep(b,left) 5000 |
//  3 hold(b,left) 20000 | 4 switch(b,right) 3000 | 5 hold(b,right) 20000

test('expandRoutine: plain stretch -> [prep, hold]; per-side -> [prep, hold, switch, hold]', () => {
  const steps = expandRoutine(ROUTINE, LIBRARY, SETTINGS);
  assert.deepEqual(
    steps.map((s) => [s.type, s.side, s.durationMs, s.stretchIndex]),
    [
      ['prep', null, 5000, 0],
      ['hold', null, 30000, 0],
      ['prep', 'left', 5000, 1],
      ['hold', 'left', 20000, 1],
      ['switch', 'right', 3000, 1],
      ['hold', 'right', 20000, 1],
    ],
  );
});

test('expandRoutine: prepSeconds 0 drops prep; switchSeconds 0 drops switch', () => {
  const steps = expandRoutine(ROUTINE, LIBRARY, { prepSeconds: 0, switchSeconds: 0 });
  assert.deepEqual(
    steps.map((s) => [s.type, s.side]),
    [
      ['hold', null],
      ['hold', 'left'],
      ['hold', 'right'],
    ],
  );
});

test('expandRoutine: unknown stretch id throws', () => {
  const bad = { ...ROUTINE, items: [{ stretchId: 'missing', seconds: 10 }] };
  assert.throws(() => expandRoutine(bad, LIBRARY, SETTINGS), /unknown stretchId/);
});

test('start emits the first step; steps auto-advance in order to completion', () => {
  const h = makeHarness();
  const steps = expandRoutine(ROUTINE, LIBRARY, SETTINGS);
  /** @type {string[]} */
  const changes = [];
  let completes = 0;
  const s = new Session(
    steps,
    {
      onStepChange: (step) => changes.push(`${step.type}:${step.side}`),
      onComplete: () => completes++,
    },
    h,
  );
  s.start();
  // Advance 1 s per frame across the whole 83 s session (boundaries are multiples of 1 s).
  for (let k = 0; k < 90 && !s.completed; k++) {
    h.advance(1000);
    h.frame();
  }
  assert.deepEqual(changes, [
    'prep:null',
    'hold:null',
    'prep:left',
    'hold:left',
    'switch:right',
    'hold:right',
  ]);
  assert.equal(completes, 1);
});

test('progress fraction is monotonic non-decreasing and reaches 1', () => {
  const h = makeHarness();
  const steps = expandRoutine(ROUTINE, LIBRARY, SETTINGS);
  /** @type {number[]} */
  const fracs = [];
  const s = new Session(steps, { onTick: (_r, _step, info) => fracs.push(info.fraction) }, h);
  s.start();
  for (let k = 0; k < 90 && !s.completed; k++) {
    h.advance(1000);
    h.frame();
  }
  for (let i = 1; i < fracs.length; i++) {
    assert.ok(fracs[i] >= fracs[i - 1] - 1e-9, `fraction decreased at ${i}`);
  }
  const finalFrac = fracs.at(-1) ?? 0;
  assert.ok(finalFrac >= 0.999, `final fraction should be ~1, got ${finalFrac}`);
});

test('stretchNumber counts distinct stretches; per-side steps share one number', () => {
  const h = makeHarness();
  const steps = expandRoutine(ROUTINE, LIBRARY, SETTINGS);
  /** @type {Map<string, number>} */
  const seen = new Map();
  const s = new Session(
    steps,
    { onStepChange: (step, info) => seen.set(`${step.type}:${step.side}`, info.stretchNumber) },
    h,
  );
  s.start();
  for (let k = 0; k < 90 && !s.completed; k++) {
    h.advance(1000);
    h.frame();
  }
  assert.equal(seen.get('prep:null'), 1);
  assert.equal(seen.get('hold:null'), 1);
  assert.equal(seen.get('hold:left'), 2);
  assert.equal(seen.get('switch:right'), 2); // still stretch 2, not inflated by per-side steps
  assert.equal(seen.get('hold:right'), 2);
});

test('pause halts ticking; resume continues losslessly', () => {
  const h = makeHarness();
  const steps = expandRoutine(ROUTINE, LIBRARY, SETTINGS);
  let ticks = 0;
  const s = new Session(steps, { onTick: () => ticks++ }, h);
  s.start();
  h.advance(2000);
  h.frame();
  const before = ticks;
  s.pause();
  h.advance(50_000); // time passes while paused
  h.frame();
  assert.equal(ticks, before, 'no ticks should fire while paused');
  assert.equal(Math.round(s.elapsedMs()), 2000, 'elapsed frozen at pause');
  s.resume();
  h.advance(3000);
  h.frame();
  assert.equal(Math.round(s.elapsedMs()), 5000, 'resume continues from the paused elapsed');
});

test('next() skips to the first step of the next stretch', () => {
  const h = makeHarness();
  const steps = expandRoutine(ROUTINE, LIBRARY, SETTINGS);
  /** @type {string[]} */
  const changes = [];
  const s = new Session(
    steps,
    { onStepChange: (step) => changes.push(`${step.type}:${step.side}`) },
    h,
  );
  s.start();
  h.advance(10_000); // 10 s into stretch A's hold
  h.frame();
  s.next();
  // Landed on prep(b,left) at boundary 35_000.
  assert.equal(changes.at(-1), 'prep:left');
  assert.equal(Math.round(s.elapsedMs()), 35_000);
});

test('prev() restarts the current stretch when well into it', () => {
  const h = makeHarness();
  const steps = expandRoutine(ROUTINE, LIBRARY, SETTINGS);
  const s = new Session(steps, {}, h);
  s.start();
  h.advance(70_000); // deep into stretch B (right-side hold)
  h.frame();
  assert.equal(s.currentStep().stretchIndex, 1);
  s.prev();
  // > 2 s into stretch B -> restart B at its first step (prep b, boundary 35_000).
  assert.equal(Math.round(s.elapsedMs()), 35_000);
  assert.equal(s.currentStep().type, 'prep');
});

test('prev() near a stretch start jumps to the previous stretch', () => {
  const h = makeHarness();
  const steps = expandRoutine(ROUTINE, LIBRARY, SETTINGS);
  const s = new Session(steps, {}, h);
  s.start();
  h.advance(35_500); // 0.5 s into stretch B (within the 2 s guard)
  h.frame();
  s.prev();
  assert.equal(Math.round(s.elapsedMs()), 0, 'jumped back to the start of stretch A');
  assert.equal(s.currentStep().stretchIndex, 0);
});

test('quit() stops without firing onComplete', () => {
  const h = makeHarness();
  const steps = expandRoutine(ROUTINE, LIBRARY, SETTINGS);
  let completes = 0;
  let quits = 0;
  const s = new Session(steps, { onComplete: () => completes++, onQuit: () => quits++ }, h);
  s.start();
  h.advance(10_000);
  h.frame();
  s.quit();
  h.advance(100_000);
  h.frame();
  assert.equal(quits, 1);
  assert.equal(completes, 0);
  assert.equal(s.running, false);
});

test('reconcile() lands on the correct step after a long hidden gap', () => {
  const h = makeHarness();
  const steps = expandRoutine(ROUTINE, LIBRARY, SETTINGS);
  /** @type {number[]} */
  const stepIdx = [];
  let completes = 0;
  const s = new Session(
    steps,
    { onStepChange: (_step, info) => stepIdx.push(info.stepIndex), onComplete: () => completes++ },
    h,
  );
  s.start(); // step 0
  // Simulate the tab being hidden: clock advances with no frames delivered.
  h.advance(40_000); // should land in step 3 (hold b left: boundary 40_000 is its start)
  s.reconcile();
  assert.equal(stepIdx.at(-1), 3);
  assert.equal(s.currentStep().type, 'hold');
  assert.equal(s.currentStep().side, 'left');
  // Hidden past the end, then a frame fires completion.
  h.advance(60_000);
  s.reconcile();
  h.frame();
  assert.equal(completes, 1);
});

/** @type {Record<string, import('../js/types.js').Stretch>} */
const BLOCK_LIB = {
  x: { id: 'x', name: 'X', area: '', description: 'dx', defaultSeconds: 30, perSide: false },
  y: { id: 'y', name: 'Y', area: '', description: 'dy', defaultSeconds: 20, perSide: true },
};

test('expandRoutine: a per-side block runs all stretches on one side, then the other', () => {
  /** @type {import('../js/types.js').Routine} */
  const routine = {
    id: 'r',
    name: 'R',
    description: '',
    builtIn: true,
    items: [
      {
        block: [
          { stretchId: 'x', seconds: 30 },
          { stretchId: 'y', seconds: 20 },
        ],
      },
    ],
  };
  const steps = expandRoutine(routine, BLOCK_LIB, { prepSeconds: 5, switchSeconds: 3 });
  assert.deepEqual(
    steps.map((s) => [s.type, s.side, s.stretchName, s.durationMs, s.stretchIndex]),
    [
      ['prep', 'left', 'X', 5000, 0],
      ['hold', 'left', 'X', 30000, 0],
      ['hold', 'left', 'Y', 20000, 1],
      ['switch', 'right', 'X', 3000, 2],
      ['hold', 'right', 'X', 30000, 2],
      ['hold', 'right', 'Y', 20000, 3],
    ],
  );
});

test('expandRoutine: block honours prep/switch = 0 (holds only, grouped by side)', () => {
  /** @type {import('../js/types.js').Routine} */
  const routine = {
    id: 'r',
    name: 'R',
    description: '',
    builtIn: true,
    items: [
      {
        block: [
          { stretchId: 'x', seconds: 30 },
          { stretchId: 'y', seconds: 20 },
        ],
      },
    ],
  };
  const steps = expandRoutine(routine, BLOCK_LIB, { prepSeconds: 0, switchSeconds: 0 });
  assert.deepEqual(
    steps.map((s) => [s.type, s.side, s.stretchName]),
    [
      ['hold', 'left', 'X'],
      ['hold', 'left', 'Y'],
      ['hold', 'right', 'X'],
      ['hold', 'right', 'Y'],
    ],
  );
});

test('Session plays a block all on one side then the other; count covers every hold', () => {
  const h = makeHarness();
  /** @type {import('../js/types.js').Routine} */
  const routine = {
    id: 'r',
    name: 'R',
    description: '',
    builtIn: true,
    items: [
      {
        block: [
          { stretchId: 'x', seconds: 1 },
          { stretchId: 'y', seconds: 1 },
        ],
      },
    ],
  };
  const steps = expandRoutine(routine, BLOCK_LIB, { prepSeconds: 0, switchSeconds: 0 });
  /** @type {string[]} */
  const changes = [];
  let count = 0;
  const s = new Session(
    steps,
    {
      onStepChange: (step, info) => {
        changes.push(`${step.stretchName}:${step.side}`);
        count = info.stretchCount;
      },
    },
    h,
  );
  s.start();
  for (let k = 0; k < 10 && !s.completed; k++) {
    h.advance(1000);
    h.frame();
  }
  assert.deepEqual(changes, ['X:left', 'Y:left', 'X:right', 'Y:right']);
  assert.equal(count, 4); // two stretches × two sides, each its own progress unit
});

// --- itemIndex + pause-between-stretches (auto-advance) ---

test('expandRoutine: itemIndex groups a block under one item; plain items each increment', () => {
  const lib = { ...LIBRARY, ...BLOCK_LIB };
  /** @type {import('../js/types.js').Routine} */
  const routine = {
    id: 'r',
    name: 'R',
    description: '',
    builtIn: true,
    items: [
      { stretchId: 'a', seconds: 30 },
      {
        block: [
          { stretchId: 'x', seconds: 30 },
          { stretchId: 'y', seconds: 20 },
        ],
      },
      { stretchId: 'a', seconds: 10 },
    ],
  };
  const steps = expandRoutine(routine, lib, { prepSeconds: 5, switchSeconds: 3 });
  assert.deepEqual(
    steps.map((s) => [s.itemIndex, s.stretchIndex, s.type, s.side]),
    [
      [0, 0, 'prep', null],
      [0, 0, 'hold', null],
      [1, 1, 'prep', 'left'], // block: one item, inner holds share itemIndex 1
      [1, 1, 'hold', 'left'], // X left
      [1, 2, 'hold', 'left'], // Y left
      [1, 3, 'switch', 'right'],
      [1, 3, 'hold', 'right'], // X right
      [1, 4, 'hold', 'right'], // Y right
      [2, 5, 'prep', null],
      [2, 5, 'hold', null],
    ],
  );
});

test('auto-advance off: session waits at each new routine item until proceed()', () => {
  const h = makeHarness();
  const steps = expandRoutine(ROUTINE, LIBRARY, SETTINGS);
  /** @type {string[]} */
  const changes = [];
  /** @type {string[]} */
  const waits = [];
  let completes = 0;
  const s = new Session(
    steps,
    {
      onStepChange: (step) => changes.push(`${step.type}:${step.side}`),
      onWaiting: (step) => waits.push(`${step.type}:${step.side}@${Math.round(s.elapsedMs())}`),
      onComplete: () => completes++,
    },
    h,
    { autoAdvance: false },
  );
  s.start();
  // Item 0 (prep a, hold a) plays; the session then holds before item 1.
  for (let k = 0; k < 45 && !s.waiting; k++) {
    h.advance(1000);
    h.frame();
  }
  assert.equal(s.waiting, true);
  assert.deepEqual(changes, ['prep:null', 'hold:null'], 'item 1 has not started');
  assert.deepEqual(waits, ['prep:left@35000'], 'waiting announced at the item-1 boundary');

  // The clock is frozen at the boundary while waiting, no matter how much time passes.
  h.advance(50_000);
  h.frame();
  assert.equal(Math.round(s.elapsedMs()), 35_000, 'clock frozen at the boundary while waiting');
  assert.deepEqual(changes, ['prep:null', 'hold:null']);

  // proceed() plays item 1 through to completion; only the one boundary ever waited.
  s.proceed();
  for (let k = 0; k < 60 && !s.completed; k++) {
    h.advance(1000);
    h.frame();
  }
  assert.deepEqual(changes, [
    'prep:null',
    'hold:null',
    'prep:left',
    'hold:left',
    'switch:right',
    'hold:right',
  ]);
  assert.equal(completes, 1);
  assert.equal(waits.length, 1, 'only the a→b item boundary triggers a wait');
});

test('auto-advance off: transitions within one item (per-side / block) never wait', () => {
  const h = makeHarness();
  /** @type {import('../js/types.js').Routine} */
  const routine = {
    id: 'r',
    name: 'R',
    description: '',
    builtIn: true,
    items: [{ stretchId: 'b', seconds: 1 }], // one per-side stretch = one item
  };
  const steps = expandRoutine(routine, LIBRARY, { prepSeconds: 0, switchSeconds: 1 });
  /** @type {string[]} */
  const changes = [];
  let waits = 0;
  let completes = 0;
  const s = new Session(
    steps,
    {
      onStepChange: (step) => changes.push(`${step.type}:${step.side}`),
      onWaiting: () => waits++,
      onComplete: () => completes++,
    },
    h,
    { autoAdvance: false },
  );
  s.start();
  for (let k = 0; k < 20 && !s.completed; k++) {
    h.advance(1000);
    h.frame();
  }
  assert.deepEqual(changes, ['hold:left', 'switch:right', 'hold:right']);
  assert.equal(waits, 0, 'left→right within one item does not wait');
  assert.equal(completes, 1);
});

test('auto-advance on (default): plays straight through with no onWaiting', () => {
  const h = makeHarness();
  const steps = expandRoutine(ROUTINE, LIBRARY, SETTINGS);
  let waits = 0;
  let completes = 0;
  const s = new Session(steps, { onWaiting: () => waits++, onComplete: () => completes++ }, h);
  s.start();
  for (let k = 0; k < 90 && !s.completed; k++) {
    h.advance(1000);
    h.frame();
  }
  assert.equal(waits, 0);
  assert.equal(completes, 1);
});

test('auto-advance off: next() plays through the gate (explicit navigation, no wait)', () => {
  const h = makeHarness();
  const steps = expandRoutine(ROUTINE, LIBRARY, SETTINGS);
  /** @type {string[]} */
  const changes = [];
  let waits = 0;
  const s = new Session(
    steps,
    { onStepChange: (step) => changes.push(`${step.type}:${step.side}`), onWaiting: () => waits++ },
    h,
    { autoAdvance: false },
  );
  s.start();
  h.advance(10_000); // into hold a
  h.frame();
  s.next(); // skip to stretch b
  assert.equal(waits, 0, 'an explicit skip does not enter the wait state');
  assert.equal(s.waiting, false);
  assert.equal(changes.at(-1), 'prep:left');
});
