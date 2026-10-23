/**
 * 历史气温曲线（不是 K 线）：直接取 Open-Meteo 的逐日最高 / 最低 / 平均。
 *
 * 用 forecast 主机的 `past_days`（配额和 archive 分开），失败再退到
 * historical-forecast 主机与 archive 主机 —— 三台都试不到才报错。
 * `forecast_days=0` 只回过去，不含今天，意味着点都是**完整日**（截至昨天）。
 */

import { isNumber } from './format.js';

export const HISTORY_RANGES = [7, 30];
export const HISTORY_DEFAULT_RANGE = 7;
/** 主站 → 备用主机 → archive（archive 需要 start/end 日期，单独构造）。 */
export const HISTORY_HOSTS = [
  'https://api.open-meteo.com/v1/forecast',
  'https://historical-forecast-api.open-meteo.com/v1/forecast'
];

export const HISTORY_DAILY_FIELDS = 'temperature_2m_max,temperature_2m_min,temperature_2m_mean';

export function normalizeRange(range) {
  const value = Math.round(Number(range));
  return HISTORY_RANGES.includes(value) ? value : HISTORY_DEFAULT_RANGE;
}

export function buildHistoryUrl(host, lat, lon, days, options) {
  const range = normalizeRange(days);
  const timezone = (options && options.timezone) || 'Asia/Shanghai';
  return `${host}?latitude=${lat}&longitude=${lon}`
    + `&daily=${HISTORY_DAILY_FIELDS}`
    + `&past_days=${range}&forecast_days=0`
    + `&timezone=${encodeURIComponent(timezone)}`;
}

export function buildArchiveUrl(lat, lon, startIso, endIso, options) {
  const timezone = (options && options.timezone) || 'Asia/Shanghai';
  return `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}`
    + `&daily=${HISTORY_DAILY_FIELDS}`
    + `&start_date=${startIso}&end_date=${endIso}`
    + `&timezone=${encodeURIComponent(timezone)}`;
}

function toDateIso(ms) {
  const date = new Date(ms);
  const pad = value => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** archive 的日期窗口：过去 range 天，截止到 6 天前（ERA5 有滞后）。 */
export function archiveWindow(days, nowMs) {
  const range = normalizeRange(days);
  const now = isNumber(nowMs) ? nowMs : Date.now();
  const end = now - 6 * 86400000;
  const start = end - (range - 1) * 86400000;
  return { start: toDateIso(start), end: toDateIso(end) };
}

/** Open-Meteo daily 返回 → [{ date, max, min, mean }]，只保留有数据的日期。 */
export function normalizeHistory(payload, days) {
  const daily = payload && payload.daily ? payload.daily : null;
  if (!daily || !Array.isArray(daily.time)) return [];
  const range = normalizeRange(days);
  const rows = [];
  for (let index = 0; index < daily.time.length; index += 1) {
    const date = daily.time[index];
    const max = isNumber(daily.temperature_2m_max ? daily.temperature_2m_max[index] : null)
      ? daily.temperature_2m_max[index] : null;
    const min = isNumber(daily.temperature_2m_min ? daily.temperature_2m_min[index] : null)
      ? daily.temperature_2m_min[index] : null;
    const mean = isNumber(daily.temperature_2m_mean ? daily.temperature_2m_mean[index] : null)
      ? daily.temperature_2m_mean[index] : null;
    if (max === null && min === null && mean === null) continue;
    rows.push({ date, max, min, mean });
  }
  return rows.slice(-range);
}

export function historySummary(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const highs = list.map(row => row.max).filter(isNumber);
  const lows = list.map(row => row.min).filter(isNumber);
  const means = list.map(row => row.mean).filter(isNumber);
  const average = values => (values.length
    ? +(values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)
    : null);
  return {
    high: highs.length ? Math.max(...highs) : null,
    low: lows.length ? Math.min(...lows) : null,
    mean: average(means)
  };
}
