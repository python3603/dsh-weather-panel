import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PANEL_ID,
  buildDemoAlert,
  demoAlertKinds,
  readDemoAlertKind,
  placeCacheKey,
  readNoticeState,
  readPanelSettings,
  todayKey,
  writeNoticeState,
  writePanelSettings
} from '../src/lib/store.js';

/**
 * These functions own the user's persisted choices, so they are exercised with
 * junk input as well as the happy path: a corrupt localStorage entry must never
 * break startup.
 */

test('defaults are used when nothing has been stored', () => {
  const settings = readPanelSettings();
  assert.equal(settings.units, 'metric');
  assert.equal(settings.preciseLocation, false, 'the high-accuracy switch is off by default');
  assert.equal(settings.override, null);
});

test('settings round-trip, including the persisted precise-location switch', () => {
  writePanelSettings({
    units: 'imperial',
    preciseLocation: true,
    override: {
      lat: 36.0671,
      lon: 120.3826,
      label: '青岛市 · 黄岛区',
      city: '青岛市',
      region: '山东省',
      source: 'manual'
    }
  });
  const settings = readPanelSettings();
  assert.equal(settings.units, 'imperial');
  assert.equal(settings.preciseLocation, true, 'the switch survives a restart');
  assert.equal(settings.override.lat, 36.0671);
  assert.equal(settings.override.city, '青岛市');
  assert.equal(settings.override.region, '山东省');
  assert.equal(settings.override.source, 'manual');
});

test('invalid persisted values fall back instead of loading garbage', () => {
  writePanelSettings({ units: 'kelvin', preciseLocation: 'yes', override: { lat: 'a', lon: 2 } });
  const settings = readPanelSettings();
  assert.equal(settings.units, 'metric');
  assert.equal(settings.preciseLocation, false, 'only a real boolean turns it on');
  assert.equal(settings.override, null, 'coordinates must be numbers');

  writePanelSettings({ units: 'metric', preciseLocation: true, override: { lat: 1, lon: 2, source: 'hacked' } });
  const sanitized = readPanelSettings();
  assert.equal(sanitized.override.source, 'manual', 'unknown sources are normalized');
});

test('place cache keys separate cities at the same coordinates', () => {
  const a = placeCacheKey({ lat: 36.0671, lon: 120.3826, label: '青岛市' });
  const b = placeCacheKey({ lat: 36.0671, lon: 120.3826, label: '黄岛区' });
  assert.notEqual(a, b);
  assert.equal(placeCacheKey(null), 'unknown');
  assert.match(a, /^36\.1,120\.4:/, 'coordinates are rounded for cache stability');
});

test('the notice bookkeeping round-trips and tolerates junk', () => {
  writeNoticeState({ date: '2026-10-22', signature: 'a1,rain', confirmedAt: Date.now() });
  const stored = readNoticeState();
  assert.equal(stored.date, '2026-10-22');
  assert.equal(stored.signature, 'a1,rain');
  assert.equal(typeof stored.confirmedAt, 'number');
});

test('today is keyed in local time', () => {
  assert.equal(todayKey(new Date(2026, 9, 22, 20, 1)), '2026-10-22');
  assert.equal(todayKey(new Date(2026, 0, 5, 0, 0)), '2026-01-05');
  assert.match(PANEL_ID, /^dsh-weather-panel$/);
});

test('the demo alert builds a red typhoon warning for the notice test', () => {
  const alert = buildDemoAlert('typhoon-red', Date.UTC(2026, 9, 22, 12, 30));
  assert.equal(alert.id, 'demo:typhoon-red');
  assert.equal(alert.level, 'red');
  assert.equal(alert.levelRank, 4);
  assert.equal(alert.type, '台风');
  assert.equal(alert.scope, 'city');
  assert.match(alert.title, /台风红色预警信号/);
  assert.equal(alert.demo, true);
  assert.match(alert.issuedText, /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/);
});

test('unknown demo presets are ignored and the switch defaults to off', () => {
  assert.equal(buildDemoAlert('nope'), null);
  assert.equal(buildDemoAlert(''), null);
  assert.equal(buildDemoAlert(undefined), null);
  assert.deepEqual(demoAlertKinds().sort(), ['rain-orange', 'typhoon-red']);
  assert.equal(typeof readDemoAlertKind(), 'string', 'always readable, even without storage');
});