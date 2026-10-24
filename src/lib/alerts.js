/**
 * 中央气象台（中国气象局）预警信号。
 *
 * 数据源：`https://www.nmc.cn/rest/findAlarm`，实测返回 `Access-Control-Allow-Origin: *`，
 * 因此浏览器可直接读取，不需要 Host 代理。返回的是**全国**当前有效预警（按发布时间倒序），
 * 每页最多 100 条；本模块负责翻页、把标题解析成「类型 + 等级」，并按用户所在地过滤。
 *
 * 标题格式固定为：`<省><市>气象台发布<类型><等级>预警信号`，例如
 * `内蒙古自治区呼伦贝尔市气象台发布大风蓝色预警信号`。
 * 因此「类型/等级」从标题解析比额外请求详情页可靠：详情页 `publish/alarm/*.html` 不带 CORS。
 */

import { alertGuide } from './alert-guides.js';

export const ALARM_ENDPOINT = 'https://www.nmc.cn/rest/findAlarm';
export const ALARM_PAGE_SIZE = 100;
export const ALARM_MAX_PAGES = 5;

/**
 * 等级从低到高；rank 用于排序与「最高等级」判断。
 * grade / severity 采自官方发布口径（Ⅳ级一般、Ⅲ级较重、Ⅱ级严重、Ⅰ级特别严重），
 * color 只用于界面，不参与解析。
 */
export const ALERT_LEVELS = [
  { key: 'blue', zh: '蓝色', en: 'Blue', rank: 1, grade: 'Ⅳ级', gradeEn: 'Grade IV', severity: '一般', severityEn: 'general', color: '#3b82f6' },
  { key: 'yellow', zh: '黄色', en: 'Yellow', rank: 2, grade: 'Ⅲ级', gradeEn: 'Grade III', severity: '较重', severityEn: 'fairly serious', color: '#eab308' },
  { key: 'orange', zh: '橙色', en: 'Orange', rank: 3, grade: 'Ⅱ级', gradeEn: 'Grade II', severity: '严重', severityEn: 'serious', color: '#f97316' },
  { key: 'red', zh: '红色', en: 'Red', rank: 4, grade: 'Ⅰ级', gradeEn: 'Grade I', severity: '特别严重', severityEn: 'especially serious', color: '#dc2626' }
];

/** 设置里每个等级的两项开关默认值。 */
export const DEFAULT_ALERT_NOTICE = { blue: false, yellow: true, orange: true, red: true };
export const DEFAULT_ALERT_STRONG = { blue: false, yellow: false, orange: true, red: true };

/** 常见预警类型；只用于中英互译与顺序，不限制解析。 */
export const ALERT_TYPES = [
  { zh: '台风', en: 'Typhoon' },
  { zh: '暴雨', en: 'Rainstorm' },
  { zh: '暴雪', en: 'Snowstorm' },
  { zh: '寒潮', en: 'Cold wave' },
  { zh: '大风', en: 'Gale' },
  { zh: '沙尘暴', en: 'Sandstorm' },
  { zh: '高温', en: 'Heat' },
  { zh: '干旱', en: 'Drought' },
  { zh: '雷电', en: 'Lightning' },
  { zh: '冰雹', en: 'Hail' },
  { zh: '霜冻', en: 'Frost' },
  { zh: '大雾', en: 'Dense fog' },
  { zh: '霾', en: 'Haze' },
  { zh: '道路结冰', en: 'Road icing' },
  { zh: '海上大风', en: 'Gale at sea' },
  { zh: '海浪', en: 'Wave' },
  { zh: '风暴潮', en: 'Storm surge' },
  { zh: '森林火险', en: 'Forest fire risk' },
  { zh: '强对流', en: 'Severe convection' },
  { zh: '低温', en: 'Low temperature' }
];

/**
 * 预警类型图标（emoji，纯展示，不参与解析）。
 * 未收录的类型统一用 ⚠️，保证任何类型都有可见标识。
 */
