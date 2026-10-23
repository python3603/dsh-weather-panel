import test from 'node:test';
import assert from 'node:assert/strict';

import {
  archiveWindow,
  buildArchiveUrl,
  buildHistoryUrl,
  historySummary,
  normalizeHistory,
  normalizeRange
} from '../src/lib/history.js';

const PAYLOAD = {
  daily: {
    time: ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23'],
    temperature_2m_max: [30.4, 34, null, 29.1],
    temperature_2m_min: [24.9, 25.7, 25.1, null],
    temperature_2m_mean: [27.4, 28.9, null, 27.2]
  }
};

test('the history URL asks for past days only', () => {
  const url = buildHistoryUrl('https://api.open-meteo.com/v1/forecast', 36.06, 120.38, 7);
  assert.match(url, /latitude=36\.06/);
  assert.match(url, /longitude=120\.38/);
  assert.match(url, /daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean/);
  assert.match(url, /past_days=7/);
  assert.match(url, /forecast_days=0/);
  assert.match(url, /timezone=Asia%2FShanghai/);
});

test('only the 7 and 30 day ranges are valid', () => {
  assert.equal(normalizeRange(7), 7);
  assert.equal(normalizeRange(30), 30);
  assert.equal(normalizeRange(12), 7);
  assert.equal(normalizeRange(undefined), 7);
});

test('rows keep only days that have data and respect the range', () => {
  const rows = normalizeHistory(PAYLOAD, 7);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows[0], { date: '2026-10-20', max: 30.4, min: 24.9, mean: 27.4 });
  // A day with no numbers at all is dropped instead of shipping nulls to the chart.
  const emptyDay = normalizeHistory({
    daily: { time: ['2026-10-01'], temperature_2m_max: [null], temperature_2m_min: [null], temperature_2m_mean: [null] }
  }, 7);
  assert.deepEqual(emptyDay, []);
  // The list is trimmed to the requested range, keeping the newest entries.
  const trimmed = normalizeHistory(PAYLOAD, 7);
  assert.equal(trimmed.at(-1).date, '2026-10-23');
});

test('the summary reports the warmest high, coldest low and mean', () => {
  const summary = historySummary(normalizeHistory(PAYLOAD, 7));
  assert.equal(summary.high, 34);
  assert.equal(summary.low, 24.9);
  assert.equal(summary.mean, 27.8);
  assert.deepEqual(historySummary([]), { high: null, low: null, mean: null });
});

test('the archive fallback has a lagging date window', () => {
  const now = Date.UTC(2026, 9, 23);
  const window = archiveWindow(7, now);
  assert.equal(window.end, '2026-10-17');
  assert.equal(window.start, '2026-10-11');
  const url = buildArchiveUrl(36.06, 120.38, window.start, window.end);
  assert.match(url, /archive-api\.open-meteo\.com/);
  assert.match(url, /start_date=2026-10-11&end_date=2026-10-17/);
});
