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

export const ALARM_ENDPOINT = 'https://www.nmc.cn/rest/findAlarm';
export const ALARM_PAGE_SIZE = 100;
export const ALARM_MAX_PAGES = 3;

/** 等级从低到高；rank 用于排序与「最高等级」判断。 */
export const ALERT_LEVELS = [
  { key: 'blue', zh: '蓝色', en: 'Blue', rank: 1 },
  { key: 'yellow', zh: '黄色', en: 'Yellow', rank: 2 },
  { key: 'orange', zh: '橙色', en: 'Orange', rank: 3 },
  { key: 'red', zh: '红色', en: 'Red', rank: 4 }
];

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
 * Keep the alerts that plausibly cover this place.
 *
 * City-level hits win; when a city has none, province-level signals are kept but
 * marked `scope: 'region'` so the UI can say they are regional.
 */
export function matchAlerts(alerts, location) {
  if (!Array.isArray(alerts) || alerts.length === 0) return [];
  const cityRoots = placeRoots(location && location.city);
  const regionRoots = placeRoots(location && location.region);
  const matched = [];
  for (const alert of alerts) {
    const title = alert.title;
    const cityHit = cityRoots.some(root => title.includes(root));
    if (cityHit) {
      matched.push({ ...alert, scope: 'city' });
      continue;
    }
    const regionHit = regionRoots.some(root => title.includes(root));
    if (regionHit) matched.push({ ...alert, scope: 'region' });
  }
  return matched.sort((left, right) => {
    if (left.scope !== right.scope) return left.scope === 'city' ? -1 : 1;
    if (left.levelRank !== right.levelRank) return right.levelRank - left.levelRank;
    return (right.issuedAt || 0) - (left.issuedAt || 0);
  });
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