export const ALERT_TYPE_ICONS = {
  台风: '🌀',
  暴雨: '🌧️',
  暴雪: '❄️',
  寒潮: '🥶',
  大风: '💨',
  沙尘暴: '🌪️',
  沙尘: '🌪️',
  高温: '🌡️',
  干旱: '🌵',
  雷电: '⚡',
  雷雨大风: '⛈️',
  冰雹: '🧊',
  霜冻: '🧊',
  大雾: '🌫️',
  霾: '😷',
  道路结冰: '⛸️',
  海上大风: '🌊',
  海浪: '🌊',
  风暴潮: '🌊',
  森林火险: '🔥',
  强对流: '⛈️',
  低温: '🥶',
  地质灾害: '⛰️',
  渍涝: '💧'
};

export const ALERT_TYPE_FALLBACK_ICON = '⚠️';

export function alertTypeIcon(type) {
  const key = String(type || '').trim();
  return ALERT_TYPE_ICONS[key] || ALERT_TYPE_FALLBACK_ICON;
}

/** Build one page URL; `pageSize` is capped by the service at 100. */
export function buildAlarmPageUrl(pageNo, pageSize) {
  const page = Number.isFinite(pageNo) && pageNo > 0 ? Math.floor(pageNo) : 1;
  const size = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(100, Math.floor(pageSize)) : ALARM_PAGE_SIZE;
  return `${ALARM_ENDPOINT}?pageNo=${page}&pageSize=${size}`;
}

/** `2026/10/22 20:12` → epoch ms (treated as Asia/Shanghai wall clock). */
export function parseIssueTime(value) {
  const match = /^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/.exec(String(value || '').trim());
  if (!match) return null;
  const utc = Date.UTC(
    Number(match[1]), Number(match[2]) - 1, Number(match[3]),
    Number(match[4]) - 8, Number(match[5])
  );
  return Number.isFinite(utc) ? utc : null;
}

/** Parse `…发布大风蓝色预警信号` into structured fields. */
export function parseAlertTitle(title) {
  const text = String(title || '');
  const level = ALERT_LEVELS.find(item => text.includes(`${item.zh}`)) || null;
  const ordered = ALERT_TYPES.slice().sort((left, right) => right.zh.length - left.zh.length);
  let typeZh = '';
  for (const candidate of ordered) {
    if (text.includes(`${candidate.zh}${level ? level.zh : ''}`)) {
      typeZh = candidate.zh;
      break;
    }
  }
  if (!typeZh && level) {
    const stripped = text.replace(/^.*?发布/, '').replace(new RegExp(`${level.zh}.*$`), '');
    typeZh = stripped.replace(/预警.*$/, '').trim();
  }
  const type = ALERT_TYPES.find(item => item.zh === typeZh) || { zh: typeZh, en: typeZh || 'Alert' };
  return {
    type: type.zh,
    typeEn: type.en,
    level: level ? level.key : '',
    levelZh: level ? level.zh : '',
    levelEn: level ? level.en : '',
    levelRank: level ? level.rank : 0,
    place: text.replace(/发布.*$/, '').replace(/气象台$/, '')
  };
}

/** Normalize one API entry; `null` for unusable rows. */
export function normalizeAlert(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title) return null;
  const id = typeof raw.alertid === 'string' && raw.alertid ? raw.alertid : title;
  const parsed = parseAlertTitle(title);
  const url = typeof raw.url === 'string' && raw.url ? `https://www.nmc.cn${raw.url.startsWith('/') ? '' : '/'}${raw.url}` : '';
  return {
    id,
    title,
    issuedAt: parseIssueTime(raw.issuetime),
    issuedText: typeof raw.issuetime === 'string' ? raw.issuetime : '',
    url,
    pic: typeof raw.pic === 'string' ? raw.pic : '',
    type: parsed.type,
    typeEn: parsed.typeEn,
    level: parsed.level,
    levelZh: parsed.levelZh,
    levelEn: parsed.levelEn,
    levelRank: parsed.levelRank,
    place: parsed.place
  };
}

/** Normalize a whole page payload. */
export function normalizeAlarmPage(payload) {
  const page = payload && payload.data && payload.data.page ? payload.data.page : null;
  const list = page && Array.isArray(page.list) ? page.list : [];
  const alerts = list.map(normalizeAlert).filter(Boolean);
  const totalPage = page && Number.isFinite(page.totalPage) ? page.totalPage : 1;
  return {
    alerts,
    count: page && Number.isFinite(page.count) ? page.count : alerts.length,
    pageNo: page && Number.isFinite(page.pageNo) ? page.pageNo : 1,
    totalPage
  };
}

