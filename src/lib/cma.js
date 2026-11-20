/**
 * China Weather Service (weather.cma.cn) fallback forecast.
 *
 * Why: the primary Open-Meteo endpoint is hosted outside mainland China; TCP
 * connects to it are the only request in this panel that crosses the border,
 * and users on some networks see them time out while the domestic radar and
 * satellite images stay fast. When that happens the panel used to show a bare
 * "request timed out"; this module turns the same domestic feed the China
 * Meteorological Administration publishes into the panel's normalized shape,
 * so a failed primary request degrades instead of breaking.
 *
 * The feed is daily + current only: there is no hourly series, so the
 * normalized snapshot carries `partial: true` and the views must not claim a
 * dry 12-hour window from it. The alert source is separate (NMC findAlarm) and
 * is not replaced here.
 */

export const CMA_API_BASE = 'https://weather.cma.cn/api';

export const CMA_SOURCE = {
  id: 'cma',
  name: '中央气象台',
  url: 'https://weather.cma.cn/',
  license: ''
};

/**
 * CMA weather-phenomenon codes → the closest WMO 4677 code the panel renders.
 * Codes the panel has no exact WMO peer for (dust, haze) fall back to fog or
 * overcast so the icon stays sensible.
 */
export const CMA_TO_WMO = {
  0: 0, 1: 2, 2: 3, 3: 80, 4: 95, 5: 96, 6: 66,
  7: 61, 8: 63, 9: 65, 10: 65, 11: 65, 12: 65,
  13: 85, 14: 71, 15: 73, 16: 75, 17: 75,
  18: 45, 19: 67, 20: 45, 21: 61, 22: 63, 23: 65,
  24: 65, 25: 65, 26: 71, 27: 73, 28: 75,
  29: 45, 30: 45, 31: 45, 32: 48, 33: 48, 34: 48, 53: 45,
  99: 3
};

export function cmaCodeToWmo(code) {
  const numeric = Number(code);
  if (!Number.isFinite(numeric)) return null;
  const mapped = CMA_TO_WMO[Math.trunc(numeric)];
  return typeof mapped === 'number' ? mapped : null;
}

export function buildCmaSearchUrl(query) {
  return `${CMA_API_BASE}/autocomplete?q=${encodeURIComponent(String(query || ''))}`;
}

export function buildCmaViewUrl(stationId) {
  return `${CMA_API_BASE}/weather/view?stationid=${encodeURIComponent(String(stationId || ''))}`;
}

/** `"54857|青岛|Qingdao|中国"` rows → station objects. */
export function parseCmaStations(payload) {
  const rows = payload && Array.isArray(payload.data) ? payload.data : [];
  return rows.map(row => {
    if (typeof row !== 'string') return null;
    const parts = row.split('|');
    if (parts.length < 2) return null;
    const id = parts[0].trim();
    const name = parts[1].trim();
    if (!id || !name) return null;
    return {
      id,
      name,
      en: (parts[2] || '').trim(),
      country: (parts[3] || '').trim()
    };
  }).filter(Boolean);
}

function stripSuffix(name) {
  return String(name || '').trim().replace(/[市辖区县旗盟州]$/u, '');
}

/**
 * Candidate search terms for a resolved location, most specific first.
 * A district name alone usually has no CMA station, so the city is tried too.
 */
export function cmaCandidateNames(location) {
  if (!location || typeof location !== 'object') return [];
  const out = [];
  const push = value => {
    const name = String(value || '').trim();
    if (!name) return;
    if (!out.includes(name)) out.push(name);
    const stripped = stripSuffix(name);
    if (stripped && !out.includes(stripped)) out.push(stripped);
  };
  push(location.city);
  push(location.district);
  if (!location.city && !location.district && location.label) {
    // A composed label ("青岛市·黄岛区") is not a station name; search its parts.
    String(location.label).split(/[·/]/).forEach(push);
  }
  return out;
}

/**
 * Same-named districts exist in several provinces (e.g. 朝阳区 in Beijing and
 * Changchun). CMA's `view` payload carries a `path` such as "山东 > 青岛", so a
 * station whose province does not match the located region must be rejected.
 */
export function cmaPathInRegion(path, region) {
  const rawPath = String(path || '').trim();
  const rawRegion = String(region || '').trim();
  if (!rawPath || !rawRegion) return true;
  const province = rawPath.split('>')[0].trim();
  const regionCore = rawRegion.replace(/(省|市|壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区)$/u, '');
  if (!province || !regionCore) return true;
  return province.startsWith(regionCore) || regionCore.startsWith(province) || regionCore.includes(province);
}

