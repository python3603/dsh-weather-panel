/**
 * 中央气象台（nmc.cn）雷达拼图产品。
 *
 * 官方页面把帧清单写在 HTML 里，而该页面**没有 CORS 头**，浏览器读不到；但产品图
 * 本身是静态 PNG，用 `<img>` 直接加载不需要 CORS。所以这里按官方命名规则生成候选
 * 时次，由视图层用图片 onerror 跳过还没发布的帧。
 *
 * 命名规则（2026-10 实测 nmc.cn/publish/radar/chinaall.html）：
 *   https://image.nmc.cn/product/YYYY/MM/DD/RDCP/[medium/]SEVP_AOC_RDCP_SLDAS3_ECREF_{code}_L88_PI_{stamp}00000.PNG
 *   · stamp 是 UTC 时间（yyyymmddhhmm），页面标签是北京时间（+8h）
 *   · 帧间隔 6 分钟；全国拼图保留约 24 小时（240 帧），分区约 2 小时
 *   · 只有全国拼图放在 medium/ 目录
 */

import { isNumber } from './format.js';

export const RADAR_FRAME_MINUTES = 6;
export const RADAR_IMAGE_BASE = 'https://image.nmc.cn/product';
export const RADAR_PAGE_BASE = 'https://www.nmc.cn/publish/radar/';

/** 与 nmc.cn 左栏一致的 8 个区域产品。 */
export const RADAR_PRODUCTS = [
  { id: 'chinaall', code: 'ACHN', zh: '全国雷达拼图', en: 'Nationwide composite', frames: 240, medium: true },
  { id: 'huabei', code: 'ANCN', zh: '华北', en: 'North China', frames: 20, medium: false },
  { id: 'dongbei', code: 'ANEC', zh: '东北', en: 'Northeast China', frames: 20, medium: false },
  { id: 'huadong', code: 'AECN', zh: '华东', en: 'East China', frames: 20, medium: false },
  { id: 'huazhong', code: 'ACCN', zh: '华中', en: 'Central China', frames: 20, medium: false },
  { id: 'huanan', code: 'ASCN', zh: '华南', en: 'South China', frames: 20, medium: false },
  { id: 'xinan', code: 'ASWC', zh: '西南', en: 'Southwest China', frames: 20, medium: false },
  { id: 'xibei', code: 'ANWC', zh: '西北', en: 'Northwest China', frames: 20, medium: false }
];

export function radarProduct(id) {
  return RADAR_PRODUCTS.find(item => item.id === id) || RADAR_PRODUCTS[0];
}

export function radarProductName(product, lang) {
  if (!product) return '';
  return lang === 'en' ? product.en : product.zh;
}

/** UTC 时间戳（`yyyymmddhhmm`），按 6 分钟对齐。 */
export function radarStampAt(ms) {
  const date = new Date(ms);
  const pad = value => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`
    + `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}`;
}

/**
 * 从「最近可用的 6 分钟整点」往回数，生成 count 个候选时次。
 * 第一项是最新的，序号越大越早，和视图里的滑块方向一致。
 */
export function radarStamps(nowMs, count, stepMinutes) {
  const step = Math.max(1, Math.round(isNumber(stepMinutes) ? stepMinutes : RADAR_FRAME_MINUTES)) * 60000;
  const total = Math.max(1, Math.min(240, Math.round(isNumber(count) ? count : 1)));
  const now = isNumber(nowMs) ? nowMs : Date.now();
  const base = Math.floor(now / step) * step;
  const stamps = [];
  for (let index = 0; index < total; index += 1) {
    stamps.push(radarStampAt(base - index * step));
  }
  return stamps;
}

export function radarImageUrl(product, stamp) {
  if (!product || !stamp) return '';
  const year = stamp.slice(0, 4);
  const month = stamp.slice(4, 6);
  const day = stamp.slice(6, 8);
  const segment = product.medium ? 'medium/' : '';
  return `${RADAR_IMAGE_BASE}/${year}/${month}/${day}/RDCP/${segment}`
    + `SEVP_AOC_RDCP_SLDAS3_ECREF_${product.code}_L88_PI_${stamp}00000.PNG`;
}

/** 文件名是 UTC，nmc.cn 的页面标签是北京时间。 */
export function radarBeijingParts(stamp) {
  if (!stamp || stamp.length < 12) return null;
  const ms = Date.UTC(
    Number(stamp.slice(0, 4)),
    Number(stamp.slice(4, 6)) - 1,
    Number(stamp.slice(6, 8)),
    Number(stamp.slice(8, 10)),
    Number(stamp.slice(10, 12))
  );
  if (!Number.isFinite(ms)) return null;
  const date = new Date(ms + 8 * 3600 * 1000);
  const pad = value => String(value).padStart(2, '0');
  return {
    day: `${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())}`,
    clock: `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`,
    minutes: date.getUTCHours() * 60 + date.getUTCMinutes()
  };
}

export function formatRadarStamp(stamp, lang) {
  const parts = radarBeijingParts(stamp);
  if (!parts) return '';
  return lang === 'en' ? `${parts.clock} BJT · ${parts.day}` : `${parts.day} ${parts.clock}`;
}

export function radarPageUrl(product) {
  const id = product ? product.id : RADAR_PRODUCTS[0].id;
  return `${RADAR_PAGE_BASE}${id}.html`;
}
