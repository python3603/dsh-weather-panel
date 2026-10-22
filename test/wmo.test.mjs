import test from 'node:test';
import assert from 'node:assert/strict';

import { WMO_TABLE, describeWeather, weatherIconFor, weatherLabel } from '../src/lib/wmo.js';

test('every WMO entry carries both languages, an icon group and a severity', () => {
  for (const [code, entry] of Object.entries(WMO_TABLE)) {
    assert.ok(Number.isFinite(Number(code)), `code ${code} is numeric`);
    assert.equal(typeof entry.icon, 'string', `code ${code} icon`);
    assert.ok(entry.zh && entry.en, `code ${code} has zh and en labels`);
    assert.ok(entry.severity >= 0 && entry.severity <= 3, `code ${code} severity in range`);
    assert.ok(entry.zh !== entry.en, `code ${code} labels are translated`);
  }
});

test('describeWeather returns the documented entry', () => {
  const clear = describeWeather(0);
  assert.equal(clear.icon, 'clear');
  assert.equal(clear.zh, '晴');
  assert.equal(clear.en, 'Clear sky');
  assert.equal(clear.severity, 0);

  const thunder = describeWeather(96);
  assert.equal(thunder.icon, 'thunder');
  assert.equal(thunder.severity, 3);
  assert.equal(thunder.code, 96);
});

test('describeWeather degrades instead of throwing on odd input', () => {
  for (const input of [undefined, null, 'abc', {}, 1.5, -3, 12345]) {
    const described = describeWeather(input);
    assert.ok(['unknown', 'clear', 'mostly-clear', 'partly-cloudy', 'overcast', 'fog', 'drizzle', 'rain', 'showers', 'snow', 'thunder', 'sleet'].includes(described.icon));
    assert.equal(typeof described.zh, 'string');
  }
  assert.equal(describeWeather(undefined).icon, 'unknown');
  assert.equal(describeWeather(12345).icon, 'unknown');
  assert.equal(describeWeather(1.9).code, 1, 'fractional codes are truncated');
});

test('clear sky switches to the moon glyph at night', () => {
  assert.equal(weatherIconFor(0, true), 'clear');
  assert.equal(weatherIconFor(0, false), 'moon');
  assert.equal(weatherIconFor(2, false), 'partly-cloudy', 'clouds stay clouds at night');
});

test('weatherLabel follows the requested language', () => {
  assert.equal(weatherLabel(61, 'zh'), '小雨');
  assert.equal(weatherLabel(61, 'en'), 'Slight rain');
  assert.equal(weatherLabel(999, 'en'), 'Unknown');
});
