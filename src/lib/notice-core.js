/**
 * Pure decision logic for the startup notice.
 *
 * The rain trigger is a **rolling window**, not a calendar day: "today has rain"
 * is true at 08:00 even when the only rain fell at 02:00, which is why the old
 * `summarizeToday` nagged about weather that had already passed. The window
 * starts at the current hour and looks ahead `RAIN_WINDOW_HOURS` (12 h).
 *
 * Two triggers remain: rain inside the window, and active alerts. Alerts stand
 * on their own (an NMC alert must still show when Open-Meteo failed), and the
 * two dedupe levels are unchanged: per-day acknowledgement and in-session
 * handling. The acknowledgement signature uses an **event fingerprint** so one
 * shower is acknowledged once while a genuinely new one may still notify.
 */

import { alertSignature } from './alerts.js';

/** How far ahead the rain notice looks. */
export const RAIN_WINDOW_HOURS = 12;
/** An hour counts as wet from this amount up (mm). */
export const RAIN_HOUR_THRESHOLD = 0.1;
/** …or when the chance reaches this (%). */
export const RAIN_CHANCE_THRESHOLD = 50;

/** `2026-10-31T14` → 14; tolerates full ISO strings. */
function hourOf(time) {
  const match = /T(\d{2})/.exec(String(time || ''));
  if (!match) return null;
  const hour = Number(match[1]);
  return Number.isFinite(hour) ? hour : null;
}

/** `2026-10-31T14:00` → `14:00`. */
export function hourLabel(time) {
  const hour = hourOf(time);
  return hour === null ? '' : `${String(hour).padStart(2, '0')}:00`;
}

function anchorOf(forecast) {
  const current = forecast && forecast.current ? forecast.current : null;
  const time = current && typeof current.time === 'string' ? current.time : '';
  // Hourly entries are local wall-clock ISO strings, so truncating to the hour
  // and comparing as strings is enough and timezone-proof.
  return time.length >= 13 ? `${time.slice(0, 13)}:00` : '';
}

function hoursFrom(forecast, anchor, limit) {
  const hourly = forecast && Array.isArray(forecast.hourly) ? forecast.hourly : [];
  if (!anchor) return hourly.slice(0, limit);
  const start = hourly.findIndex(hour => hour && typeof hour.time === 'string' && hour.time >= anchor);
  return (start === -1 ? hourly : hourly.slice(start)).slice(0, limit);
}

function emptySummary(kind) {
  return {
    kind: kind || 'none',
    start: '', end: '', hours: 0,
    amount: 0, maxChance: 0,
    startLabel: '', endLabel: ''
  };
}

/**
 * Summarize the next `RAIN_WINDOW_HOURS` hours.
 *
 * `kind: 'now'` when it is raining at the window's first hour (or the current
 * observation says so), `'soon'` for the first wet run later in the window,
 * `'none'` otherwise. Wet hours are merged into one run; a gap of one dry hour
 * ends the run (a new run later in the window is a separate event for the
 * signature, but the notice only speaks about the first one).
 *
 * @returns {null | {
 *   kind: 'now' | 'soon' | 'none',
 *   start: string, end: string, hours: number,
 *   amount: number, maxChance: number,
 *   startLabel: string, endLabel: string
 * }}
 */
