/**
 * @file Unit tests for the persistence layer (js/store.js). A fake backend is injected so the
 * versioning and fallback logic can be exercised in Node (which has no localStorage).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store, KEYS, SCHEMA_VERSION } from '../js/store.js';

/** A working in-memory StorageLike. */
function memBackend() {
  const m = new Map();
  return {
    /** @param {string} k */
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    /** @param {string} k @param {string} v */
    setItem: (k, v) => {
      m.set(k, String(v));
    },
    /** @param {string} k */
    removeItem: (k) => {
      m.delete(k);
    },
  };
}

/** A backend whose writes always throw (simulating a quota error); reads work. */
function throwingSetBackend() {
  const m = new Map();
  return {
    /** @param {string} k */
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: () => {
      throw new Error('QuotaExceeded');
    },
    removeItem: () => {},
  };
}

const sampleRoutine = {
  id: 'user-1',
  name: 'R',
  description: '',
  builtIn: false,
  items: [{ stretchId: 'a', seconds: 30 }],
};

test('round-trips user routines and merges settings', () => {
  const s = new Store(memBackend());
  assert.equal(s.persistent, true);
  assert.deepEqual(s.loadUserRoutines(), []);

  s.saveUserRoutines([sampleRoutine]);
  assert.deepEqual(s.loadUserRoutines(), [sampleRoutine]);

  s.saveSettings({ prepSeconds: 7, sound: false });
  assert.deepEqual(s.loadSettings({ prepSeconds: 5, sound: true, keepAwake: true }), {
    prepSeconds: 7,
    sound: false,
    keepAwake: true,
  });
});

test('round-trips user stretches', () => {
  const s = new Store(memBackend());
  assert.deepEqual(s.loadUserStretches(), []);
  const custom = {
    id: 'ustr-1',
    name: 'My Stretch',
    area: 'Neck',
    description: 'do the thing',
    defaultSeconds: 25,
    perSide: true,
  };
  s.saveUserStretches([custom]);
  assert.deepEqual(s.loadUserStretches(), [custom]);
});

test('writes schema meta on init', () => {
  const s = new Store(memBackend());
  assert.deepEqual(s.getJSON(KEYS.meta, null), { schemaVersion: SCHEMA_VERSION });
});

test('is non-persistent but usable in-session when no backend exists', () => {
  const s = new Store(null);
  assert.equal(s.persistent, false);
  s.saveUserRoutines([sampleRoutine]);
  assert.deepEqual(s.loadUserRoutines(), [sampleRoutine]);
});

test('falls back to the in-memory mirror and reports non-persistent when writes throw', () => {
  const s = new Store(throwingSetBackend());
  assert.equal(s.persistent, false); // meta write in the constructor already failed
  s.saveUserRoutines([sampleRoutine]);
  assert.deepEqual(s.loadUserRoutines(), [sampleRoutine]); // still readable this session
});

test('getJSON returns the fallback on corrupt data', () => {
  const backend = memBackend();
  backend.setItem(KEYS.userRoutines, '{ not valid json');
  const s = new Store(backend);
  assert.deepEqual(s.loadUserRoutines(), []);
});
