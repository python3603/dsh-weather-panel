/**
 * 卫星云图数据源。
 *
 * 只接国内官方源：国家卫星气象中心（NSMC）。每个产品有一份 XML 清单
 * `https://img.nsmc.org.cn/PORTAL/NSMC/XML/<GROUP>/<NAME>.xml`，里面逐帧列
 * `<image time="…" url="//img.nsmc.org.cn/…">`；实测清单带
 * `Access-Control-Allow-Origin: *`，产品图本身也能直连。
 */

export const NSMC_MANIFEST_BASE = 'https://img.nsmc.org.cn/PORTAL/NSMC/XML/';

export const NSMC_PRODUCTS = [
  {
    id: 'FY4B_AGRI_IMG_REGI_PCC_GLL',
    xml: 'FY4B/FY4B_AGRI_IMG_REGI_PCC_GLL',
    zh: 'FY-4B · 中国区域 · 伪彩色',
    en: 'FY-4B China · pseudo colour',
    note: '每 15 分钟 · 约 415 KB/帧'
  },
  {
    id: 'FY4B_AGRI_IMG_REGI_GCLR_GLL',
    // 这个产品的清单挂在另一条路径上（不是 PORTAL/NSMC/XML），所以直接存完整地址。
    xml: 'https://img.nsmc.org.cn/CLOUDIMAGE/FY4B/AGRI/GCLR/SEC/xml/FY4B-china-72h.xml',
    zh: 'FY-4B · 中国区域 · 真彩色',
    en: 'FY-4B China · true colour',
    note: '72 小时回看 · 约 704 KB/帧'
  },
  {
    id: 'FY4B_AGRI_IMG_DISK_NATR_NOM',
    xml: 'FY4B/FY4B_AGRI_IMG_DISK_NATR_NOM',
    zh: 'FY-4B · 全圆盘 · 自然色',
    en: 'FY-4B full disk · natural colour',
    note: '每 15 分钟 · 约 342 KB/帧'
  },
  {
    id: 'FY4B_AGRI_IMG_DISK_THEMG_C13',
    xml: 'FY4B/FY4B_AGRI_IMG_DISK_THEMG_C13',
    zh: 'FY-4B · 全圆盘 · 长波红外',
    en: 'FY-4B full disk · IR 10.8μm',
    note: '增强红外通道 13 · 约 863 KB/帧'
  },
  {
    id: 'FY2G_LAN_VIS_GRA',
    xml: 'FY2G/FY2G_LAN_VIS_GRA',
    zh: 'FY-2G · 中国区域 · 可见光',
    en: 'FY-2G China · visible',
    note: '每 30 分钟 · 约 120 KB/帧'
  },
  {
    id: 'GEOS_MOS_IRX_15min',
    xml: 'GEOS/GEOS_MOS_IRX_15KM_15min',
    zh: '全球红外云图 · 15 分钟',
    en: 'Global IR · 15-minute',
    note: '10.8μm 彩色合成 · 约 882 KB/帧'
  }
];

export function nsmcProduct(id) {
  return NSMC_PRODUCTS.find(item => item.id === id) || NSMC_PRODUCTS[0];
}

export function nsmcProductName(product, lang) {
  if (!product) return '';
  return lang === 'en' ? product.en : product.zh;
}

export function nsmcManifestUrl(product) {
  const entry = nsmcProduct(product && product.id ? product.id : undefined);
  // 个别产品的清单不在 PORTAL/NSMC/XML 下，注册表里直接存了完整地址。
  return /^https?:/i.test(entry.xml) ? entry.xml : `${NSMC_MANIFEST_BASE}${entry.xml}.xml`;
}

/** XML → [{ time, url }]，最新的在前。解析保持宽松，任何一条坏记录都不影响其它帧。 */
export function parseNsmcManifest(xml) {
  const text = String(xml || '');
  const frames = [];
  const pattern = /<image\b[^>]*?\btime="([^"]+)"[^>]*?\burl="([^"]+)"/g;
  let match = pattern.exec(text);
  while (match) {
    const rawUrl = match[2].startsWith('//') ? `https:${match[2]}` : match[2];
    if (rawUrl) frames.push({ time: match[1], url: rawUrl });
    match = pattern.exec(text);
  }
  // 清单本身就是按时间倒序给的，这里再排一次保证顺序稳定。
  frames.sort((left, right) => (left.time < right.time ? 1 : left.time > right.time ? -1 : 0));
  return frames;
}

/** NSMC 的 `<image time>` 是 UTC 文本（`2026-10-23 11:00 (UTC)`），界面上用北京时间。 */
export function nsmcTimeParts(text) {
  const match = /(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/.exec(String(text || ''));
  if (!match) return null;
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
  if (!Number.isFinite(ms)) return null;
  const beijing = new Date(ms + 8 * 3600 * 1000);
  const pad = value => String(value).padStart(2, '0');
  return {
    day: `${pad(beijing.getUTCMonth() + 1)}/${pad(beijing.getUTCDate())}`,
    clock: `${pad(beijing.getUTCHours())}:${pad(beijing.getUTCMinutes())}`
  };
}

export function formatNsmcTime(text, lang) {
  const parts = nsmcTimeParts(text);
  if (!parts) return String(text || '');
  return lang === 'en' ? `${parts.clock} BJT · ${parts.day}` : `${parts.day} ${parts.clock}`;
}
