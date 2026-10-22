import test from 'node:test';
import assert from 'node:assert/strict';

import { WEATHER_DICT, interpolate, lookupMessage, makeTranslate } from '../src/lib/i18n.js';

const placeholders = text => (String(text).match(/\{(\w+)\}/g) || []).sort();

test('every Chinese key has an English counterpart with the same placeholders', () => {
  const zhKeys = Object.keys(WEATHER_DICT.zh).sort();
  const enKeys = Object.keys(WEATHER_DICT.en).sort();
  assert.deepEqual(enKeys, zhKeys, 'both dictionaries must cover the same keys');
  for (const key of zhKeys) {
    assert.ok(WEATHER_DICT.zh[key].length > 0, `${key} zh is not empty`);
    assert.ok(WEATHER_DICT.en[key].length > 0, `${key} en is not empty`);
    assert.deepEqual(placeholders(WEATHER_DICT.en[key]), placeholders(WEATHER_DICT.zh[key]), `${key} placeholders match`);
  }
});

test('keys the panel actually renders are all present', () => {
  const required = [
    'nav.label', 'panel.title', 'panel.subtitleNetwork', 'panel.subtitleManual', 'panel.subtitleGps',
    'panel.updated', 'action.refresh', 'action.retry', 'action.useImperial', 'action.useMetric',
    'action.changeLocation', 'action.close', 'action.cancel', 'state.locating', 'state.loading',
    'state.updating', 'state.stale', 'error.locate', 'error.weather', 'error.timeout', 'error.http',
    'error.gps', 'now.feelsLike', 'param.humidity', 'param.pressure', 'param.wind', 'param.gust',
    'param.precipitation', 'param.precipProbability', 'param.cloudCover', 'param.uv',
    'param.sunrise', 'param.sunset', 'day.today', 'day.tomorrow', 'day.afterTomorrow', 'day.inDays',
    'day.high', 'day.low', 'forecast.title', 'hourly.title', 'hourly.now', 'location.title',
    'location.description', 'location.auto', 'location.gps', 'location.searchTitle',
    'location.placeholder', 'location.searching', 'location.noResult', 'location.precise',
    'location.preciseHint', 'location.gpsFallback', 'panel.subtitleGpsAccurate',
    'footer.weather',
    'footer.location', 'footer.alerts', 'footer.license', 'footer.note',
    'proxy.hint', 'proxy.action', 'chart.title', 'chart.amount', 'chart.chance', 'chart.empty',
    'tab.weather', 'tab.typhoon', 'alerts.title', 'alerts.none', 'alerts.count', 'alerts.scopeCity',
    'alerts.scopeRegion', 'alerts.more', 'alerts.source', 'alerts.openAll',
    'alert.level.blue', 'alert.level.yellow', 'alert.level.orange', 'alert.level.red',
    'notice.title', 'notice.rainTitle', 'notice.rainBody', 'notice.alertTitle', 'notice.alertBody',
    'notice.confirm', 'notice.dismiss', 'notice.more', 'notice.source',
    'typhoon.title', 'typhoon.active', 'typhoon.ended', 'typhoon.none', 'typhoon.latest',
    'typhoon.pressure', 'typhoon.wind', 'typhoon.move', 'typhoon.forecast', 'typhoon.peak',
    'typhoon.meaning', 'typhoon.source', 'typhoon.select', 'typhoon.hint', 'typhoon.windRadius',
    'typhoon.updated', 'typhoon.noForecast', 'typhoon.official', 'typhoon.land', 'typhoon.backToCurrent'
  ];
  for (const key of required) {
    assert.ok(key in WEATHER_DICT.zh, `zh:${key}`);
    assert.ok(key in WEATHER_DICT.en, `en:${key}`);
  }
});

test('interpolate replaces known placeholders and keeps unknown ones', () => {
  assert.equal(interpolate('更新于 {time}', { time: '20:01' }), '更新于 20:01');
  assert.equal(interpolate('{n} 天后', { n: 3 }), '3 天后');
  assert.equal(interpolate('{missing}', {}), '{missing}');
  assert.equal(interpolate('plain'), 'plain');
  assert.equal(interpolate(null), '');
});

test('lookupMessage falls back across languages but never throws', () => {
  assert.equal(lookupMessage('zh', 'nav.label'), '天气');
  assert.equal(lookupMessage('en', 'nav.label'), 'Weather');
  assert.equal(lookupMessage('fr', 'nav.label'), '天气', 'unknown language falls back to zh');
  assert.equal(lookupMessage('zh', 'nope.nope'), 'nope.nope');
});

test('makeTranslate prefers the host translator and falls back to the bundle', () => {
  const hostTranslator = key => (key === 'nav.label' ? 'Weather!' : key);
  const translate = makeTranslate(hostTranslator, 'zh');
  assert.equal(translate('nav.label'), 'Weather!', 'host wins when it knows the key');
  assert.equal(translate('panel.title'), '天气面板', 'unknown host key falls back to the bundle');
  assert.equal(translate('day.inDays', { n: 2 }), '2 天后');

  const throwing = () => {
    throw new Error('host translator exploded');
  };
  assert.equal(makeTranslate(throwing, 'en')('panel.title'), 'Weather panel');
  assert.equal(makeTranslate(undefined, 'en')('nav.label'), 'Weather');
});
