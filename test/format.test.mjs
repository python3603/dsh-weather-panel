import test from 'node:test';
import assert from 'node:assert/strict';

import {
  convertTemperature,
  formatAgeMinutes,
  formatClock,
  formatClockFromDate,
  formatCoordinates,
  formatDayOffset,
  formatMonthDay,
  formatPercent,
  formatPrecipitation,
  formatPressure,
  formatTemperature,
  formatUv,
  formatWeekday,
  formatWindSpeed,
  isNumber,
  precipitationUnit,
  uvBand,
  windDirectionLabel
} from '../src/lib/format.js';

test('temperature conversion keeps metric values and converts for imperial', () => {
  assert.equal(convertTemperature(21.4, 'metric'), 21.4);
  assert.equal(convertTemperature(0, 'imperial'), 32);
  assert.equal(convertTemperature(100, 'imperial'), 212);
  assert.equal(convertTemperature(null, 'metric'), null);
  assert.equal(formatTemperature(21.4, 'metric'), '21°');
  assert.equal(formatTemperature(-3.6, 'metric'), '-4°');
  assert.equal(formatTemperature(undefined, 'metric'), '—');
});

test('wind, precipitation and pressure follow the unit system', () => {
  assert.equal(formatWindSpeed(12.2, 'metric'), '12 km/h');
  assert.equal(formatWindSpeed(12.2, 'imperial'), '8 mph');
  assert.equal(formatPrecipitation(1.234, 'metric'), '1.2 mm');
  assert.equal(formatPrecipitation(1.234, 'imperial'), '0.05 in');
  assert.equal(formatPrecipitation(0, 'metric'), '0 mm');
  assert.equal(precipitationUnit('imperial'), 'in');
  assert.equal(formatPressure(1026.1, 'metric'), '1026 hPa');
  assert.equal(formatPressure(1026.1, 'imperial'), '30.3 inHg');
});

test('percent, uv and numeric guards', () => {
  assert.equal(formatPercent(62.4), '62%');
  assert.equal(formatPercent(null), '—');
  assert.equal(formatUv(4.65), '4.7');
  assert.equal(uvBand(0, 'zh'), '低');
  assert.equal(uvBand(4, 'zh'), '中等');
  assert.equal(uvBand(6.5, 'zh'), '高');
  assert.equal(uvBand(9, 'en'), 'Very high');
  assert.equal(uvBand(12, 'en'), 'Extreme');
  assert.equal(isNumber('1'), false);
  assert.equal(isNumber(NaN), false);
  assert.equal(isNumber(0), true);
});

test('compass labels map degrees onto 16 points', () => {
  assert.equal(windDirectionLabel(0, 'zh'), '北');
  assert.equal(windDirectionLabel(90, 'zh'), '东');
  assert.equal(windDirectionLabel(180, 'zh'), '南');
  assert.equal(windDirectionLabel(270, 'zh'), '西');
  assert.equal(windDirectionLabel(45, 'zh'), '东北');
  assert.equal(windDirectionLabel(202.5, 'zh'), '南西南');
  assert.equal(windDirectionLabel(128, 'en'), 'SE');
  assert.equal(windDirectionLabel(359, 'en'), 'N', 'wraps back to north');
  assert.equal(windDirectionLabel(-10, 'en'), 'N', 'negative degrees are normalized');
  assert.equal(windDirectionLabel(undefined, 'en'), '');
});

test('timestamps are read as local clock values without time-zone math', () => {
  assert.equal(formatClock('2026-10-22T06:12'), '06:12');
  assert.equal(formatClock('2026-10-22T20:00'), '20:00');
  assert.equal(formatClock('2026-10-22'), '—');
  assert.equal(formatClock(''), '—');
  assert.equal(formatClockFromDate(new Date(2026, 9, 22, 7, 5)), '07:05');
});

test('weekday and month-day labels are stable across time zones', () => {
  assert.equal(formatWeekday('2026-10-22', 'en'), 'Thu');
  assert.equal(formatWeekday('2026-10-25', 'en'), 'Sun');
  assert.match(formatWeekday('2026-10-22', 'zh'), /四/);
  assert.equal(formatMonthDay('2026-10-22', 'zh'), '10月22日');
  assert.equal(formatMonthDay('2026-10-22', 'en'), 'Oct 22');
  assert.equal(formatMonthDay('2026-01-05', 'en'), 'Jan 5');
});

test('day offsets use the translator, including the generic branch', () => {
  const translations = {
    'day.today': '今天',
    'day.tomorrow': '明天',
    'day.afterTomorrow': '后天',
    'day.inDays': '{n} 天后'
  };
  const t = (key, vars) => String(translations[key] || key).replace('{n}', vars && vars.n !== undefined ? vars.n : '');
  assert.equal(formatDayOffset(0, 'zh', t), '今天');
  assert.equal(formatDayOffset(1, 'zh', t), '明天');
  assert.equal(formatDayOffset(2, 'zh', t), '后天');
  assert.equal(formatDayOffset(3, 'zh', t), '3 天后');
});

test('coordinates and age helpers', () => {
  assert.equal(formatCoordinates(36.06, 120.38), '36.06°N 120.38°E');
  assert.equal(formatCoordinates(-33.87, -151.21), '33.87°S 151.21°W');
  assert.equal(formatCoordinates('x', 1), '');
  assert.equal(formatAgeMinutes(0, 0), 0);
  assert.equal(formatAgeMinutes(1000, 1000 + 5 * 60 * 1000), 5);
  assert.equal(formatAgeMinutes(null, 0), null);
});