/** Short place name without administrative suffixes, for title matching. */
export function placeRoots(name) {
  const text = String(name || '').trim();
  if (!text) return [];
  const roots = new Set();
  roots.add(text);
  const stripped = text
    .replace(/特别行政区$|自治区$|自治州$|地区$|新区$|省$|市$|县$|区$|盟$|旗$/g, '')
    .trim();
  if (stripped) roots.add(stripped);
  return Array.from(roots).filter(root => root.length >= 2);
}

/**
 * Place names to look for in an alert title, most precise first.
 *
 * 区/县（district）> 市（city）> 省（region）：NMC 的标题写的是**发布台站**的全称
 * 路径（例如「浙江省舟山市岱山县气象台」），所以区县名能命中就说明这条预警
 * 精确到这个区县；只命中省名时降级为「省级区域预警」。
 */
export function locationPlaces(location) {
  if (!location) return [];
  const places = [];
  const push = (value, scope, weight) => {
    for (const root of placeRoots(value)) {
      if (!places.some(item => item.root === root && item.weight >= weight)) {
        places.push({ root, scope, weight });
      }
    }
  };
  push(location.district, 'district', 4);
  push(location.city, 'city', 3);
  // A manual pick stores `label` as "城市 · 省/州"; both halves are worth matching.
  if (location.label) {
    String(location.label).split(/[·,，\/]/).map(part => part.trim()).filter(Boolean)
      .forEach(part => push(part, 'city', 2));
  }
  push(location.region, 'region', 1);
  return places;
}

/** The issuing station, i.e. the part before 发布 / 气象台 in a title. */
export function alertStation(title) {
  const text = String(title || '');
  const cut = text.indexOf('气象台');
  return cut > 0 ? text.slice(0, cut) : '';
}

const SCOPE_ORDER = { district: 0, city: 1, region: 2, other: 3 };

/**
 * Which administrative level one alert actually speaks for.
 *
 * NMC titles name the issuing station in full (`浙江省舟山市岱山县气象台`), so the
 * station string tells us the granularity:
 *   - it contains the user's own district/county → `district` (exactly this place)
 *   - it ends at the user's city (`…市气象台`)  → `city` (the whole city)
 *   - it names a *different* district of the same city → `other`, dropped when we
 *     know the user's district, because a 崇明区 warning is not a 徐汇区 warning
 *   - only the province matches                 → `region`
 */
export function alertScopeFor(title, location) {
  const station = alertStation(title);
  if (!station || !location) return null;
  const districtRoots = placeRoots(location.district);
  const cityRoots = placeRoots(location.city);
  const regionRoots = placeRoots(location.region);
  for (const root of districtRoots) {
    if (station.includes(root)) return { scope: 'district', weight: 5, matchedOn: root };
  }
  for (const root of cityRoots) {
    if (station.endsWith(root)) return { scope: 'city', weight: 4, matchedOn: root };
  }
  const cityHit = cityRoots.find(root => station.includes(root));
  if (cityHit) {
    // Same city, another district: informational only when we know the district.
    return location.district
      ? { scope: 'other', weight: 1, matchedOn: cityHit }
      : { scope: 'city', weight: 2, matchedOn: cityHit };
  }
  // A province-level hit must be the province itself (省气象台 / 省自然资源厅 …),
  // not another city's station that merely sits inside the same province.
  const provinceDept = /(气象台|厅|局|中心)$/.test(station);
  for (const root of regionRoots) {
    if (!station.includes(root)) continue;
    if (station.endsWith(root) || provinceDept) return { scope: 'region', weight: 3, matchedOn: root };
  }
  // Somewhere else entirely: not this place's warning at all.
  return null;
}

/**
 * Keep the alerts that cover this place, most precise first.
 *
 * `scope: 'other'` rows are the same city's *other* districts: they stay in the
 * list (the tab shows them as a separate "参考" group) but never raise a notice,
 * because a 崇明区 warning is not a 徐汇区 warning.
 */
