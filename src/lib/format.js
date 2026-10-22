/**
 * Pure formatting helpers.
 *
 * All of these are deliberately free of DOM, React and locale-service access so
 * they can be unit-tested in Node and reused by both languages.
 */

export const METRIC = 'metric';
export const IMPERIAL = 'imperial';

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 16-point compass, Chinese names first so the two arrays stay in sync. */
const COMPASS_ZH = [
  '北', '北东北', '东北', '东北东',
  '东', '东南东', '东南', '南东南',
  '南', '南西南', '西南', '西南西',
  '西', '西北西', '西北', '北西北'
];

const COMPASS_EN = [
  'N', 'NNE', 'NE', 'ENE',
  'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW',
  'W', 'WNW', 'NW', 'NNW'
];

/** UV index bands (WHO scale) with both languages. */
const UV_BANDS = [
  { max: 2, zh: '低', en: 'Low' },
  { max: 5, zh: '中等', en: 'Moderate' },
  { max: 7, zh: '高', en: 'High' },
  { max: 10, zh: '很高', en: 'Very high' },
  { max: Infinity, zh: '极高', en: 'Extreme' }
];

export function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function roundTo(value, digits) {
  if (!isNumber(value)) return null;
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

export function celsiusToFahrenheit(value) {
  return value * 9 / 5 + 32;
}

export function kmhToMph(value) {
  return value * 0.621371;
}

export function mmToInch(value) {
  return value / 25.4;
}

export function hpaToInHg(value) {
  return value * 0.02953;
}

/** Round a Celsius value into the active unit system. */
export function convertTemperature(celsius, units) {
  if (!isNumber(celsius)) return null;
  return units === IMPERIAL ? celsiusToFahrenheit(celsius) : celsius;
}

/** `23°` in the active unit; `—` when the value is missing. */
export function formatTemperature(celsius, units) {
  const value = convertTemperature(celsius, units);
  return value === null ? '—' : `${Math.round(value)}°`;
}

/** Unit suffix for numeric labels, e.g. `km/h` or `mph`. */
export function windUnit(units) {
  return units === IMPERIAL ? 'mph' : 'km/h';
}

/** Unit suffix for distances of precipitation. */
export function precipitationUnit(units) {
  return units === IMPERIAL ? 'in' : 'mm';
}

export function formatWindSpeed(kmh, units) {
  if (!isNumber(kmh)) return '—';
  const value = units === IMPERIAL ? kmhToMph(kmh) : kmh;
  return `${Math.round(value)} ${windUnit(units)}`;
}

export function formatPrecipitation(mm, units) {
  if (!isNumber(mm)) return '—';
  const value = units === IMPERIAL ? mmToInch(mm) : mm;
  const digits = units === IMPERIAL ? 2 : (value >= 10 ? 0 : 1);
  return `${roundTo(value, digits)} ${precipitationUnit(units)}`;
}

export function formatPressure(hpa, units) {
  if (!isNumber(hpa)) return '—';
  if (units === IMPERIAL) return `${Math.round(hpaToInHg(hpa) * 100) / 100} inHg`;
  return `${Math.round(hpa)} hPa`;
}

export function formatPercent(value) {
  if (!isNumber(value)) return '—';
  return `${Math.round(value)}%`;
}

export function formatUv(value) {
  if (!isNumber(value)) return '—';
  return `${roundTo(value, 1)}`;
}

export function uvBand(value, lang) {
  if (!isNumber(value)) return '';
  const band = UV_BANDS.find(item => value <= item.max) || UV_BANDS[UV_BANDS.length - 1];
  return lang === 'en' ? band.en : band.zh;
}

/** Compass label for a meteorological wind direction in degrees. */
export function windDirectionLabel(degrees, lang) {
  if (!isNumber(degrees)) return '';
  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % 16;
  return (lang === 'en' ? COMPASS_EN : COMPASS_ZH)[index];
}

/** Split an Open-Meteo local timestamp such as `2026-10-22T06:12` without TZ math. */
export function isoParts(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(String(value || ''));
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: match[4] === undefined ? null : Number(match[4]),
    minute: match[5] === undefined ? null : Number(match[5])
  };
}

/** `06:12` from an API timestamp; `—` when absent. */
export function formatClock(value) {
  const parts = isoParts(value);
  if (!parts || parts.hour === null) return '—';
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

/** `06:12` from a local `Date` (used for the "updated at" line). */
export function formatClockFromDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Short weekday for a `YYYY-MM-DD` date, independent of the viewer's time zone. */
export function formatWeekday(isoDate, lang) {
  const parts = isoParts(isoDate);
  if (!parts) return '—';
  const utc = Date.UTC(parts.year, parts.month - 1, parts.day, 12);
  try {
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'zh-CN', {
      weekday: 'short',
      timeZone: 'UTC'
    }).format(new Date(utc));
  } catch (error) {
    return new Date(utc).toUTCString().slice(0, 3);
  }
}

/** `10月23日` / `Oct 23` for a `YYYY-MM-DD` date. */
export function formatMonthDay(isoDate, lang) {
  const parts = isoParts(isoDate);
  if (!parts) return '';
  if (lang === 'en') return `${EN_MONTHS[parts.month - 1]} ${parts.day}`;
  return `${parts.month}月${parts.day}日`;
}

/** Human label for a forecast offset: 1 → tomorrow, 2 → the day after, … */
export function formatDayOffset(offset, lang, translate) {
  if (offset === 0) return translate('day.today');
  if (offset === 1) return translate('day.tomorrow');
  if (offset === 2) return translate('day.afterTomorrow');
  return translate('day.inDays', { n: offset });
}

/** `36.06°N 120.38°E` — a readable fallback when no place name is available. */
export function formatCoordinates(lat, lon) {
  if (!isNumber(lat) || !isNumber(lon)) return '';
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  const latText = Math.abs(lat).toFixed(2);
  const lonText = Math.abs(lon).toFixed(2);
  return `${latText}°${ns} ${lonText}°${ew}`;
}

/** Stale-data hint in whole minutes. */
export function formatAgeMinutes(timestamp, nowMs) {
  if (!isNumber(timestamp)) return null;
  const reference = isNumber(nowMs) ? nowMs : Date.now();
  const elapsed = Math.max(0, reference - timestamp);
  return Math.floor(elapsed / 60000);
}
