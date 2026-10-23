import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import { normalizeForecast } from '../src/lib/weather.js';
import { normalizeTyphoonDetail } from '../src/lib/typhoon.js';

/**
 * Render smoke tests.
 *
 * The bundle test only checks registrations, so a component that throws while
 * rendering (an undefined variable in a rarely opened branch, for example) used
 * to blank the whole panel with nothing catching it. These tests boot the real
 * bundle, take the components it registers, and walk their element trees with a
 * tiny hook-aware React shim. It is not a visual test — it proves the render path
 * cannot throw, which is exactly what users see as "the interface disappeared".
 */

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8');

/* ------------------------------------------------------------------ */
/* Tiny React shim                                                     */
/* ------------------------------------------------------------------ */

function createReactShim(overrides) {
  const Fragment = Symbol('Fragment');
  let stateOrdinal = 0;
  let currentOverrides = [];

  const React = {
    Fragment,
    createElement(type, props, ...children) {
      const merged = { ...(props || {}) };
      if (children.length === 1) merged.children = children[0];
      else if (children.length > 1) merged.children = children;
      return { __el: true, type, props: merged };
    },
    useState(initial) {
      const index = stateOrdinal;
      stateOrdinal += 1;
      const overridden = Object.prototype.hasOwnProperty.call(currentOverrides, index);
      const value = overridden
        ? currentOverrides[index]
        : (typeof initial === 'function' ? initial() : initial);
      return [value, () => {}];
    },
    useRef(initial) {
      return { current: initial };
    },
    useEffect() {},
    useMemo(factory) {
      return factory();
    },
    useCallback(callback) {
      return callback;
    },
    useSyncExternalStore(subscribe, getSnapshot) {
      return getSnapshot();
    }
  };

  return {
    React,
    Fragment,
    beginComponent(name) {
      stateOrdinal = 0;
      currentOverrides = (overrides && overrides[name]) || [];
    }
  };
}

function renderToText(shim, node) {
  const text = [];
  const walk = current => {
    if (current === null || current === undefined || typeof current === 'boolean') return;
    if (Array.isArray(current)) {
      current.forEach(walk);
      return;
    }
    if (typeof current === 'string' || typeof current === 'number') {
      text.push(String(current));
      return;
    }
    if (!current || current.__el !== true) return;
    const { type, props } = current;
    if (type === shim.Fragment) {
      walk(props.children);
      return;
    }
    if (typeof type === 'function') {
      shim.beginComponent(type.name);
      walk(type(props));
      return;
    }
    walk(props.children);
  };
  walk(node);
  return text.join(' ');
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

function bootBundle(overrides) {
  const shim = createReactShim(overrides);
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
    fetch: () => Promise.reject(new Error('offline'))
  };
  vm.runInNewContext(source, context, { filename: 'client.js' });
  const module = registration.factory(name => {
    if (name === 'react') return shim.React;
    throw new Error(`unexpected module request: ${name}`);
  });

  const captured = new Map();
  const ctx = {
    effect(setup) {
      // Run the effect, then tear it straight down: the tests render the captured
      // components with a fake store, so the real store's timers and listeners
      // must not survive (they would keep the test process alive).
      const dispose = setup();
      if (typeof dispose === 'function') dispose();
      return () => {};
    },
    inject(names, callback) {
      if (names.includes('layout')) callback({ layout: null });
    },
    locale: {
      register: () => () => {},
      bind: () => key => key,
      getSnapshot: () => ({ active: 'zh' }),
      subscribe: () => () => {}
    },
    slots: {
      inject(owner, callback) {
        return callback();
      },
      register(options, component) {
        captured.set(options.name || 'unknown', component);
        return () => {};
      }
    }
  };
  module.apply(ctx);

  const component = name => captured.get(name);
  return { shim, component };
}

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const FORECAST = normalizeForecast({
  timezone: 'Asia/Shanghai',
  utc_offset_seconds: 28800,
  current: {
    time: '2026-10-22T20:00',
    temperature_2m: 15.9,
    relative_humidity_2m: 61,
    apparent_temperature: 13.9,
    is_day: 0,
    precipitation: 0.2,
    weather_code: 61,
    cloud_cover: 80,
    pressure_msl: 1026,
    surface_pressure: 1025,
    wind_speed_10m: 11.8,
    wind_direction_10m: 128,
    wind_gusts_10m: 27.4
  },
  hourly: {
    time: ['2026-10-22T20:00', '2026-10-22T21:00', '2026-10-22T22:00'],
    temperature_2m: [15.9, 15.2, 14.9],
    precipitation_probability: [10, 30, 50],
    precipitation: [0.2, 0.4, 1.1],
    weather_code: [61, 63, 63],
    wind_speed_10m: [11.8, 12.5, 13]
  },
  daily: {
    time: ['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'],
    weather_code: [61, 3, 0, 2, 45, 80],
    temperature_2m_max: [16.5, 18.7, 22.5, 23.3, 19.4, 20.1],
    temperature_2m_min: [7.4, 15.1, 14.1, 14.6, 12.9, 13.4],
    sunrise: ['2026-10-22T06:11', '2026-10-23T06:12', '2026-10-24T06:13', '2026-10-25T06:14', '2026-10-26T06:15', '2026-10-27T06:16'],
    sunset: ['2026-10-22T17:14', '2026-10-23T17:13', '2026-10-24T17:11', '2026-10-25T17:10', '2026-10-26T17:08', '2026-10-27T17:07'],
    uv_index_max: [4.65, 4.3, 3.75, 4.55, 2.4, 3.1],
    precipitation_sum: [2.4, 0, 0, 0, 0, 3.2],
    precipitation_probability_max: [80, 6, 0, 4, 20, 60],
    precipitation_hours: [3, 0, 0, 0, 0, 2],
    wind_speed_10m_max: [14.3, 13.5, 13.8, 15.5, 22.4, 16.1],
    wind_gusts_10m_max: [28.4, 36.7, 34.9, 31.7, 41.2, 30.3],
    wind_direction_10m_dominant: [110, 102, 67, 23, 180, 95]
  }
});

