import test from 'node:test';
import assert from 'node:assert/strict';

import { noticeSignature, shouldNotify, summarizeToday } from '../src/lib/notice-core.js';

const FORECAST_RAIN = {
  current: { precipitation: 0 },
  daily: [{ precipitationSum: 4.2, precipitationProbabilityMax: 80 }]
};

const FORECAST_DRY = {
  current: { precipitation: 0 },
  daily: [{ precipitationSum: 0, precipitationProbabilityMax: 5 }]
};

const ALERT = { id: 'a1', level: 'yellow', levelRank: 2, title: '某市发布暴雨黄色预警信号' };
const ALERT_2 = { id: 'a2', level: 'red', levelRank: 4, title: '某市发布暴雨红色预警信号' };

test('today is summarized from daily and current rain', () => {
  assert.deepEqual(summarizeToday(FORECAST_RAIN), { amount: 4.2, chance: 80, willRain: true });
  assert.equal(summarizeToday(FORECAST_DRY).willRain, false);
  assert.equal(summarizeToday(null), null);
  assert.equal(summarizeToday({}).willRain, false, 'missing fields are treated as dry');
});

test('a wet forecast or a chance spike is enough to warn', () => {
  assert.equal(summarizeToday({ daily: [{ precipitationSum: 0.3, precipitationProbabilityMax: 0 }] }).willRain, true);
  assert.equal(summarizeToday({ daily: [{ precipitationSum: 0, precipitationProbabilityMax: 60 }] }).willRain, true);
  assert.equal(summarizeToday({ current: { precipitation: 0.4 } }).willRain, true, 'it can be raining right now');
  assert.equal(summarizeToday({ daily: [{ precipitationSum: 0.1, precipitationProbabilityMax: 20 }] }).willRain, false);
});

test('the signature changes with alerts and rain only', () => {
  const sunny = noticeSignature(summarizeToday(FORECAST_DRY), []);
  const rainy = noticeSignature(summarizeToday(FORECAST_RAIN), []);
  const alerting = noticeSignature(summarizeToday(FORECAST_DRY), [ALERT]);
  const both = noticeSignature(summarizeToday(FORECAST_RAIN), [ALERT]);
  assert.notEqual(sunny, rainy);
  assert.notEqual(sunny, alerting);
  assert.notEqual(alerting, both);
  assert.equal(alerting, noticeSignature(summarizeToday(FORECAST_DRY), [{ ...ALERT }]), 'stable across renders');
  assert.notEqual(alerting, noticeSignature(summarizeToday(FORECAST_DRY), [ALERT, ALERT_2]), 'a new alert changes it');
});

test('the notice stays hidden when there is nothing to say', () => {
  const base = { summary: summarizeToday(FORECAST_DRY), alerts: [], stored: null, handled: '', date: '2026-10-22', hasForecast: true };
  assert.equal(shouldNotify(base), false, 'dry and quiet');
  assert.equal(shouldNotify({ ...base, hasForecast: false }), false, 'nothing loaded yet');
});

test('the notice appears for rain or alerts, and respects acknowledgements', () => {
  const rain = { summary: summarizeToday(FORECAST_RAIN), alerts: [], stored: null, handled: '', date: '2026-10-22', hasForecast: true };
  assert.equal(shouldNotify(rain), true);

  const alerting = { summary: summarizeToday(FORECAST_DRY), alerts: [ALERT], stored: null, handled: '', date: '2026-10-22', hasForecast: true };
  assert.equal(shouldNotify(alerting), true);

  const signature = noticeSignature(alerting.summary, alerting.alerts);
  assert.equal(shouldNotify({ ...alerting, stored: { date: '2026-10-22', signature } }), false, 'already acknowledged today');
  assert.equal(shouldNotify({ ...alerting, stored: { date: '2026-10-21', signature } }), true, 'yesterday does not count');
  assert.equal(shouldNotify({ ...alerting, handled: signature }), false, 'dismissed in this session');

  const escalated = noticeSignature(alerting.summary, [ALERT, ALERT_2]);
  assert.equal(
    shouldNotify({ ...alerting, alerts: [ALERT, ALERT_2], stored: { date: '2026-10-22', signature } }),
    true,
    'a new alert re-opens the notice even after today was acknowledged'
  );
  assert.notEqual(escalated, signature);
});
