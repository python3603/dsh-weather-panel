/**
 * Open-Meteo forecast: one request, normalized once.
 *
 * The API returns column-oriented arrays with sparse nulls, which is awkward to
 * render and impossible to cache meaningfully as-is. `normalizeForecast` turns
 * one response into a compact row-oriented snapshot that the view walks once
 * and the cache can store verbatim.
 *
 * Time handling: every timestamp Open-Meteo returns is *local* to the requested
 * coordinates (`timezone=auto`, iso8601, no offset suffix), so all comparisons
 * here are plain string comparisons — no time-zone math, no DST surprises.
 */

export const FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
export const FORECAST_DAYS = 4;
export const UPCOMING_HOURS = 24;

export const CURRENT_VARIABLES = [
  'temperature_2m',
  'relative_humidity_2m',
  'apparent_temperature',
  'is_day',
  'precipitation',
  'weather_code',
  'cloud_cover',
  'pressure_msl',
  'surface_pressure',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m'
];

export const HOURLY_VARIABLES = [
  'temperature_2m',
  'precipitation_probability',
  'precipitation',
  'weather_code',
  'wind_speed_10m'
];

export const DAILY_VARIABLES = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'apparent_temperature_max',
  'apparent_temperature_min',
  'sunrise',
  'sunset',
  'uv_index_max',
  'precipitation_sum',
  'precipitation_probability_max',
  'precipitation_hours',
  'wind_speed_10m_max',
  'wind_gusts_10m_max',
  'wind_direction_10m_dominant'
];

function numericOrNull(value) {
  const numeric = typeof value === 'string' ? Number(value) : value;
  return typeof numeric === 'number' && Number.isFinite(numeric) ? numeric : null;
}

function stringOrEmpty(value) {
  return typeof value === 'string' ? value : '';
}

function valueAt(column, index) {
  if (!Array.isArray(column)) return null;
  return numericOrNull(column[index]);
}

function textAt(column, index) {
  if (!Array.isArray(column)) return '';
  return stringOrEmpty(column[index]);
}

/** Build the single request that feeds the whole panel. */
export function buildForecastUrl(lat, lon, options) {
  const settings = options || {};
  const params = new URLSearchParams();
  params.set('latitude', String(lat));
  params.set('longitude', String(lon));
  params.set('current', CURRENT_VARIABLES.join(','));
  params.set('hourly', HOURLY_VARIABLES.join(','));
  params.set('daily', DAILY_VARIABLES.join(','));
  params.set('timezone', 'auto');
  params.set('forecast_days', String(settings.forecastDays || FORECAST_DAYS));
  // Units stay metric on the wire; the view converts for °F/mph when asked.
  params.set('temperature_unit', 'celsius');
  params.set('wind_speed_unit', 'kmh');
  params.set('precipitation_unit', 'mm');
  return `${FORECAST_ENDPOINT}?${params.toString()}`;
}

export function normalizeDaily(raw) {
  if (!raw || !Array.isArray(raw.time)) return [];
  return raw.time.map((date, index) => ({
    date: stringOrEmpty(date),
    weatherCode: valueAt(raw.weather_code, index),
    tempMax: valueAt(raw.temperature_2m_max, index),
    tempMin: valueAt(raw.temperature_2m_min, index),
    apparentMax: valueAt(raw.apparent_temperature_max, index),
    apparentMin: valueAt(raw.apparent_temperature_min, index),
    sunrise: textAt(raw.sunrise, index),
    sunset: textAt(raw.sunset, index),
    uvMax: valueAt(raw.uv_index_max, index),
    precipitationSum: valueAt(raw.precipitation_sum, index),
    precipitationProbabilityMax: valueAt(raw.precipitation_probability_max, index),
    precipitationHours: valueAt(raw.precipitation_hours, index),
    windMax: valueAt(raw.wind_speed_10m_max, index),
    gustMax: valueAt(raw.wind_gusts_10m_max, index),
    windDirectionDominant: valueAt(raw.wind_direction_10m_dominant, index)
  }));
}

export function normalizeHourly(raw) {
  if (!raw || !Array.isArray(raw.time)) return [];
  return raw.time.map((time, index) => ({
    time: stringOrEmpty(time),
    temperature: valueAt(raw.temperature_2m, index),
    precipitationProbability: valueAt(raw.precipitation_probability, index),
    precipitation: valueAt(raw.precipitation, index),
    weatherCode: valueAt(raw.weather_code, index),
    windSpeed: valueAt(raw.wind_speed_10m, index)
  }));
}

/**
 * Normalize one forecast payload.
 * @returns {object|null} `null` when the payload is unusable (no `current` block)
 */
export function normalizeForecast(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const currentRaw = payload.current;
  if (!currentRaw || typeof currentRaw !== 'object') return null;
  return {
    timezone: stringOrEmpty(payload.timezone),
    utcOffsetSeconds: numericOrNull(payload.utc_offset_seconds),
    elevation: numericOrNull(payload.elevation),
    current: {
      time: stringOrEmpty(currentRaw.time),
      temperature: numericOrNull(currentRaw.temperature_2m),
      apparentTemperature: numericOrNull(currentRaw.apparent_temperature),
      humidity: numericOrNull(currentRaw.relative_humidity_2m),
      precipitation: numericOrNull(currentRaw.precipitation),
      weatherCode: numericOrNull(currentRaw.weather_code),
      cloudCover: numericOrNull(currentRaw.cloud_cover),
      pressure: numericOrNull(currentRaw.pressure_msl),
      surfacePressure: numericOrNull(currentRaw.surface_pressure),
      windSpeed: numericOrNull(currentRaw.wind_speed_10m),
      windDirection: numericOrNull(currentRaw.wind_direction_10m),
      windGusts: numericOrNull(currentRaw.wind_gusts_10m),
      isDay: currentRaw.is_day === 1 || currentRaw.is_day === true
    },
    daily: normalizeDaily(payload.daily),
    hourly: normalizeHourly(payload.hourly)
  };
}

/**
 * Hours from the current hour onward.
 *
 * `current.time` is `YYYY-MM-DDTHH:mm` local to the location and `hourly.time`
 * rows share that format, so string comparison finds the first future hour.
 */
export function selectUpcomingHours(hours, currentTime, count) {
  if (!Array.isArray(hours) || hours.length === 0) return [];
  const limit = Number.isFinite(count) ? count : UPCOMING_HOURS;
  const anchor = typeof currentTime === 'string' && currentTime.length >= 13 ? `${currentTime.slice(0, 13)}:00` : '';
  let start = 0;
  if (anchor) {
    const found = hours.findIndex(hour => hour && typeof hour.time === 'string' && hour.time >= anchor);
    start = found === -1 ? 0 : found;
  }
  return hours.slice(start, start + limit);
}

/** The `daysAhead`-th daily entry (0 = today), or `null`. */
export function dayAhead(days, daysAhead) {
  if (!Array.isArray(days)) return null;
  return days[daysAhead] || null;
}

/** The next `count` days after today, which is what "未来 3 天" means. */
export function upcomingDays(days, count) {
  if (!Array.isArray(days)) return [];
  return days.slice(1, 1 + (Number.isFinite(count) ? count : 3));
}