const trackPoint = (id, lon, lat, level) => [
  id, '202610221200', 1792670400000, level, lon, lat, 950, 45, 'NW', 18,
  [['30KTS', 500, 450, 350, 480, id]],
  { BABJ: [[24, '202610221200', lon - 1.2, lat + 1.4, 960, 40, 'BABJ', 'TY']] },
  ['202610221200', '2026年10月22日20时00分', null, null]
];

const TYPHOON = normalizeTyphoonDetail({
  typhoon: [
    3359119, 'CHAMPI', '蔷琵', 2630, 2630, null, '一种花', 'start',
    [trackPoint(1, 125.4, 20.8, 'SuperTY'), trackPoint(2, 124.9, 21.2, 'STY')]
  ]
});

const ALERT = {
  id: 'demo:typhoon-red',
  title: '山东省青岛市气象台发布台风红色预警信号',
  issuedAt: Date.now(),
  issuedText: '2026/10/22 20:30',
  url: 'https://www.nmc.cn/publish/alarm.html',
  pic: '',
  type: '台风',
  typeEn: 'Typhoon',
  level: 'red',
  levelZh: '红色',
  levelEn: 'Red',
  levelRank: 4,
  place: '山东省青岛市',
  scope: 'city',
  demo: true
};

const ALERT_RAIN = {
  ...ALERT,
  id: 'sample:rain-orange',
  title: '山东省青岛市气象台发布暴雨橙色预警信号',
  type: '暴雨',
  typeEn: 'Rainstorm',
  level: 'orange',
  levelZh: '橙色',
  levelEn: 'Orange',
  levelRank: 3,
  demo: undefined
};

const ALERT_WIND = {
  ...ALERT,
  id: 'sample:wind-yellow',
  title: '山东省青岛市气象台发布大风黄色预警信号',
  type: '大风',
  typeEn: 'Gale',
  level: 'yellow',
  levelZh: '黄色',
  levelEn: 'Yellow',
  levelRank: 2,
  scope: 'region',
  demo: undefined
};

function createStore(state) {
  return {
    getState: () => state,
    subscribe: () => () => {},
    refresh() {},
    start() {
      return () => {};
    },
    dispose() {},
    setLanguage() {},
    toggleUnits() {},
    setUnits() {},
    setPreciseLocation() {},
    setOverride() {},
    clearOverride() {},
    selectCity() {},
    selectTyphoon() {},
    showDemoAlert() {},
    stopDemoAlert() {}
  };
}

function baseState(patch) {
  return {
    settings: { units: 'metric', preciseLocation: false, override: null },
    phase: 'ready',
    busy: false,
    error: null,
    location: {
      lat: 36.06,
      lon: 120.38,
      label: '青岛市 · 黄岛区',
      source: 'network',
      ip: '120.229.113.176',
      provider: 'ipwho.is',
      countryCode: 'CN',
      city: '青岛市',
      region: '山东省'
    },
    forecast: FORECAST,
    alerts: [],
    alertsScanned: 0,
    alertsCheckedAt: null,
    locationWarning: '',
    typhoonList: [{ id: 3359119, nameZh: '蔷琵', nameEn: 'CHAMPI', number: '2630', status: 'start' }],
    typhoon: TYPHOON,
    typhoonId: 3359119,
    typhoonActive: true,
    updatedAt: Date.now(),
    ...patch
  };
}

