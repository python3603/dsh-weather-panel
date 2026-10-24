import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DISTRICT_ALIASES,
  districtVariants,
  searchDistricts
} from '../src/lib/districts.js';

/**
 * 这份索引是手动搜索能落到区县的唯一保证（Open-Meteo 对「徐汇区」这类查询返回 0 条），
 * 所以测试直接断言真实数据里的几个例子。
 */

test('district search finds county-level names with their parent city', () => {
  const hits = searchDistricts('徐汇区', { limit: 3 });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].name, '徐汇区');
  assert.equal(hits[0].city, '上海市');
  assert.equal(hits[0].district, '徐汇区');
  assert.equal(hits[0].region, '上海市');
  assert.equal(hits[0].subtitle, '上海市 · 上海市');
  assert.equal(hits[0].featureCode, 'ADM3');
  assert.ok(Number.isFinite(hits[0].lat) && Number.isFinite(hits[0].lon));
});

test('a bare prefix still finds the district', () => {
  const hits = searchDistricts('徐汇', { limit: 3 });
  assert.equal(hits[0].name, '徐汇区');
  assert.equal(hits[0].city, '上海市');
});

test('same-named districts in different cities are both returned', () => {
  const hits = searchDistricts('朝阳区', { limit: 5 });
  const cities = hits.map(hit => hit.city);
  assert.ok(cities.includes('北京市'));
  assert.ok(cities.includes('长春市'));
  assert.equal(new Set(hits.map(hit => `${hit.city}/${hit.name}`)).size, hits.length);
});

test('aliases cover renamed districts that the snapshot still lacks', () => {
  const hits = searchDistricts('两江新区', { limit: 2 });
  assert.equal(hits[0].name, '渝北区');
  assert.equal(DISTRICT_ALIASES['两江新区'], '渝北区');
  assert.deepEqual(districtVariants('徐汇区').sort(), ['徐汇', '徐汇区'].sort());
});

test('a city name still resolves, ranked behind exact district names', () => {
  const hits = searchDistricts('上海', { limit: 5 });
  assert.equal(hits[0].name, '上海市');
  assert.equal(hits[0].featureCode, 'ADM2');
  assert.equal(hits[0].district, '');
});

test('non-Chinese or empty queries stay out of the bundled index', () => {
  assert.deepEqual(searchDistricts('', {}), []);
  assert.deepEqual(searchDistricts('Tokyo', {}), []);
  assert.deepEqual(searchDistricts('   ', {}), []);
});
