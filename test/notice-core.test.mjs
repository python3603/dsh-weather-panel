import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RAIN_WINDOW_HOURS,
  rainEventKey,
  isDailyReminderDue,
  isWithinQuietHours,
  noticeSignature,
  shouldNotify,
  summarizeRainWindow,
  summarizeToday,
  timeToMinutes
} from '../src/lib/notice-core.js';

/**
 * The rain trigger is a rolling window, so every fixture anchors `current.time`
 * and builds a 24-hour series around it. The reported bug — rain at 02:00, the
 * user opens DSH at 08:00 — is the first test.
 */

/** 24 hourly entries starting at 00:00, `wet` maps hour → {mm, chance}. */
function hourly(wet) {
  const out = [];
  for (let hour = 0; hour < 24; hour += 1) {
    const entry = wet[hour];
    out.push({
      time: `2026-10-31T${String(hour).padStart(2, '0')}:00`,
      precipitation: entry && entry.mm !== undefined ? entry.mm : 0,
      precipitationProbability: entry && entry.chance !== undefined ? entry.chance : 0
    });
  }
  return out;
}

function forecastAt(hour, wet, currentRain) {
  return {
    current: {
      time: `2026-10-31T${String(hour).padStart(2, '0')}:00`,
      precipitation: currentRain === undefined ? 0 : currentRain
    },
    hourly: hourly(wet),
    daily: [{ precipitationSum: 4.2, precipitationProbabilityMax: 80 }]
  };
}

const ALERT = { id: 'a1', level: 'yellow', levelRank: 2, title: '某市发布暴雨黄色预警信号' };
const ALERT_2 = { id: 'a2', level: 'red', levelRank: 4, title: '某市发布暴雨红色预警信号' };

test('rain that ended before the user woke up does not notify', () => {
  // 02:00–03:00 rain, user opens the panel at 08:00.
  const forecast = forecastAt(8, { 2: { mm: 3.2 }, 3: { mm: 1.1 } });
  const summary = summarizeRainWindow(forecast);
  assert.equal(summary.kind, 'none', 'the window starts at 08:00, not at midnight');
  assert.equal(RAIN_WINDOW_HOURS, 12);
  assert.equal(shouldNotify({
    summary, alerts: [], stored: null, handled: '', date: '2026-10-31', hasForecast: true
  }), false);
});

test('rain later in the window is reported with its exact hours', () => {
  const forecast = forecastAt(8, { 14: { mm: 0.5, chance: 60 }, 15: { mm: 2, chance: 80 }, 16: { mm: 0.6, chance: 70 } });
  const summary = summarizeRainWindow(forecast);
  assert.equal(summary.kind, 'soon');
  assert.equal(summary.startLabel, '14:00');
  assert.equal(summary.endLabel, '16:00');
  assert.equal(summary.hours, 3);
  assert.equal(summary.amount, 3.1);
  assert.equal(summary.maxChance, 80);
});

test('rain right now is reported as such', () => {
  const forecast = forecastAt(14, { 14: { mm: 0.4, chance: 90 } }, 0.4);
  const summary = summarizeRainWindow(forecast);
  assert.equal(summary.kind, 'now');
  assert.equal(summary.startLabel, '14:00');
});

test('a single wet hour reads as a short shower', () => {
  const forecast = forecastAt(9, { 11: { mm: 0.3, chance: 55 } });
  const summary = summarizeRainWindow(forecast);
  assert.equal(summary.kind, 'soon');
  assert.equal(summary.hours, 1);
  assert.equal(summary.startLabel, '11:00');
  assert.equal(summary.endLabel, '11:00');
});

test('thresholds are amount 0.1 mm and chance 50 %', () => {
  assert.equal(summarizeRainWindow(forecastAt(9, { 10: { mm: 0.05 } })).kind, 'none');
  assert.equal(summarizeRainWindow(forecastAt(9, { 10: { mm: 0.1 } })).kind, 'soon');
  assert.equal(summarizeRainWindow(forecastAt(9, { 10: { chance: 49 } })).kind, 'none');
  assert.equal(summarizeRainWindow(forecastAt(9, { 10: { chance: 50 } })).kind, 'soon');
});

test('the first run wins; a gap starts a separate run that the notice ignores', () => {
  const forecast = forecastAt(9, { 10: { mm: 0.5 }, 12: { mm: 2 } });
  const summary = summarizeRainWindow(forecast);
  assert.equal(summary.startLabel, '10:00');
  assert.equal(summary.hours, 1);
  assert.equal(rainEventKey(summary), 'rain:2026-10-31T10:00:1:0.5');
});

test('without an hourly series only "raining now" survives', () => {
  const forecast = { current: { time: '2026-10-31T09:00', precipitation: 0 }, hourly: [] };
  assert.equal(summarizeRainWindow(forecast).kind, 'none');
  const wet = { current: { time: '2026-10-31T09:00', precipitation: 0.5 }, hourly: [] };
  assert.equal(summarizeRainWindow(wet).kind, 'now');
});