export function summarizeRainWindow(forecast, options) {
  if (!forecast) return null;
  const settings = options || {};
  const windowHours = Number.isFinite(settings.hours) ? Math.max(1, Math.floor(settings.hours)) : RAIN_WINDOW_HOURS;
  const anchor = anchorOf(forecast);
  const hours = hoursFrom(forecast, anchor, windowHours);
  const currentAmount = forecast.current && Number.isFinite(forecast.current.precipitation)
    ? forecast.current.precipitation
    : 0;

  // Without an hourly series there is nothing honest to say about the window;
  // only the "it is raining right now" fact survives.
  if (hours.length === 0) {
    const rainingNow = currentAmount >= RAIN_HOUR_THRESHOLD;
    const summary = emptySummary(rainingNow ? 'now' : 'none');
    summary.amount = rainingNow ? currentAmount : 0;
    return summary;
  }

  let run = null;
  let chosen = null;
  for (const hour of hours) {
    const amount = Number.isFinite(hour.precipitation) ? hour.precipitation : 0;
    const chance = Number.isFinite(hour.precipitationProbability) ? hour.precipitationProbability : 0;
    const wet = amount >= RAIN_HOUR_THRESHOLD || chance >= RAIN_CHANCE_THRESHOLD;
    if (!wet) {
      run = null;
      continue;
    }
    if (!run) {
      run = { start: hour.time, end: hour.time, hours: 0, amount: 0, maxChance: 0 };
      if (!chosen) chosen = run;
    }
    run.end = hour.time;
    run.hours += 1;
    run.amount += amount;
    run.maxChance = Math.max(run.maxChance, chance);
  }

  if (!chosen) return emptySummary('none');

  const firstHour = hours[0];
  const rainingNow = currentAmount >= RAIN_HOUR_THRESHOLD
    || (firstHour && firstHour.time === chosen.start
      && (Number.isFinite(firstHour.precipitation) ? firstHour.precipitation : 0) >= RAIN_HOUR_THRESHOLD);

  return {
    kind: rainingNow ? 'now' : 'soon',
    start: chosen.start,
    end: chosen.end,
    hours: chosen.hours,
    amount: Math.round(chosen.amount * 10) / 10,
    maxChance: chosen.maxChance,
    startLabel: hourLabel(chosen.start),
    endLabel: hourLabel(chosen.end)
  };
}

/** How often the user allows a rain notice to interrupt them. */
export const NOTICE_FREQUENCIES = [
  { key: 'every', zh: '每次新降水', en: 'Every new event', ms: 0 },
  { key: '1h', zh: '每小时最多一次', en: 'At most hourly', ms: 60 * 60 * 1000 },
  { key: '3h', zh: '每 3 小时最多一次', en: 'At most every 3 hours', ms: 3 * 60 * 60 * 1000 },
  { key: '6h', zh: '每 6 小时最多一次', en: 'At most every 6 hours', ms: 6 * 60 * 60 * 1000 },
  { key: '12h', zh: '每 12 小时最多一次', en: 'At most every 12 hours', ms: 12 * 60 * 60 * 1000 },
  { key: 'daily', zh: '每天最多一次', en: 'At most once a day', ms: null }
];

export const DEFAULT_NOTICE_FREQUENCY = '3h';

/** A persisted frequency key, falling back to the default. */
export function normalizeNoticeFrequency(value) {
  return NOTICE_FREQUENCIES.some(item => item.key === value) ? value : DEFAULT_NOTICE_FREQUENCY;
}

/**
 * May a rain notice appear again?
 *
 * `'daily'` compares local calendar days; the other presets use a minimum gap
 * since the last rain notice. Alerts never go through this gate.
 */
export function rainNoticeAllowed(frequency, lastAt, now) {
  const key = normalizeNoticeFrequency(frequency);
  if (key === 'every') return true;
  if (!Number.isFinite(lastAt)) return true;
  const current = now instanceof Date ? now.getTime() : Date.now();
  if (key === 'daily') {
    const last = new Date(lastAt);
    const today = new Date(current);
    return last.toDateString() !== today.toDateString();
  }
  const preset = NOTICE_FREQUENCIES.find(item => item.key === key);
  const gap = preset && Number.isFinite(preset.ms) ? preset.ms : 3 * 60 * 60 * 1000;
  return current - lastAt >= gap;
}

/**
 * Stable fingerprint of one rain event.
 *
 * The amount is deliberately left out: a forecast refresh that changes 11.0 mm
 * to 11.4 mm is the same event and must not re-notify. An ongoing rain uses its
 * **date** so one acknowledged rainy day does not pop every hour.
 */
