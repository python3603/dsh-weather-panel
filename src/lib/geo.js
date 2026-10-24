/**
 * Network location: public-IP geolocation plus locality naming.
 *
 * Design constraints, learned the hard way:
 * - No single IP-geolocation service is reliable everywhere (rate limits,
 *   carrier NAT, proxies, regional blocking), so several are raced and the
 *   first usable answer wins. One provider failing must never fail the panel.
 * - The result is city-level at best and can be a proxy exit, therefore the
 *   panel always shows the source and offers a manual override.
 * - Nothing here performs I/O itself: the caller injects `fetchJson`, which
 *   keeps every branch unit-testable.
 */

import { looksLikeDistrict, searchDistricts } from './districts.js';

const GEO_LOOKUP_TIMEOUT_MS = 6000;
const GEO_REQUEST_TIMEOUT_MS = 5000;
const REVERSE_GEOCODE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';
const CITY_SEARCH_URL = 'https://geocoding-api.open-meteo.com/v1/search';

export const GEO_PROVIDERS = [
  {
    id: 'ipwho.is',
    url: 'https://ipwho.is/',
    parse: parseIpWhoIs
  },
  {
    id: 'ipinfo.io',
    url: 'https://ipinfo.io/json',
    parse: parseIpinfo
  },
  {
    id: 'ip.sb',
    url: 'https://api.ip.sb/geoip',
    parse: parseIpSb
  }
];

function toFiniteNumber(value) {
  const numeric = typeof value === 'string' ? Number(value.trim()) : value;
  return typeof numeric === 'number' && Number.isFinite(numeric) ? numeric : null;
}

export function cleanName(value) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  return text.length > 0 ? text : '';
}

/** Validate and normalize one provider answer; `null` means "unusable". */
export function normalizeGeo(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const lat = toFiniteNumber(raw.lat);
  const lon = toFiniteNumber(raw.lon);
  if (lat === null || lon === null) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return {
    lat,
    lon,
    city: cleanName(raw.city),
    region: cleanName(raw.region),
    country: cleanName(raw.country),
    countryCode: cleanName(raw.countryCode).toUpperCase(),
    timezone: cleanName(raw.timezone),
    ip: cleanName(raw.ip),
    provider: cleanName(raw.provider),
    source: 'network'
  };
}

/** `https://ipwho.is/` */
export function parseIpWhoIs(json) {
  if (!json || json.success === false) return null;
  return normalizeGeo({
    lat: json.latitude,
    lon: json.longitude,
    city: json.city,
    region: json.region,
    country: json.country,
    countryCode: json.country_code,
    timezone: json.timezone && json.timezone.id ? json.timezone.id : json.timezone,
    ip: json.ip,
    provider: 'ipwho.is'
  });
}

/** `https://ipinfo.io/json` — coordinates arrive as `"lat,lon"`. */
export function parseIpinfo(json) {
  if (!json || typeof json !== 'object') return null;
  const loc = typeof json.loc === 'string' ? json.loc.split(',') : [];
  return normalizeGeo({
    lat: loc.length === 2 ? loc[0] : null,
    lon: loc.length === 2 ? loc[1] : null,
    city: json.city,
    region: json.region,
    country: json.country,
    countryCode: json.country,
    timezone: json.timezone,
    ip: json.ip,
    provider: 'ipinfo.io'
  });
}

/** `https://api.ip.sb/geoip` */
export function parseIpSb(json) {
  if (!json || typeof json !== 'object' || json.ip === undefined) return null;
  return normalizeGeo({
    lat: json.latitude,
    lon: json.longitude,
    city: json.city,
    region: json.region,
    country: json.country,
    countryCode: json.country_code,
    timezone: json.timezone,
    ip: json.ip,
    provider: 'ip.sb'
  });
}

