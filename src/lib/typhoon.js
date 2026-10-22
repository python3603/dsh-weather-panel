/**
 * 台风路径数据（中央气象台台风网）。
 *
 * 站点接口是 JSONP：`https://typhoon.nmc.cn/weatherservice/typhoon/jsons/list_default`
 * 与 `…/view_<id>`。两者都带 `Access-Control-Allow-Origin: *`，所以浏览器可以
 * `fetch` 成文本后自己剥掉 `callback(...)` 外壳——不需要注入 <script>，也就没有
 * 全局回调污染，与其它插件互不影响。
 *
 * 原始结构是位置数组而不是对象（压缩过的历史格式），因此全部解析集中在这里，
 * 由单元测试固定住下标含义：
 *   point = [id, utcTime, epochMs, intensity, lon, lat, pressure, wind,
 *            moveDir, moveSpeed, windRadii, forecasts, [label, zhText, …]]
 */

export const TYPHOON_LIST_URL = 'https://typhoon.nmc.cn/weatherservice/typhoon/jsons/list_default';
export const TYPHOON_DETAIL_URL = 'https://typhoon.nmc.cn/weatherservice/typhoon/jsons/view_';

/** 强度等级：rank 越高越强，color 用于轨迹与图例。 */
export const TYPHOON_LEVELS = [
  { code: 'TD', zh: '热带低压', en: 'Tropical depression', rank: 1, color: '#7dd3fc' },
  { code: 'TS', zh: '热带风暴', en: 'Tropical storm', rank: 2, color: '#38bdf8' },
  { code: 'STS', zh: '强热带风暴', en: 'Severe tropical storm', rank: 3, color: '#34d399' },
  { code: 'TY', zh: '台风', en: 'Typhoon', rank: 4, color: '#fbbf24' },
  { code: 'STY', zh: '强台风', en: 'Severe typhoon', rank: 5, color: '#fb923c' },
  { code: 'SuperTY', zh: '超强台风', en: 'Super typhoon', rank: 6, color: '#ef4444' }
];

const TYPHOON_LEVEL_FALLBACK = { code: '', zh: '未知强度', en: 'Unknown', rank: 0, color: '#94a3b8' };

function toNumber(value) {
  const numeric = typeof value === 'string' ? Number(value) : value;
  return typeof numeric === 'number' && Number.isFinite(numeric) ? numeric : null;
}

function toText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** Typhoon numbers arrive as both `"2630"` and `2630`; keep both usable. */
function toLooseText(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return toText(value);
}

/**
 * Strip a JSONP wrapper: `callback(({...}))` or `callback({...})`.
 * @returns {object|null} the parsed payload, or `null` when it is not JSONP/JSON
 */
export function parseJsonp(text) {
  const raw = toText(text);
  if (!raw) return null;
  const first = raw.indexOf('(');
  const last = raw.lastIndexOf(')');
  if (first === -1 || last === -1 || last <= first) return null;
  let body = raw.slice(first + 1, last).trim();
  while (body.startsWith('(') && body.endsWith(')')) body = body.slice(1, -1).trim();
  try {
    return JSON.parse(body);
  } catch (error) {
    return null;
  }
}

/** Metadata for one intensity code. */
export function describeTyphoonIntensity(code, lang) {
  const level = TYPHOON_LEVELS.find(item => item.code === code);
  const resolved = level || TYPHOON_LEVEL_FALLBACK;
  return {
    code: resolved.code,
    rank: resolved.rank,
    color: resolved.color,
    label: lang === 'en' ? resolved.en : resolved.zh
  };
}

/** `2630` → `{year: 2026, sequence: 30}`; `20260027` is the 8-digit variant. */
export function parseTyphoonNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 4) {
    return { year: 2000 + Number(digits.slice(0, 2)), sequence: Number(digits.slice(2)) };
  }
  if (digits.length === 8) {
    return { year: Number(digits.slice(0, 4)), sequence: Number(digits.slice(6)) };
  }
  return { year: null, sequence: null };
}