export function rainEventKey(summary) {
  if (!summary || summary.kind === 'none') return '';
  if (summary.kind === 'now') {
    const day = String(summary.start || '').slice(0, 10);
    return `rain:now:${day}`;
  }
  return `rain:soon:${summary.start}`;
}

/**
 * Daily summary kept for callers that still ask "is today wet?".
 * The notice no longer uses it.
 */
export function summarizeToday(forecast) {
  if (!forecast) return null;
  const today = forecast.daily && forecast.daily[0] ? forecast.daily[0] : null;
  const amount = today && typeof today.precipitationSum === 'number' ? today.precipitationSum : 0;
  const chance = today && typeof today.precipitationProbabilityMax === 'number' ? today.precipitationProbabilityMax : 0;
  const nowAmount = forecast.current && typeof forecast.current.precipitation === 'number' ? forecast.current.precipitation : 0;
  const willRain = amount >= 0.2 || chance >= 50 || nowAmount > 0;
  return { amount, chance, willRain };
}

/** Signature of the current notice-worthy state; a new event changes it. */
export function noticeSignature(summary, alerts) {
  const rain = rainEventKey(summary);
  return `${alertSignature(alerts)}|${rain}`;
}

/** `'07:30'` → 450; NaN when unparsable. */
export function timeToMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
  if (!match) return Number.NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return Number.NaN;
  return hours * 60 + minutes;
}

/** Is `date` inside the quiet range? Ranges may wrap midnight (23:00–07:00). */
export function isWithinQuietHours(date, quiet) {
  if (!quiet || quiet.enabled !== true) return false;
  const now = date instanceof Date ? date : new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const startRaw = timeToMinutes(quiet.start);
  const endRaw = timeToMinutes(quiet.end);
  const start = Number.isFinite(startRaw) ? startRaw : 23 * 60;
  const end = Number.isFinite(endRaw) ? endRaw : 7 * 60;
  if (start === end) return false;
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

/** Has the daily digest time arrived today? Compares wall-clock minutes. */
export function isDailyReminderDue(date, reminder) {
  if (!reminder || reminder.enabled !== true) return false;
  const now = date instanceof Date ? date : new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const target = timeToMinutes(reminder.time);
  if (!Number.isFinite(target)) return false;
  return nowMinutes >= target;
}

/**
 * Decide whether the notice should be visible right now.
 *
 * @param {object} input
 * @param {object|null} input.summary     result of `summarizeRainWindow`
 * @param {Array}       input.alerts      matched alerts
 * @param {object|null} input.stored      persisted `{date, signature}`
 * @param {string}      input.handled     signature dismissed in this session
 * @param {string}      input.date        today's `YYYY-MM-DD`
 * @param {boolean}     input.hasForecast whether a forecast is loaded yet
 * @returns {boolean}
 */
export function shouldNotify(input) {
  const summary = input.summary;
  const alerts = Array.isArray(input.alerts) ? input.alerts : [];
  const rain = Boolean(summary && summary.kind && summary.kind !== 'none');
  const hasAlerts = alerts.length > 0;
  // Frequency gate: the rain part may be throttled by the user's choice. The
  // alert part never is.
  const rainAllowed = rain && rainNoticeAllowed(input.frequency, input.lastRainAt, input.now);
  if (!hasAlerts && !(input.hasForecast && rainAllowed)) return false;
  // Demo mode (a fake alert injected on purpose) ignores the acknowledgements so
  // the dialog can be inspected repeatedly without clearing storage each time.
  if (input.force === true) return true;
  const signature = noticeSignature(summary, alerts);
  if (input.handled && input.handled === signature) return false;
  if (input.stored && input.stored.date === input.date && input.stored.signature === signature) return false;
  return true;
}