/**
 * Race every IP-geolocation provider and resolve with the first usable answer.
 *
 * @param {(url: string, options: object) => Promise<any>} fetchJson injected JSON fetcher
 * @param {{signal?: AbortSignal, timeoutMs?: number, providers?: Array<any>}} [options]
 * @returns {Promise<object|null>} normalized location, or `null` when nothing usable
 */
export function lookupNetworkLocation(fetchJson, options) {
  const settings = options || {};
  const providers = Array.isArray(settings.providers) ? settings.providers : GEO_PROVIDERS;
  const timeoutMs = Number.isFinite(settings.timeoutMs) ? settings.timeoutMs : GEO_LOOKUP_TIMEOUT_MS;
  const externalSignal = settings.signal;
  if (providers.length === 0) return Promise.resolve(null);

  return new Promise(resolve => {
    const controller = new AbortController();
    let settled = false;
    let pending = providers.length;

    const finish = value => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (externalSignal) externalSignal.removeEventListener('abort', onAbort);
      resolve(value);
      try {
        controller.abort();
      } catch (error) {
        /* already aborted */
      }
    };

    const onAbort = () => finish(null);
    const timer = setTimeout(() => finish(null), timeoutMs);
    if (externalSignal) {
      if (externalSignal.aborted) {
        finish(null);
        return;
      }
      externalSignal.addEventListener('abort', onAbort, { once: true });
    }

    providers.forEach(provider => {
      Promise.resolve()
        .then(() => fetchJson(provider.url, { signal: controller.signal, timeoutMs: GEO_REQUEST_TIMEOUT_MS }))
        .then(payload => {
          const parsed = provider.parse(payload);
          if (parsed) finish(parsed);
        })
        .catch(() => {
          /* a failing provider simply loses the race */
        })
        .then(() => {
          pending -= 1;
          if (pending === 0) finish(null);
        });
    });
  });
}

/** Build a short, human-readable place name from a reverse-geocode payload. */
export function localityLabel(payload) {
  if (!payload || typeof payload !== 'object') return '';
  const city = cleanName(payload.city);
  const locality = cleanName(payload.locality);
  const region = cleanName(payload.principalSubdivision);
  const country = cleanName(payload.countryName);
  const parts = [];
  if (city) parts.push(city);
  if (locality && locality !== city) parts.push(locality);
  if (parts.length === 0 && region) parts.push(region);
  if (parts.length === 0 && country) parts.push(country);
  return parts.join(' · ');
}

/**
 * Name the coordinates. Best-effort: the caller falls back to the IP provider's
 * city or to formatted coordinates when this returns nothing.
 */
export async function reverseGeocode(fetchJson, lat, lon, options) {
  const settings = options || {};
  const language = settings.language === 'en' ? 'en' : 'zh-Hans';
  const url = `${REVERSE_GEOCODE_URL}?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=${language}`;
  const payload = await fetchJson(url, {
    signal: settings.signal,
    timeoutMs: settings.timeoutMs || GEO_REQUEST_TIMEOUT_MS
  });
  const label = localityLabel(payload);
  return {
    label,
    city: cleanName(payload && payload.city),
    locality: cleanName(payload && payload.locality),
    region: cleanName(payload && payload.principalSubdivision),
    country: cleanName(payload && payload.countryName),
    countryCode: cleanName(payload && payload.countryCode).toUpperCase()
  };
}