/** `第 30 号` / `No. 30` */
export function formatTyphoonNumber(value, lang) {
  const parsed = parseTyphoonNumber(value);
  if (!parsed.sequence) return '';
  return lang === 'en' ? `No. ${parsed.sequence}` : `第 ${parsed.sequence} 号`;
}

/** Normalize the `typhoonList` payload into plain objects. */
export function normalizeTyphoonList(payload) {
  const rows = payload && Array.isArray(payload.typhoonList) ? payload.typhoonList : [];
  return rows.map(row => {
    if (!Array.isArray(row)) return null;
    const id = toNumber(row[0]);
    if (id === null) return null;
    return {
      id,
      nameEn: toText(row[1]),
      nameZh: toText(row[2]),
      number: toLooseText(row[3]),
      status: toText(row[7]) || 'stop',
      meaning: toText(row[6])
    };
  }).filter(Boolean);
}

/** Prefer a running typhoon; otherwise the newest numbered one. */
export function pickTyphoon(list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const active = list.filter(item => item.status === 'start');
  const pool = active.length > 0 ? active : list;
  return pool.slice().sort((left, right) => {
    const leftSeq = parseTyphoonNumber(left.number).sequence || 0;
    const rightSeq = parseTyphoonNumber(right.number).sequence || 0;
    if (rightSeq !== leftSeq) return rightSeq - leftSeq;
    return right.id - left.id;
  })[0];
}

function normalizeWindRadii(value) {
  if (!Array.isArray(value)) return [];
  return value.map(entry => {
    if (!Array.isArray(entry)) return null;
    const quadrants = entry.slice(1, 5).map(toNumber).filter(item => item !== null);
    if (quadrants.length === 0) return null;
    return {
      level: toText(entry[0]),
      radiusKm: Math.max(...quadrants)
    };
  }).filter(Boolean);
}

function normalizeForecastMap(value) {
  if (!value || typeof value !== 'object') return [];
  const agency = value.BABJ || value.babj || Object.values(value).find(item => Array.isArray(item));
  if (!Array.isArray(agency)) return [];
  return agency.map(entry => {
    if (!Array.isArray(entry)) return null;
    const hour = toNumber(entry[0]);
    const lon = toNumber(entry[2]);
    const lat = toNumber(entry[3]);
    if (hour === null || lon === null || lat === null) return null;
    return {
      hour,
      baseTime: toText(entry[1]),
      lon,
      lat,
      pressure: toNumber(entry[4]),
      wind: toNumber(entry[5]),
      agency: toText(entry[6]) || 'BABJ',
      intensity: toText(entry[7])
    };
  }).filter(Boolean);
}

function normalizeTrackPoint(row) {
  if (!Array.isArray(row)) return null;
  const lon = toNumber(row[4]);
  const lat = toNumber(row[5]);
  if (lon === null || lat === null) return null;
  const labels = Array.isArray(row[12]) ? row[12] : [];
  return {
    id: toNumber(row[0]),
    timeUtc: toText(row[1]),
    epoch: toNumber(row[2]),
    intensity: toText(row[3]),
    lon,
    lat,
    pressure: toNumber(row[6]),
    wind: toNumber(row[7]),
    moveDirection: toText(row[8]),
    moveSpeed: toNumber(row[9]),
    windRadii: normalizeWindRadii(row[10]),
    forecast: normalizeForecastMap(row[11]),
    timeLabel: toText(labels[0]),
    timeText: toText(labels[1]) || toText(labels[0])
  };
}

