import test from 'node:test';
import assert from 'node:assert/strict';

import { createTtlCache } from '../src/lib/cache.js';

function createMemoryStorage() {
  const map = new Map();
  return {
    map,
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: key => {
      map.delete(key);
    }
  };
}

test('values round-trip and carry the namespace prefix', () => {
  const storage = createMemoryStorage();
  const cache = createTtlCache(storage, 'pref:', () => 1000);
  assert.equal(cache.get('a'), undefined);
  assert.equal(cache.set('a', { value: 1 }, 5000), true);
  assert.deepEqual(cache.get('a'), { value: 1 });
  assert.ok(storage.map.has('pref:a'));
  assert.equal(cache.savedAt('a'), 1000);
});

test('expiry is evaluated against the injected clock', () => {
  let now = 0;
  const storage = createMemoryStorage();
  const cache = createTtlCache(storage, 'ns:', () => now);
  cache.set('geocode', { city: 'Dongguan' }, 1000);
  assert.deepEqual(cache.get('geocode'), { city: 'Dongguan' });

  now = 999;
  assert.deepEqual(cache.get('geocode'), { city: 'Dongguan' });

  now = 1000;
  assert.equal(cache.get('geocode'), undefined, 'expired at exactly the TTL');
  assert.equal(storage.map.has('ns:geocode'), false, 'expired entries are dropped');
});

test('corrupt or foreign JSON is treated as a cache miss', () => {
  const storage = createMemoryStorage();
  const cache = createTtlCache(storage, 'ns:');
  storage.setItem('ns:broken', '{not json');
  storage.setItem('ns:foreign', JSON.stringify({ other: true }));
  assert.equal(cache.get('broken'), undefined);
  assert.equal(cache.get('foreign'), undefined);
  assert.equal(cache.savedAt('broken'), null);
});

test('a throwing storage never breaks the caller', () => {
  const failing = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('quota');
    },
    removeItem: () => {
      throw new Error('blocked');
    }
  };
  const cache = createTtlCache(failing, 'ns:');
  assert.equal(cache.set('a', 1, 10), false);
  assert.equal(cache.get('a'), undefined);
  assert.doesNotThrow(() => cache.delete('a'));
});

test('delete and a zero/negative TTL', () => {
  let now = 0;
  const storage = createMemoryStorage();
  const cache = createTtlCache(storage, '', () => now);
  cache.set('a', 1, 100);
  cache.delete('a');
  assert.equal(cache.get('a'), undefined);

  cache.set('b', 2, 0);
  assert.equal(cache.get('b'), undefined, 'a zero TTL is immediately stale');

  cache.set('c', 3, -50);
  assert.equal(cache.get('c'), undefined, 'a negative TTL is clamped to stale');
});