test('the window honours a custom length', () => {
  const forecast = forecastAt(8, { 15: { mm: 1 } });
  assert.equal(summarizeRainWindow(forecast, { hours: 6 }).kind, 'none', '15:00 is outside 08:00–14:00');
  assert.equal(summarizeRainWindow(forecast, { hours: 12 }).kind, 'soon');
});

test('the signature identifies one rain event, not the day', () => {
  const morning = forecastAt(8, { 14: { mm: 1 } });
  const sameEventLater = forecastAt(9, { 14: { mm: 1 } });
  const newEvent = forecastAt(9, { 16: { mm: 1 } });
  const first = noticeSignature(summarizeRainWindow(morning), []);
  assert.equal(noticeSignature(summarizeRainWindow(sameEventLater), []), first, 'sliding the window does not re-notify');
  assert.notEqual(noticeSignature(summarizeRainWindow(newEvent), []), first, 'a new event may notify again');
  assert.equal(noticeSignature(summarizeRainWindow(forecastAt(8, {})), []), '|', 'no rain leaves only the alert part');
});

test('quiet hours wrap midnight and are off unless enabled', () => {
  const at = (hour, minute) => new Date(2026, 9, 31, hour, minute);
  const quiet = { enabled: true, start: '23:00', end: '07:00' };
  assert.equal(isWithinQuietHours(at(23, 30), quiet), true);
  assert.equal(isWithinQuietHours(at(3, 0), quiet), true);
  assert.equal(isWithinQuietHours(at(7, 0), quiet), false);
  assert.equal(isWithinQuietHours(at(12, 0), quiet), false);
  assert.equal(isWithinQuietHours(at(3, 0), { ...quiet, enabled: false }), false, 'off by default');
  assert.equal(isWithinQuietHours(at(12, 0), { enabled: true, start: '09:00', end: '17:00' }), true);
  assert.equal(timeToMinutes('23:00'), 1380);
  assert.ok(Number.isNaN(timeToMinutes('25:00')));
});

test('the daily digest is due from its time until midnight', () => {
  const at = (hour, minute) => new Date(2026, 9, 31, hour, minute);
  assert.equal(isDailyReminderDue(at(7, 59), { enabled: true, time: '08:00' }), false);
  assert.equal(isDailyReminderDue(at(8, 0), { enabled: true, time: '08:00' }), true);
  assert.equal(isDailyReminderDue(at(8, 0), { enabled: false, time: '08:00' }), false);
  assert.equal(isDailyReminderDue(at(8, 0), { enabled: true, time: 'nope' }), false);
});

test('shouldNotify still keys off alerts and acknowledgements', () => {
  const rain = summarizeRainWindow(forecastAt(8, { 14: { mm: 1 } }));
  assert.equal(shouldNotify({ summary: rain, alerts: [], stored: null, handled: '', date: '2026-10-31', hasForecast: true }), true);
  const signature = noticeSignature(rain, []);
  assert.equal(shouldNotify({ summary: rain, alerts: [], stored: { date: '2026-10-31', signature }, handled: '', date: '2026-10-31', hasForecast: true }), false);
  assert.equal(shouldNotify({ summary: rain, alerts: [], stored: null, handled: signature, date: '2026-10-31', hasForecast: true }), false);

  const alertOnly = { summary: null, alerts: [ALERT], stored: null, handled: '', date: '2026-10-31', hasForecast: false };
  assert.equal(shouldNotify(alertOnly), true, 'alerts do not depend on Open-Meteo');
  const escalated = noticeSignature(null, [ALERT, ALERT_2]);
  assert.equal(shouldNotify({ ...alertOnly, alerts: [ALERT, ALERT_2], stored: { date: '2026-10-31', signature: noticeSignature(null, [ALERT]) } }), true);
  assert.notEqual(escalated, noticeSignature(null, [ALERT]));
});

test('demo mode ignores acknowledgements but still needs something to say', () => {
  const alertOnly = { summary: null, alerts: [ALERT], stored: null, handled: '', date: '2026-10-31', hasForecast: false };
  const signature = noticeSignature(null, [ALERT]);
  assert.equal(shouldNotify({ ...alertOnly, stored: { date: '2026-10-31', signature }, force: true }), true);
  assert.equal(shouldNotify({ ...alertOnly, handled: signature, force: true }), true);
  assert.equal(shouldNotify({ ...alertOnly, alerts: [], force: true }), false, 'nothing to show');
});

test('the legacy daily summary is still available', () => {
  assert.equal(summarizeToday({ daily: [{ precipitationSum: 4.2, precipitationProbabilityMax: 80 }] }).willRain, true);
  assert.equal(summarizeToday(null), null);
});
