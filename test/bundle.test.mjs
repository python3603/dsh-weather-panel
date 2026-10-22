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
    clearTimeout,
    setInterval,
    clearInterval,
    AbortController,
    AbortSignal,
    // Offline by default: apply() must survive a dead network.
    fetch: () => Promise.reject(new Error('offline'))
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
      register(options, component) {
        registrations.push({ options, component });
        return () => {
          registrations.push({ disposed: options.key || options.id });
        };
      }
    }
  };
  return { ctx, effects, registrations, localeDicts };
}

const PANEL_STATE = () => ({
  layout: {
    panelInfo: { getSnapshot: () => ({ activePanelId: 'dsh-weather-panel' }) },
    selectPanel: value => PANEL_STATE.calls.push(value)
  },
  messages: { 'nav.label': '天气' }
});
PANEL_STATE.calls = [];

test('the bundle boots and declares the services it needs', () => {
  const module = bootBundle();
  assert.deepEqual(Array.from(module.inject), ['slots', 'locale']);
  assert.equal(typeof module.apply, 'function');
});

test('apply registers the panel, the sidebar entry and the startup notice', () => {
  const module = bootBundle();
  const state = PANEL_STATE();
  PANEL_STATE.calls.length = 0;
  const { ctx, effects, registrations, localeDicts } = createContext(state);

  module.apply(ctx);

  assert.equal(localeDicts.length, 1, 'dictionaries are registered once');
  assert.equal(localeDicts[0].namespace, 'dsh-weather-panel');
  assert.ok(localeDicts[0].dicts.zh && localeDicts[0].dicts.en);

  const main = registrations.find(entry => entry.options && entry.options.name === 'main');
  assert.ok(main, 'registers a main panel');
  assert.equal(main.options.key, 'dsh-weather-panel', 'uses its own key, never the host conversation key');
  const injected = main.options.inject();
  assert.equal(injected.t('nav.label'), '天气');
  assert.equal(typeof injected.closePanel, 'function');
  assert.ok(injected.store && typeof injected.store.getState === 'function', 'the panel shares one store');
  assert.equal(injected.store.getState().phase, 'locating', 'the store started fetching on apply');

  const entry = registrations.find(item => item.options && item.options.name === 'sidebar.panellist');
  assert.ok(entry, 'registers a sidebar icon');
  assert.equal(entry.options.id, 'dsh-weather-panel', 'uses its own id, never a shipped one');
  assert.equal(entry.options.order, 20);
  assert.equal(entry.options.label(), '天气', 'label thunk resolves through the locale service');

  const notice = registrations.find(item => item.options && item.options.name === 'shell.overlay');
  assert.ok(notice, 'registers the startup notice as an additive overlay');
  assert.equal(notice.options.id, 'dsh-weather-panel-notice');

  assert.equal(effects.length, 3, 'dictionaries + store + registrations are owned by effects');
  assert.equal(registrations.filter(item => item.disposed === undefined).length, 3, 'exactly three slot registrations');
  effects.forEach(item => { if (item.dispose) item.dispose(); });
});

test('unloading closes our panel and disposes the store', () => {
  const module = bootBundle();
  const state = PANEL_STATE();
  PANEL_STATE.calls.length = 0;
  const { ctx, effects } = createContext(state);
  module.apply(ctx);

  const registrationEffect = effects.find(item => String(item.label).includes('sidebar'));
  assert.ok(registrationEffect, 'registration effect is labelled');
  registrationEffect.dispose();
  assert.deepEqual(PANEL_STATE.calls, [null], 'closes our own panel when it was active');

  const storeEffect = effects.find(item => String(item.label).includes('store'));
  assert.doesNotThrow(() => storeEffect.dispose());
});

test('a host without the layout service still applies cleanly', () => {
  const module = bootBundle();
  const state = { layout: null, messages: {} };
  const { ctx, effects } = createContext(state);
  assert.doesNotThrow(() => module.apply(ctx));
  const registrationEffect = effects.find(item => String(item.label).includes('sidebar'));
  assert.doesNotThrow(() => registrationEffect.dispose());
  const storeEffect = effects.find(item => String(item.label).includes('store'));
  storeEffect.dispose();
});

