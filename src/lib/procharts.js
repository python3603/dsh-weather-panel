/**
 * 专业栏数据：来自社区站点 easterlywave.com 的静态产品图。
 *
 * 站点本身是 React SPA，数据接口（`POST /action/model/status`、`/action/typhoon/sst`）
 * 需要 cookie + CSRF 且**没有 CORS 头**，浏览器里调不到；但产品图是纯静态 PNG：
 *   · 海表温度  `/media/typhoon/sst/{YYYYMMDD}/{region}.png`（按日）
 *   · ECMWF 图  `/media/model/ecmwf/{YYYYMMDDHH}/{code}_{region}_{hour}.png`
 * 所以这里只做「按命名规则拼 URL + 用图片 onerror 回退」，不碰它的接口。
 */

import { isNumber } from './format.js';

export const EW_BASE = 'https://www.easterlywave.com';
export const EW_SST_PAGE = `${EW_BASE}/typhoon/sst/`;
export function ewModelPage(codeId) {
  return `${EW_BASE}/model/ecmwf/china/${String(codeId || 'gpt').toLowerCase()}/`;
}

export const SST_REGIONS = [
  { id: 'wpac', zh: '西北太平洋', en: 'Western Pacific' },
  { id: 'eastasia', zh: '东亚', en: 'East Asia' },
  { id: 'micronesia', zh: '密克罗尼西亚', en: 'Micronesia' },
  { id: 'natl', zh: '北大西洋', en: 'North Atlantic' },
  { id: 'epac', zh: '东太平洋', en: 'Eastern Pacific' },
  { id: 'nio', zh: '北印度洋', en: 'N. Indian Ocean' },
  { id: 'sio', zh: '南印度洋', en: 'S. Indian Ocean' },
  { id: 'aus', zh: '南太平洋', en: 'Southern Pacific' }
];

export const SST_DAYS = 15;

export function sstRegion(id) {
  return SST_REGIONS.find(item => item.id === id) || SST_REGIONS[0];
}

export function sstRegionName(region, lang) {
  if (!region) return '';
  return lang === 'en' ? region.en : region.zh;
}

/** 日频海温的日期戳（`YYYYMMDD`，UTC 日），offset = 几天前。 */
export function sstStamp(offset, nowMs) {
  const days = Math.max(0, Math.round(isNumber(offset) ? offset : 0));
  const date = new Date((isNumber(nowMs) ? nowMs : Date.now()) - days * 86400000);
  const pad = value => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

export function sstImageUrl(regionId, stamp) {
  const region = sstRegion(regionId);
  return `${EW_BASE}/media/typhoon/sst/${stamp}/${region.id}.png`;
}

export function sstLabel(stamp) {
  if (!stamp || stamp.length < 8) return '';
  return `${stamp.slice(4, 6)}/${stamp.slice(6, 8)}`;
}

export const ECMWF_CODES = [
  { id: 'GPT', zh: '850hPa 温度 + 500hPa 高度', en: '850hPa Temp & 500hPa Height' },
  { id: 'WNP', zh: '850hPa 风场 + 海平面气压', en: '850 hPa Wind & MSLP' },
  { id: 'TMA', zh: '850hPa 温度距平', en: '850mb Temp Anomaly' },
  { id: 'VOP', zh: '850hPa 涡度', en: '850mb Vorticity' }
];

export const ECMWF_HOURS = [0, 24, 48, 72, 96, 120, 144, 168, 192, 216, 240];

export function ecmwfCode(id) {
  return ECMWF_CODES.find(item => item.id === id) || ECMWF_CODES[0];
}

export function ecmwfCodeName(code, lang) {
  if (!code) return '';
  return lang === 'en' ? code.en : code.zh;
}

/**
 * 候选起报时次（UTC 00Z / 12Z），从最新往回排：今天 12Z → 今天 00Z →
 * 昨天 12Z → 昨天 00Z。新时次还没出图时靠图片 onerror 往后回退。
 */
export function ecmwfRuns(nowMs) {
  const now = isNumber(nowMs) ? nowMs : Date.now();
  const date = new Date(now);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const pad = value => String(value).padStart(2, '0');
  const stamp = (offsetDays, hour) => {
    const d = new Date(Date.UTC(year, month, day - offsetDays, hour));
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}`;
  };
  const hours = date.getUTCHours();
  const runs = [];
  if (hours >= 12) runs.push(stamp(0, 12));
  runs.push(stamp(0, 0));
  runs.push(stamp(1, 12));
  runs.push(stamp(1, 0));
  return runs;
}

export function ecmwfImageUrl(codeId, run, hour) {
  const code = ecmwfCode(codeId);
  const h = Math.min(240, Math.max(0, Math.round(isNumber(hour) ? hour : 0)));
  return `${EW_BASE}/media/model/ecmwf/${run}/${code.id.toLowerCase()}_china_${h}.png`;
}

/** `2026102312` → 北京时间 `10/23 20时`。 */
export function ecmwfRunLabel(run) {
  if (!run || run.length < 10) return '';
  const date = new Date(Date.UTC(
    Number(run.slice(0, 4)),
    Number(run.slice(4, 6)) - 1,
    Number(run.slice(6, 8)),
    Number(run.slice(8, 10))
  ));
  const beijing = new Date(date.getTime() + 8 * 3600 * 1000);
  const pad = value => String(value).padStart(2, '0');
  return `${pad(beijing.getUTCMonth() + 1)}/${pad(beijing.getUTCDate())} ${pad(beijing.getUTCHours())}时`;
}