const PANEL_PROPS = {
  t: key => key,
  locale: { getSnapshot: () => ({ active: 'zh' }), subscribe: () => () => {} },
  closePanel: () => {}
};

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

test('the weather panel renders data, alerts and the tab bar', () => {
  const { shim, component } = bootBundle({});
  const Panel = component('main');
  assert.equal(typeof Panel, 'function');

  const text = renderToText(shim, shim.React.createElement(Panel, {
    ...PANEL_PROPS,
    store: createStore(baseState({ alerts: [ALERT] }))
  }));

  // `t: key => key` makes the panel fall back to its bundled dictionary, so the
  // rendered text is the Chinese copy — asserting on it proves the dictionary is
  // wired into the tree, not just present in the module.
  for (const label of ['天气面板', '未来 5 天', '未来 24 小时', '降水量', '气象预警', '台风']) {
    assert.ok(text.includes(label), `renders ${label}`);
  }
  assert.ok(text.includes(ALERT.title), 'renders the alert title');
});

test('multiple alerts collapse to one row with an in-app expand toggle', () => {
  const alerts = [ALERT, ALERT_RAIN, ALERT_WIND];
  const { shim, component } = bootBundle({ AlertsBanner: [false] });
  const Panel = component('main');

  const text = renderToText(shim, shim.React.createElement(Panel, {
    ...PANEL_PROPS,
    store: createStore(baseState({ alerts }))
  }));

  assert.ok(text.includes(ALERT.title), 'shows the highest alert');
  assert.ok(!text.includes(ALERT_RAIN.title), 'keeps the lower alerts collapsed');
  assert.ok(text.includes('另有 2 条'), 'says how many alerts are hidden');
  assert.ok(text.includes('展开全部'), 'offers the expand action');
});

test('expanding the alerts panel lists every alert inside the app', () => {
  const alerts = [ALERT, ALERT_RAIN, ALERT_WIND];
  const { shim, component } = bootBundle({ AlertsBanner: [true] });
  const Panel = component('main');

  const text = renderToText(shim, shim.React.createElement(Panel, {
    ...PANEL_PROPS,
    store: createStore(baseState({ alerts }))
  }));

  for (const alert of alerts) assert.ok(text.includes(alert.title), `lists ${alert.id}`);
  assert.ok(text.includes('收起'), 'offers the collapse action');
  assert.ok(!text.includes('另有 2 条'), 'the hidden-count note disappears when expanded');
});

test('the location picker renders when opened (regression: blank panel)', () => {
  // WeatherPanel's useStates are [locale, pickerOpen, tab]; the second is the picker.
  const { shim, component } = bootBundle({ WeatherPanel: ['zh', true] });
  const Panel = component('main');

  const text = renderToText(shim, shim.React.createElement(Panel, {
    ...PANEL_PROPS,
    store: createStore(baseState({}))
  }));

  for (const label of ['位置来源', '网络定位', '系统定位', '预览提醒弹窗']) {
    assert.ok(text.includes(label), `renders ${label} inside the picker`);
  }
});

test('the typhoon tab renders the chart and the current fix', () => {
  const { shim, component } = bootBundle({ WeatherPanel: ['zh', false, 'typhoon'] });
  const Panel = component('main');

  const text = renderToText(shim, shim.React.createElement(Panel, {
    ...PANEL_PROPS,
    store: createStore(baseState({}))
  }));

  for (const label of ['中心气压', '查看官方路径图', '最近定位', '中央气象台台风网']) {
    assert.ok(text.includes(label), `renders ${label}`);
  }
  assert.ok(text.includes('蔷琵'), 'renders the typhoon name');
});

test('selecting a past fix shows the "back to current" action', () => {
  // TyphoonView's first useState is the selected index; 0 means an old fix.
  const { shim, component } = bootBundle({
    WeatherPanel: ['zh', false, 'typhoon'],
    TyphoonView: [0]
  });
  const Panel = component('main');

  const text = renderToText(shim, shim.React.createElement(Panel, {
    ...PANEL_PROPS,
    store: createStore(baseState({}))
  }));

  assert.ok(text.includes('回到当前时刻'), 'shows the return action for a past fix');
});

test('the startup notice renders for an active alert', () => {
  const { shim, component } = bootBundle({});
  const Notice = component('shell.overlay');
  assert.equal(typeof Notice, 'function');

  const text = renderToText(shim, shim.React.createElement(Notice, {
    ...PANEL_PROPS,
    store: createStore(baseState({ alerts: [ALERT] }))
  }));

  // The notice renders through the raw host translator (`t: key => key` here),
  // so the keys are what shows up — plus the alert's own Chinese level label.
  for (const label of ['notice.title', 'notice.alertTitle', 'notice.confirm', '红色']) {
    assert.ok(text.includes(label), `renders ${label}`);
  }
  assert.ok(text.includes(ALERT.title), 'renders the alert line');
});

