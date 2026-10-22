import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildForecastUrl,
  dayAhead,
  normalizeForecast,
  selectUpcomingHours,
  upcomingDays
} from '../src/lib/weather.js';

const PAYLOAD = {
  latitude: 36.1,
  longitude: 120.35,
  utc_offset_seconds: 28800,
  timezone: 'Asia/Shanghai',
  elevation: 6,
  current: {
    time: '2026-10-22T20:00',
    temperature_2m: 15.7,
    relative_humidity_2m: 60,
    apparent_temperature: 13.4,
    is_day: 0,
    precipitation: 0,
    weather_code: 3,
    cloud_cover: 80,
    pressure_msl: 1026.1,
    surface_pressure: 1025.4,
    wind_speed_10m: 12.2,
    wind_direction_10m: 128,
    wind_gusts_10m: 27.4
  },
  daily: {
    time: ['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'],
    weather_code: [45, 3, 45, 0, 61, 2],
    temperature_2m_max: [16.5, 18.7, 22.5, 23.3, 19.4, 20.1],
    temperature_2m_min: [7.4, 15.1, 14.1, 14.6, 12.9, 13.4],
    sunrise: [
      '2026-10-22T06:11', '2026-10-23T06:12', '2026-10-24T06:13',
      '2026-10-25T06:14', '2026-10-26T06:15', '2026-10-27T06:16'
    ],
    sunset: [
      '2026-10-22T17:14', '2026-10-23T17:13', '2026-10-24T17:11',
      '2026-10-25T17:10', '2026-10-26T17:08', '2026-10-27T17:07'
    ],
    uv_index_max: [4.65, 4.3, 3.75, 4.55, 2.4, 3.1],
    precipitation_sum: [0, null, 1.2, 0, 6.8, 0.2],
    precipitation_probability_max: [0, 6, 40, 4, 85, 20],
    precipitation_hours: [0, 0, 2.5, 0, 5, 1],
    wind_speed_10m_max: [14.3, 13.5, 13.8, 15.5, 22.4, 16.1],
    wind_gusts_10m_max: [28.4, 36.7, 34.9, 31.7, 41.2, 30.3],
    wind_direction_10m_dominant: [110, 102, 67, 23, 180, 95]
  },
  hourly: {
    time: ['2026-10-22T19:00', '2026-10-22T20:00', '2026-10-22T21:00', '2026-10-22T22:00'],
    temperature_2m: [16.1, 15.7, 15.2, 14.9],
    precipitation_probability: [0, 0, 10, 20],
    precipitation: [0, 0, 0.1, 0.2],
    weather_code: [3, 3, 61, 61],
    wind_speed_10m: [11, 12.2, 12.5, 13]
  }
};

test('the forecast URL requests everything the panel renders in one call', () => {
  const url = new URL(buildForecastUrl(36.06, 120.38));
  assert.equal(url.origin + url.pathname, 'https://api.open-meteo.com/v1/forecast');
  assert.equal(url.searchParams.get('latitude'), '36.06');
  assert.equal(url.searchParams.get('longitude'), '120.38');
  assert.equal(url.searchParams.get('timezone'), 'auto');
  assert.equal(url.searchParams.get('forecast_days'), '6', 'today + 5 forecast days');
  assert.equal(url.searchParams.get('temperature_unit'), 'celsius');
  assert.equal(url.searchParams.get('wind_speed_unit'), 'kmh');
  assert.equal(url.searchParams.get('precipitation_unit'), 'mm');
  const current = url.searchParams.get('current').split(',');
  for (const field of ['temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 'weather_code', 'pressure_msl', 'wind_gusts_10m']) {
    assert.ok(current.includes(field), `current asks for ${field}`);
  }
  const daily = url.searchParams.get('daily').split(',');
  for (const field of ['sunrise', 'sunset', 'uv_index_max', 'precipitation_probability_max']) {
    assert.ok(daily.includes(field), `daily asks for ${field}`);
  }
});

test('normalizeForecast produces rows the view can walk once', () => {
  const forecast = normalizeForecast(PAYLOAD);
  assert.equal(forecast.timezone, 'Asia/Shanghai');
  assert.equal(forecast.current.temperature, 15.7);
  assert.equal(forecast.current.isDay, false, 'is_day 0 is night');
  assert.equal(forecast.current.weatherCode, 3);
  assert.equal(forecast.daily.length, 6);
  assert.equal(forecast.daily[1].tempMax, 18.7);
  assert.equal(forecast.daily[1].precipitationSum, null, 'missing numbers normalize to null');
  assert.equal(forecast.daily[0].sunrise, '2026-10-22T06:11');
  assert.equal(forecast.hourly.length, 4);
  assert.equal(forecast.hourly[2].precipitationProbability, 10);
});

test('unusable payloads return null instead of a half-built object', () => {
  assert.equal(normalizeForecast(null), null);
  assert.equal(normalizeForecast(undefined), null);
  assert.equal(normalizeForecast({}), null);
  assert.equal(normalizeForecast({ current: null }), null);
  assert.equal(normalizeForecast({ current: {} }).daily.length, 0);
});

test('upcoming hours start at the current hour', () => {
  const forecast = normalizeForecast(PAYLOAD);
  const hours = selectUpcomingHours(forecast.hourly, forecast.current.time, 24);
  assert.equal(hours.length, 3, 'hours before the current one are dropped');
  assert.equal(hours[0].time, '2026-10-22T20:00');
  assert.deepEqual(
    selectUpcomingHours(forecast.hourly, '2026-10-22T19:05', 2).map(hour => hour.time),
    ['2026-10-22T19:00', '2026-10-22T20:00']
  );
  assert.deepEqual(selectUpcomingHours([], '2026-10-22T19:05', 2), []);
});

test('the 3-day strip is today plus the next three days', () => {
  const forecast = normalizeForecast(PAYLOAD);
  assert.equal(forecast.daily[0].date, '2026-10-22');
  assert.deepEqual(upcomingDays(forecast.daily, 5).map(day => day.date), ['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27']);
  assert.equal(upcomingDays(forecast.daily, 5).length, 5, 'the panel shows today plus five days');
  assert.equal(dayAhead(forecast.daily, 0).date, '2026-10-22');
  assert.equal(dayAhead(forecast.daily, 9), null);
});
