/**
 * Generate `src/lib/districts-data.js` from the GeoNames China dump.
 *
 * Usage:
 *   node scripts/gen-districts.mjs <path-to-CN.txt>
 *
 * Get CN.txt from https://download.geonames.org/export/dump/CN.zip (CC BY 4.0)
 * and unzip it first. The output is committed; this script is only run when the
 * index needs refreshing, never at build or install time.
 *
 * Rules (see docs/regenerating-districts.md):
 *   - only feature class A, codes ADM1 / ADM2 / ADM3
 *   - Chinese name from `alternatenames`, preferring a short name with an
 *     administrative suffix ("青岛市" rather than "青")
 *   - coordinates rounded to two decimals (~1 km), enough for a picker
 *   - provinces are collected first: the file is ordered by geonameid, so an
 *     ADM2 row can appear before its ADM1 and would otherwise lose its parent
 */

import { createReadStream, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const input = process.argv[2];
if (!input) {
  console.error('usage: node scripts/gen-districts.mjs <path-to-CN.txt>');
  process.exit(1);
}

const CJK = /[\u4e00-\u9fff]/;
const SUFFIX = /(特别行政区|自治区|自治州|自治县|新区|地区|省|市|区|县|旗|盟|州)$/;

function zhName(alternates, fallback) {
  const tokens = String(alternates || '').split(',').map(token => token.trim()).filter(token => token && CJK.test(token));
  if (tokens.length === 0) return '';
  const withSuffix = tokens.filter(token => SUFFIX.test(token) && token.length <= 12);
  const pool = withSuffix.length ? withSuffix : tokens.filter(token => token.length <= 12);
  pool.sort((left, right) => left.length - right.length);
  return pool[0] || tokens[0] || fallback;
}

const provinces = [];
const provinceByA1 = new Map();
const rows = [];

const reader = createInterface({ input: createReadStream(input, 'utf8'), crlfDelay: Infinity });
for await (const line of reader) {
  const fields = line.split('\t');
  if (fields[6] !== 'A') continue;
  if (fields[7] !== 'ADM1') {
    rows.push(fields);
    continue;
  }
  const name = zhName(fields[3], fields[1]);
  const lat = Number(fields[4]);
  const lon = Number(fields[5]);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  if (provinceByA1.has(fields[10])) continue;
  provinceByA1.set(fields[10], provinces.length);
  provinces.push([name, Number(lat.toFixed(2)), Number(lon.toFixed(2))]);
}

const cities = [];
const cityByKey = new Map();
const pendingDistricts = [];
for (const fields of rows) {
  const name = zhName(fields[3], fields[1]);
  const lat = Number(fields[4]);
  const lon = Number(fields[5]);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  const a1 = fields[10];
  const a2 = fields[11];
  if (fields[7] === 'ADM2') {
    const key = `${a1}.${a2}`;
    if (cityByKey.has(key)) continue;
    cityByKey.set(key, cities.length);
    cities.push([name, provinceByA1.get(a1) ?? -1, Number(lat.toFixed(2)), Number(lon.toFixed(2))]);
  } else if (fields[7] === 'ADM3') {
    pendingDistricts.push([name, Number(lat.toFixed(2)), Number(lon.toFixed(2)), a1, a2]);
  }
}

const districts = [];
for (const [name, lat, lon, a1, a2] of pendingDistricts) {
  const cityIndex = cityByKey.has(`${a1}.${a2}`) ? cityByKey.get(`${a1}.${a2}`) : (provinceByA1.get(a1) ?? -1);
  districts.push([name, lat, lon, cityIndex]);
}

const output = `/**
 * 中国行政区索引（省级 / 地级 / 区县级，含坐标）。
 *
 * 数据来源：GeoNames（CC BY 4.0），取其中国区 ADM1/ADM2/ADM3 行政单元。
 * 由 scripts/gen-districts.mjs 生成、结果提交进仓库，运行时零网络、零第三方依赖。
 * 坐标为行政中心点，保留两位小数（约 1 km）。详见 docs/regenerating-districts.md。
 */

export const CN_PROVINCES = ${JSON.stringify(provinces)};

export const CN_CITIES = ${JSON.stringify(cities)};

export const CN_DISTRICTS = ${JSON.stringify(districts)};
`;

writeFileSync('src/lib/districts-data.js', output);
console.log(`provinces ${provinces.length} / cities ${cities.length} / districts ${districts.length}`);
console.log(`wrote src/lib/districts-data.js (${(Buffer.byteLength(output) / 1024).toFixed(1)} KiB)`);