/** Best station for a set of candidate names; China stations only. */
export function pickCmaStation(stations, names) {
  if (!Array.isArray(stations) || stations.length === 0) return null;
  const candidates = (Array.isArray(names) ? names : [names]).map(stripSuffix).filter(Boolean);
  let best = null;
  let bestScore = -1;
  for (const station of stations) {
    if (!station || (station.country && station.country !== '中国')) continue;
    const stationName = stripSuffix(station.name);
    let score = 0;
    candidates.forEach((name, index) => {
      const base = 100 - index * 10;
      if (station.name === name) score = Math.max(score, base + 30);
      else if (stationName === name) score = Math.max(score, base + 20);
      else if (stationName.startsWith(name)) score = Math.max(score, base + 10);
      else if (stationName.includes(name)) score = Math.max(score, base);
    });
    if (score > bestScore) {
      bestScore = score;
      best = station;
    }
  }
  return bestScore > 0 ? best : null;
}

function numberOrNull(value) {
  const numeric = typeof value === 'string' ? Number(value) : value;
  return typeof numeric === 'number' && Number.isFinite(numeric) ? numeric : null;
}

function cmaDate(value) {
  const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(String(value || '').trim());
  if (!match) return '';
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
}

function cmaTimestamp(value, fallbackDate) {
  const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
  if (!match) return fallbackDate ? `${fallbackDate}T00:00` : '';
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}T${match[4].padStart(2, '0')}:${match[5]}`;
}

/**
 * Normalize a `weather/view` payload into the panel's forecast snapshot.
 * @returns {object|null} null when the payload has no usable current/daily data
 */
export function normalizeCmaForecast(payload, options) {
  const data = payload && payload.data;
  const now = data && data.now;
  const dailyRaw = data && Array.isArray(data.daily) ? data.daily : [];
  if (!now || typeof now !== 'object' || dailyRaw.length === 0) return null;
  const temperature = numberOrNull(now.temperature);
  if (temperature === null) return null;

  const today = dailyRaw[0] || {};
  const date = cmaDate(today.date);
  const time = cmaTimestamp(data.lastUpdate, date);
  const hour = /T(\d{2}):/.exec(time);
  const isDay = !hour || (Number(hour[1]) >= 6 && Number(hour[1]) < 18);

  const daily = dailyRaw.map(row => {
    const code = numberOrNull(row && row.dayCode);
    const nightCode = numberOrNull(row && row.nightCode);
    return {
      date: cmaDate(row && row.date),
      weatherCode: cmaCodeToWmo(code !== null ? code : nightCode),
      tempMax: numberOrNull(row && row.high),
      tempMin: numberOrNull(row && row.low),
      apparentMax: null,
      apparentMin: null,
      sunrise: '',
      sunset: '',
      uvMax: null,
      precipitationSum: null,
      precipitationProbabilityMax: null,
      precipitationHours: null,
      windMax: null,
      gustMax: null,
      windDirectionDominant: null
    };
  });

  const station = options && options.station ? options.station : null;
  return {
    timezone: 'Asia/Shanghai',
    utcOffsetSeconds: 28800,
    elevation: null,
    partial: true,
    source: CMA_SOURCE,
    station: station ? { id: station.id, name: station.name } : null,
    current: {
      time,
      temperature,
      apparentTemperature: numberOrNull(now.feelst),
      humidity: numberOrNull(now.humidity),
      precipitation: numberOrNull(now.precipitation) === null ? 0 : numberOrNull(now.precipitation),
      // The current block has no condition; borrow today's day/night code.
      weatherCode: cmaCodeToWmo(isDay ? today.dayCode : today.nightCode),
      cloudCover: null,
      pressure: numberOrNull(now.pressure),
      surfacePressure: null,
      // The CMA feed reports m/s; the panel's canonical unit is km/h.
      windSpeed: numberOrNull(now.windSpeed) === null ? null : Math.round(numberOrNull(now.windSpeed) * 3.6 * 10) / 10,
      windDirection: numberOrNull(now.windDirectionDegree),
      windGusts: null
    },
    daily,
    // No hourly series in this feed; consumers key off `partial`.
    hourly: []
  };
}
