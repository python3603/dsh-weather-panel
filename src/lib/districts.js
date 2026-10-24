/**
 * 区县级行政区搜索（内置索引，不联网）。
 *
 * 为什么内置：Open-Meteo 的地理编码用的是 GeoNames 的「城市」子集，实测
 * 「徐汇区 / 浦东新区 / 静安区 / 岱山县」全部返回 0 条，而 Nominatim 在本机
 * 和大陆网络下都连不上。要让手动搜索真正落到区县，只能自带一份索引。
 *
 * 数据：GeoNames（CC BY 4.0）中国 ADM1/ADM2/ADM3 行政单元，构建期生成
 * `districts-data.js`（约 100 KiB，2895 个区县 + 360 个地级市 + 31 个省级），
 * 坐标为行政中心点、保留两位小数（约 1 km），对「选城市」这个用途足够。
 */

import { CN_CITIES, CN_DISTRICTS, CN_PROVINCES } from './districts-data.js';

const CJK = /[\u4e00-\u9fff]/;
const SUFFIXES = /(特别行政区|自治区|自治州|自治县|新区|地区|省|市|区|县|旗|盟|州)$/;
const DISTRICT_SUFFIX = /[区县旗]$/;

/**
 * 更名 / 俗名 → 现行区县名。
 *
 * GeoNames 是一份快照，个别行政区后来改名或被撤并（例如两江新区成立后新区名不在
 * 索引里），这里补几条常用别名。
 */
export const DISTRICT_ALIASES = {
  西海岸新区: '黄岛区',
  青岛西海岸新区: '黄岛区',
  胶南: '黄岛区',
  胶南市: '黄岛区',
  两江新区: '渝北区'
};

function stripSuffix(text) {
  return String(text || '').replace(SUFFIXES, '');
}

/** 一次查询的所有写法：原名、去后缀、别名。 */
export function districtVariants(query) {
  const raw = String(query || '').trim();
  if (!raw) return [];
  const out = new Set([raw]);
  const stripped = stripSuffix(raw);
  if (stripped && stripped !== raw) out.add(stripped);
  const alias = DISTRICT_ALIASES[raw];
  if (alias) {
    out.add(alias);
    const aliasStripped = stripSuffix(alias);
    if (aliasStripped) out.add(aliasStripped);
  }
  return Array.from(out);
}

function cityName(index) {
  const city = CN_CITIES[index];
  if (!city) return '';
  return city[0];
}

function provinceName(index) {
  const province = CN_PROVINCES[index];
  return province ? province[0] : '';
}

function provinceOfCity(index) {
  const city = CN_CITIES[index];
  return city && city[1] >= 0 ? provinceName(city[1]) : '';
}

/**
 * Score one name against the variants; higher wins, `0` = no match.
 *
 * 精确命中 > 以查询开头 > 包含查询，长度差越小越靠前，这样「徐汇」既能命中
 * 「徐汇区」，也不会让更长的名字抢到前面。
 */
function scoreName(name, variants) {
  let best = 0;
  for (const variant of variants) {
    if (!variant) continue;
    if (name === variant) best = Math.max(best, 120);
    else if (name.startsWith(variant)) best = Math.max(best, 100 - (name.length - variant.length));
    else if (name.includes(variant)) best = Math.max(best, 60 - name.indexOf(variant));
  }
  return best;
}

/**
 * Search the bundled index.
 *
 * @param {string} query 用户输入（只处理中文；英文交给 Open-Meteo）
 * @param {{lang?: string, limit?: number}} [options]
 * @returns {Array<object>} picker 形状的命中项，区县在前、城市在后
 */
export function searchDistricts(query, options) {
  const settings = options || {};
  const lang = settings.lang === 'en' ? 'en' : 'zh';
  const limit = Number.isFinite(settings.limit) ? Math.max(1, Math.floor(settings.limit)) : 6;
  const raw = String(query || '').trim();
  if (!raw || !CJK.test(raw)) return [];
  const variants = districtVariants(raw);
  if (variants.length === 0) return [];

  const hits = [];
  for (let index = 0; index < CN_DISTRICTS.length; index += 1) {
    const [name, lat, lon, cityIndex] = CN_DISTRICTS[index];
    const score = scoreName(name, variants);
    if (score <= 0) continue;
    const city = cityName(cityIndex);
    const province = provinceOfCity(cityIndex);
    hits.push({
      score,
      kind: 'district',
      id: `cn-d-${cityIndex}-${index}`,
      name,
      region: province,
      subtitle: [city, province].filter(Boolean).join(' · '),
      country: lang === 'en' ? 'China' : '中国',
      countryCode: 'CN',
      city: city || provinceOfCity(cityIndex),
      district: name,
      featureCode: 'ADM3',
      source: 'district',
      lat,
      lon
    });
  }

  // 市级命中作为兜底：输入恰好是城市名时也能选中，且比区县略靠后。
  for (let index = 0; index < CN_CITIES.length; index += 1) {
    const [name, provinceIndex, lat, lon] = CN_CITIES[index];
    const score = scoreName(name, variants);
    if (score <= 0) continue;
    hits.push({
      score: score - 10,
      kind: 'city',
      id: `cn-c-${index}`,
      name,
      region: provinceName(provinceIndex),
      subtitle: provinceName(provinceIndex),
      country: lang === 'en' ? 'China' : '中国',
      countryCode: 'CN',
      city: name,
      district: '',
      featureCode: 'ADM2',
      source: 'district',
      lat,
      lon
    });
  }

  hits.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    if (left.name.length !== right.name.length) return left.name.length - right.name.length;
    return left.name.localeCompare(right.name, 'zh');
  });

  // 同名区县（如朝阳区 ×2）都保留，靠 region 区分；完全相同的名字+坐标才去重。
  const seen = new Set();
  const out = [];
  for (const hit of hits) {
    const key = `${hit.name}|${hit.lat}|${hit.lon}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
    if (out.length >= limit) break;
  }
  return out;
}

/** True when the place name looks like a county/district (for UI tagging). */
export function looksLikeDistrict(name) {
  return DISTRICT_SUFFIX.test(String(name || ''));
}
