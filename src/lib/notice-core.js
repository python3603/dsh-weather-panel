/**
 * Pure decision logic for the startup notice.
 *
 * Split out of the overlay component so the "should we interrupt the user?"
 * rule can be unit-tested: it encodes the two triggers (rain today, active
 * alerts) and the two dedupe levels (per-day acknowledgement, in-session
 * handling), and a wrong branch here either nags or stays silent when it
 * matters.
 */

import { alertSignature } from './alerts.js';

/** What today's forecast implies about going outside. */
export function summarizeToday(forecast) {
  if (!forecast) return null;
  const today = forecast.daily && forecast.daily[0] ? forecast.daily[0] : null;
  const amount = today && typeof today.precipitationSum === 'number' ? today.precipitationSum : 0;
  const chance = today && typeof today.precipitationProbabilityMax === 'number' ? today.precipitationProbabilityMax : 0;
  const nowAmount = forecast.current && typeof forecast.current.precipitation === 'number' ? forecast.current.precipitation : 0;
  const willRain = amount >= 0.2 || chance >= 50 || nowAmount > 0;
  return { amount, chance, willRain };
}

/** Signature of the current notice-worthy state; a new alert changes it. */
export function noticeSignature(summary, alerts) {
  const rain = summary && summary.willRain ? 'rain' : '';
  return `${alertSignature(alerts)}|${rain}`;
}

/**
 * Decide whether the notice should be visible right now.
 *
 * @param {object} input
 * @param {object|null} input.summary     result of `summarizeToday`
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
  const rain = Boolean(summary && summary.willRain);
  const hasAlerts = alerts.length > 0;
  // Alerts stand on their own: an NMC alert must still be shown when the
  // Open-Meteo request failed, so the forecast is only required for rain.
  if (!hasAlerts && !(input.hasForecast && rain)) return false;
  // Demo mode (a fake alert injected on purpose) ignores the acknowledgements so
  // the dialog can be inspected repeatedly without clearing storage each time.
  if (input.force === true) return true;
  const signature = noticeSignature(summary, alerts);
  if (input.handled && input.handled === signature) return false;
  if (input.stored && input.stored.date === input.date && input.stored.signature === signature) return false;
  return true;
}
