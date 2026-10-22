import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/**
 * Integration coverage for the *built artifact*, not just the sources.
 *
 * The bundle registers itself through `window.__ModuleLoader__` and exposes
 * `{ inject, apply }`. Booting that module in a sandbox proves the wrapper, the
 * module concatenation and the slot registrations all line up, which a source
 * unit test cannot show.
 */

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8');

function bootBundle() {
  let registration = null;
  const context = {
    window: {
      __ModuleLoader__: {
        load(config) {
          registration = config;
        }
      }
    },
    console,
    setTimeout,
    clearTimeout
  };
  vm.runInNewContext(source, context, { filename: 'client.js' });
  assert.ok(registration, 'the bundle must register itself with the module loader');
  assert.equal(registration.id, 'dsh-weather-panel', 'factory id equals the package name');
  const module = registration.factory(name => {
    if (name === 'react') return { createElement: () => null };
    throw new Error(`unexpected module request: ${name}`);
  });
  return module;
}

function createContext(state) {
  const effects = [];
  const registrations = [];
  const localeDicts = [];
  const ctx = {
    effect(setup, label) {
      const dispose = setup();
      effects.push({ label, dispose });
      return dispose;
    },
    inject(names, callback) {
      if (names.includes('layout')) callback({ layout: state.layout });
    },
    locale: {
      register(namespace, dicts) {
        localeDicts.push({ namespace, dicts });
        return () => {};
      },
      bind(namespace) {
        return key => (namespace === 'dsh-weather-panel' ? state.messages[key] || key : key);
      },
      getSnapshot: () => ({ active: 'zh' }),
      subscribe: () => () => {}
    },
    slots: {
      inject(owner, callback) {
        return callback();
      },
      register(options) {
        registrations.push(options);
        return () => {
          registrations.push({ disposed: options.key || options.id });
        };
      }
    }
  };
  return { ctx, effects, registrations, localeDicts };
}

test('the bundle boots and declares the services it needs', () => {
  const module = bootBundle();
  assert.deepEqual(Array.from(module.inject), ['slots', 'locale']);
  assert.equal(typeof module.apply, 'function');
});

test('apply registers exactly one additive panel and one sidebar entry', () => {
  const module = bootBundle();
  const panelCalls = [];
  const state = {
    layout: {
      panelInfo: { getSnapshot: () => ({ activePanelId: 'dsh-weather-panel' }) },
      selectPanel: value => panelCalls.push(value)
    },
    messages: { 'nav.label': '天气' }
  };
  const { ctx, effects, registrations, localeDicts } = createContext(state);

  module.apply(ctx);

  assert.equal(localeDicts.length, 1, 'dictionaries are registered once');
  assert.equal(localeDicts[0].namespace, 'dsh-weather-panel');
  assert.ok(localeDicts[0].dicts.zh && localeDicts[0].dicts.en);

  const main = registrations.find(entry => entry.name === 'main');
  assert.ok(main, 'registers a main panel');
  assert.equal(main.key, 'dsh-weather-panel', 'uses its own key, never the host conversation key');
  assert.equal(typeof main.inject, 'function');
  const injected = main.inject();
  assert.equal(injected.t('nav.label'), '天气');
  assert.equal(typeof injected.closePanel, 'function');

  const entry = registrations.find(item => item.name === 'sidebar.panellist');
  assert.ok(entry, 'registers a sidebar icon');
  assert.equal(entry.id, 'dsh-weather-panel', 'uses its own id, never a shipped one');
  assert.equal(entry.order, 20);
  assert.equal(entry.label(), '天气', 'label thunk resolves through the locale service');

  assert.equal(effects.length, 2, 'dictionaries + registrations are owned by effects');
  assert.ok(registrations.filter(item => item.disposed === undefined).length === 2, 'exactly two slot registrations');
});

test('unloading leaves the panel before removing its page', () => {
  const module = bootBundle();
  const panelCalls = [];
  const state = {
    layout: {
      panelInfo: { getSnapshot: () => ({ activePanelId: 'dsh-weather-panel' }) },
      selectPanel: value => panelCalls.push(value)
    },
    messages: {}
  };
  const { ctx, effects } = createContext(state);
  module.apply(ctx);

  const registrationEffect = effects.find(item => String(item.label).includes('sidebar')) || effects[1];
  registrationEffect.dispose();
  assert.deepEqual(panelCalls, [null], 'closes our own panel when it was active');
});

test('a host without the layout service still applies cleanly', () => {
  const module = bootBundle();
  const state = { layout: null, messages: {} };
  const { ctx, effects } = createContext(state);
  assert.doesNotThrow(() => module.apply(ctx));
  const registrationEffect = effects[1];
  assert.doesNotThrow(() => registrationEffect.dispose());
});