/** Normalize one geocoding hit into the shape the picker renders. */
export function normalizeCityHit(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const lat = toFiniteNumber(raw.latitude);
  const lon = toFiniteNumber(raw.longitude);
  if (lat === null || lon === null) return null;
  const name = cleanName(raw.name);
  if (!name) return null;
  // Open-Meteo 的 admin2 对中国来说通常是地级市，而 name 才可能是区县名；
  // 之前的版本直接把 admin2 当 district，会让「选城市」被误判成「选了某个区」。
  const admin2 = cleanName(raw.admin2);
  const nameIsDistrict = looksLikeDistrict(name);
  const admin2IsDistrict = looksLikeDistrict(admin2);
  let cityName = admin2 || name;
  let district = '';
  if (nameIsDistrict && admin2 && !admin2IsDistrict) {
    cityName = admin2;
    district = name;
  } else if (admin2IsDistrict && name !== admin2) {
    cityName = name;
    district = admin2;
  }
  return {
    id: raw.id,
    name,
    region: cleanName(raw.admin1),
    subtitle: [cleanName(raw.admin1), cleanName(raw.country)].filter(Boolean).join(' · '),
    city: cityName,
    district,
    country: cleanName(raw.country),
    countryCode: cleanName(raw.country_code).toUpperCase(),
    featureCode: cleanName(raw.feature_code),
    source: 'geocoding',
    lat,
    lon
  };
}

/** Score a hit so cities outrank islands and exact names win. */
export function scoreCityHit(hit, query) {
  let score = 0;
  const normalized = String(query || '').trim();
  if (normalized && hit.name === normalized) score += 100;
  else if (normalized && (hit.name === `${normalized}市` || hit.name === `${normalized}县`)) score += 80;
  else if (normalized && hit.name.startsWith(normalized)) score += 20;
  switch (hit.featureCode) {
    case 'PPLC':
      score += 60;
      break;
    case 'PPLA':
      score += 50;
      break;
    case 'PPLA2':
      score += 40;
      break;
    case 'PPLA3':
    case 'PPLA4':
      score += 25;
      break;
    case 'PPL':
      score += 15;
      break;
    default:
      score -= 20;
  }
  return score;
}

/**
 * Search cities by name.
 *
 * Chinese city names are ambiguous in the GeoNames index (`青岛` alone can miss
 * the city), so a `市` variant is queried in parallel and the merged list is
 * ranked by exact-name matches and settlement feature codes.
 */
export async function searchCities(fetchJson, query, options) {
  const settings = options || {};
  const text = String(query || '').trim();
  if (!text) return [];
  const language = settings.language === 'en' ? 'en' : 'zh';
  const limit = Number.isFinite(settings.limit) ? settings.limit : 6;
  // 本地区县索引先出结果（不联网、无延迟），覆盖 Open-Meteo 搜不到的区县名。
  const local = searchDistricts(text, { lang: language, limit });

  const variants = [text];
  if (/[\u4e00-\u9fa5]/.test(text) && !/[市县区州盟旗]$/.test(text)) variants.push(`${text}市`);

  const batches = await Promise.all(variants.map(name => {
    const url = `${CITY_SEARCH_URL}?name=${encodeURIComponent(name)}&count=20&language=${language}&format=json`;
    return fetchJson(url, { signal: settings.signal, timeoutMs: settings.timeoutMs || GEO_REQUEST_TIMEOUT_MS })
      .then(payload => (payload && Array.isArray(payload.results) ? payload.results : []))
      .catch(() => []);
  }));

  const byId = new Map();
  batches.forEach(batch => {
    batch.forEach(raw => {
      const hit = normalizeCityHit(raw);
      if (!hit) return;
      const key = hit.id === undefined || hit.id === null ? `${hit.name}|${hit.lat}|${hit.lon}` : String(hit.id);
      if (!byId.has(key)) byId.set(key, hit);
    });
  });

  const remote = Array.from(byId.values())
    .map(hit => ({ ...hit, score: scoreCityHit(hit, text) }))
    .sort((left, right) => right.score - left.score);

  // 本地索引在前（区县精确），网络结果补位；同名同坐标只留一条。
  const merged = [];
  const seen = new Set();
  const push = hit => {
    if (!hit) return;
    const key = `${hit.name}|${Number(hit.lat).toFixed(1)}|${Number(hit.lon).toFixed(1)}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(hit);
  };
  local.forEach(push);
  remote.forEach(push);
  return merged.slice(0, limit);
}