test('the sidebar icon renders without touching the store', () => {
  const { shim, component } = bootBundle({});
  const Icon = component('sidebar.panellist');
  assert.equal(typeof Icon, 'function');
  assert.doesNotThrow(() => renderToText(shim, shim.React.createElement(Icon, { size: 16, active: true })));
});

test('the radar tab shows the official product image controls', () => {
  const { shim, component } = bootBundle({ WeatherPanel: ['zh', false, 'radar'] });
  const Panel = component('main');

  const text = renderToText(shim, shim.React.createElement(Panel, {
    ...PANEL_PROPS,
    store: createStore(baseState({}))
  }));

  for (const label of ['雷达拼图', '区域', '时次', '最新', '播放', '打开官方雷达页', '全国雷达拼图']) {
    assert.ok(text.includes(label), `renders ${label}`);
  }
});

test('the typhoon tab says so when no typhoon is active', () => {
  const { shim, component } = bootBundle({ WeatherPanel: ['zh', false, 'typhoon'] });
  const Panel = component('main');

  const text = renderToText(shim, shim.React.createElement(Panel, {
    ...PANEL_PROPS,
    store: createStore(baseState({ typhoonActive: false }))
  }));

  assert.ok(text.includes('近期无活跃台风'), 'shows the no-active message');
  assert.ok(text.includes('查看最近一次'), 'still offers the most recent track');
  assert.ok(!text.includes('中心气压'), 'does not render the full track by default');
});

test('alerts carry a type icon and an issue time', () => {
  const { shim, component } = bootBundle({ AlertsBanner: [true] });
  const Panel = component('main');

  const text = renderToText(shim, shim.React.createElement(Panel, {
    ...PANEL_PROPS,
    store: createStore(baseState({ alerts: [ALERT, ALERT_RAIN] }))
  }));

  assert.ok(text.includes('🌀'), 'renders the typhoon type icon');
  assert.ok(text.includes('🌧️'), 'renders the rainstorm type icon');
  assert.ok(text.includes(ALERT.issuedText), 'shows the issue time when expanded');
});

test('the chart labels the probability scale', () => {
  const { shim, component } = bootBundle({});
  const Panel = component('main');

  const text = renderToText(shim, shim.React.createElement(Panel, {
    ...PANEL_PROPS,
    store: createStore(baseState({}))
  }));

  for (const label of ['100%', '50%', '0%']) {
    assert.ok(text.includes(label), `renders the ${label} probability tick`);
  }
});
test('the radar image can be enlarged inside the panel', () => {
  // RadarView state order: product, index, playing, failed, loadedUrl, zoomed.
  const { shim, component } = bootBundle({
    WeatherPanel: ['zh', false, 'radar'],
    RadarView: ['chinaall', 0, false, {}, '', true]
  });
  const Panel = component('main');

  const text = renderToText(shim, shim.React.createElement(Panel, {
    ...PANEL_PROPS,
    store: createStore(baseState({}))
  }));

  assert.ok(text.includes('打开原图'), 'offers the full-resolution image');
  assert.ok(text.includes('关闭'), 'offers a close action');
  assert.ok(text.includes('全国雷达拼图'), 'labels the enlarged product');
});
test('the weather tab carries the temperature history card', () => {
  const { shim, component } = bootBundle({});
  const Panel = component('main');

  const text = renderToText(shim, shim.React.createElement(Panel, {
    ...PANEL_PROPS,
    store: createStore(baseState({}))
  }));

  for (const label of ['历史气温', '近 7 天', '近 30 天']) {
    assert.ok(text.includes(label), `renders ${label}`);
  }
});

test('the satellite tab exposes all three imagery sources', () => {
  const { shim, component } = bootBundle({ WeatherPanel: ['zh', false, 'satellite'] });
  const Panel = component('main');

  const text = renderToText(shim, shim.React.createElement(Panel, {
    ...PANEL_PROPS,
    store: createStore(baseState({}))
  }));

  for (const label of ['卫星云图', '国家卫星气象中心', '产品', '时次', '打开官方页面', 'FY-4B · 中国区域 · 伪彩色']) {
    assert.ok(text.includes(label), `renders ${label}`);
  }
});
test('the pro tab shows the SST and ECMWF panels', () => {
  const { shim, component } = bootBundle({ WeatherPanel: ['zh', false, 'pro'] });
  const Panel = component('main');

  const text = renderToText(shim, shim.React.createElement(Panel, {
    ...PANEL_PROPS,
    store: createStore(baseState({}))
  }));

  for (const label of ['西北太平洋海表温度', 'ECMWF 中国区域天气图', '海域', '产品', '起报时次', '预报时效', 'easterlywave.com']) {
    assert.ok(text.includes(label), `renders ${label}`);
  }
});