/** Normalize the `typhoon` detail payload (header + track + forecast). */
export function normalizeTyphoonDetail(payload) {
  const row = payload && Array.isArray(payload.typhoon) ? payload.typhoon : null;
  if (!row) return null;
  const points = Array.isArray(row[8]) ? row[8].map(normalizeTrackPoint).filter(Boolean) : [];
  if (points.length === 0) return null;
  const latest = points[points.length - 1];
  // The newest fix often carries no forecast map yet (it arrives with the next
  // advisory), so walk back to the most recent point that does have one.
  let forecast = [];
  let forecastBase = '';
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (points[index].forecast && points[index].forecast.length > 0) {
      forecast = points[index].forecast;
      forecastBase = points[index].timeText;
      break;
    }
  }
  return {
    id: toNumber(row[0]),
    nameEn: toText(row[1]),
    nameZh: toText(row[2]),
    number: toLooseText(row[3]),
    status: toText(row[7]) || 'stop',
    meaning: toText(row[6]),
    points,
    latest,
    forecast,
    forecastBase
  };
}

/**
 * Geographic bounds covering the whole track plus the forecast, padded so the
 * line never touches the edge of the drawing area.
 */
export function trackBounds(detail, paddingDegrees) {
  const pad = Number.isFinite(paddingDegrees) ? paddingDegrees : 3;
  if (!detail || !Array.isArray(detail.points) || detail.points.length === 0) return null;
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  const consider = (lon, lat) => {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    west = Math.min(west, lon);
    east = Math.max(east, lon);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  };
  detail.points.forEach(point => consider(point.lon, point.lat));
  (detail.forecast || []).forEach(point => consider(point.lon, point.lat));
  if (!Number.isFinite(west)) return null;
  west -= pad;
  east += pad;
  south -= pad;
  north += pad;
  const minSpan = 6;
  if (east - west < minSpan) {
    const center = (east + west) / 2;
    west = center - minSpan / 2;
    east = center + minSpan / 2;
  }
  if (north - south < minSpan) {
    const center = (north + south) / 2;
    south = center - minSpan / 2;
    north = center + minSpan / 2;
  }
  return { west, east, south, north };
}

/**
 * Whether the selection is already the newest fix.
 *
 * `-1` means "nothing was picked by hand", which the view renders as the latest
 * point; picking the last point explicitly counts as current too. Used to decide
 * whether the "back to now" control is worth showing.
 */
export function isCurrentFix(selectedIndex, pointCount) {
  const count = toNumber(pointCount);
  if (count === null || count <= 0) return true;
  const index = toNumber(selectedIndex);
  if (index === null) return true;
  return index < 0 || index >= count - 1;
}

/**
 * One track point reduced to the values the UI shows.
 *
 * Kept here (not in the view) so the click handler, the floating card and the
 * detail row cannot drift apart, and so the shape is covered by tests.
 */
export function describeTrackPoint(point, lang) {
  if (!point) return null;
  const level = describeTyphoonIntensity(point.intensity, lang);
  const lat = toNumber(point.lat);
  const lon = toNumber(point.lon);
  return {
    time: point.timeText || point.timeLabel || '',
    intensity: level.label,
    intensityCode: level.code,
    color: level.color,
    lat,
    lon,
    position: lat !== null && lon !== null ? `${lat.toFixed(1)}°N ${lon.toFixed(1)}°E` : '—',
    pressure: toNumber(point.pressure),
    wind: toNumber(point.wind),
    moveDirection: point.moveDirection || '',
    moveSpeed: toNumber(point.moveSpeed)
  };
}

/** Highest intensity reached so far, for the summary line. */
export function peakIntensity(detail) {
  if (!detail || !Array.isArray(detail.points)) return describeTyphoonIntensity('', 'zh');
  let best = TYPHOON_LEVEL_FALLBACK;
  for (const point of detail.points) {
    const level = TYPHOON_LEVELS.find(item => item.code === point.intensity);
    if (level && level.rank > best.rank) best = level;
  }
  return best.code ? { code: best.code, rank: best.rank, color: best.color, label: best.zh } : describeTyphoonIntensity('', 'zh');
}