export function matchAlerts(alerts, location) {
  if (!Array.isArray(alerts) || alerts.length === 0) return [];
  const matched = [];
  for (const alert of alerts) {
    const scope = alertScopeFor(alert.title, location);
    if (!scope) continue;
    matched.push({ ...alert, scope: scope.scope, matchedOn: scope.matchedOn });
  }
  return matched.sort((left, right) => {
    const leftScope = SCOPE_ORDER[left.scope] === undefined ? 9 : SCOPE_ORDER[left.scope];
    const rightScope = SCOPE_ORDER[right.scope] === undefined ? 9 : SCOPE_ORDER[right.scope];
    if (leftScope !== rightScope) return leftScope - rightScope;
    if (left.levelRank !== right.levelRank) return right.levelRank - left.levelRank;
    return (right.issuedAt || 0) - (left.issuedAt || 0);
  });
}

/** Level colour, shared by the list, the chips and the notice. */
export function alertLevelColor(level) {
  const meta = alertLevelMeta(level);
  return meta ? meta.color : '#6b7280';
}

/** `Ⅲ级 · 较重` / `Grade III · fairly serious`. */
export function alertGradeLabel(level, lang) {
  const meta = alertLevelMeta(level);
  if (!meta) return '';
  if (lang === 'en') return `${meta.gradeEn} · ${meta.severityEn}`;
  return `${meta.grade} · ${meta.severity}`;
}

/**
 * Drop the alerts whose level the user switched off.
 *
 * `levels` is the settings map `{blue, yellow, orange, red}`; a level missing
 * from the map (an unknown upstream level) never raises a notice.
 */
export function filterAlertsByLevels(alerts, levels) {
  if (!Array.isArray(alerts) || alerts.length === 0) return [];
  const map = levels || {};
  return alerts.filter(alert => map[alert.level] === true);
}

/** Counts per level, for the header summary. */
export function alertCountsByLevel(alerts) {
  const counts = { blue: 0, yellow: 0, orange: 0, red: 0 };
  if (Array.isArray(alerts)) {
    for (const alert of alerts) {
      if (counts[alert.level] !== undefined) counts[alert.level] += 1;
    }
  }
  return counts;
}

/**
 * Everything the detail panel shows for one alert.
 *
 * The description is a structured summary (who issued what, when, how serious)
 * plus the type's general guidance; the authoritative local wording lives on the
 * linked official page, which is why `url` is always part of the result.
 */
export function buildAlertDetail(alert, lang) {
  if (!alert) return null;
  const key = lang === 'en' ? 'en' : 'zh';
  const guide = alertGuide(alert.type)[key] || {};
  const meta = alertLevelMeta(alert.level);
  const levelLabel = lang === 'en' ? (alert.levelEn || '') : (alert.levelZh || '');
  const typeLabel = lang === 'en' ? (alert.typeEn || alert.type || '') : (alert.type || '');
  return {
    id: alert.id,
    title: alert.title,
    type: typeLabel,
    level: levelLabel,
    levelKey: alert.level || 'blue',
    color: meta ? meta.color : '#6b7280',
    grade: meta ? (lang === 'en' ? meta.gradeEn : meta.grade) : '',
    severity: meta ? (lang === 'en' ? meta.severityEn : meta.severity) : '',
    issuedText: alert.issuedText || '',
    issuedAt: alert.issuedAt || null,
    place: alert.place || '',
    scope: alert.scope || 'city',
    summary: guide.summary || '',
    bullets: Array.isArray(guide.bullets) ? guide.bullets : [],
    url: alert.url || 'https://www.nmc.cn/publish/alarm.html'
  };
}

/** Highest active level among the matched alerts (0 when none). */
export function highestAlertRank(alerts) {
  if (!Array.isArray(alerts) || alerts.length === 0) return 0;
  return alerts.reduce((max, alert) => Math.max(max, alert.levelRank || 0), 0);
}

/** Level metadata by key, for styling. */
export function alertLevelMeta(level) {
  return ALERT_LEVELS.find(item => item.key === level) || null;
}

/** A stable fingerprint of the alert set, used to detect new signals. */
export function alertSignature(alerts) {
  if (!Array.isArray(alerts) || alerts.length === 0) return '';
  return alerts.map(alert => alert.id).sort().join(',');
}
