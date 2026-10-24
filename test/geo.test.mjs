import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GEO_PROVIDERS,
  localityLabel,
  lookupNetworkLocation,
  parseIpinfo,
  parseIpSb,
  parseIpWhoIs,
  reverseGeocode,
  searchCities
} from '../src/lib/geo.js';

const ipWhoIsPayload = {
  ip: '120.229.113.176',
  success: true,
  country: 'China',
  country_code: 'CN',
  region: 'Guangdong',
  city: 'Dongguan',
  latitude: 23.02,
  longitude: 113.75,
  timezone: { id: 'Asia/Shanghai' }
};

const ipinfoPayload = {
  ip: '120.229.113.176',
  city: 'Dongguan',
  region: 'Guangdong',
  country: 'CN',
  loc: '23.02,113.75',
  timezone: 'Asia/Shanghai'
};

const ipSbPayload = {
  ip: '120.229.113.176',
  country: 'China',
  country_code: 'CN',
  city: 'Dongguan',
  region: 'Guangdong',
  latitude: 23.02,
  longitude: 113.75,
  timezone: 'Asia/Shanghai'
};

test('the provider list is https-only and ordered by preference', () => {
  assert.ok(GEO_PROVIDERS.length >= 2);
  for (const provider of GEO_PROVIDERS) {
    assert.match(provider.url, /^https:\/\//, `${provider.id} must be https (mixed content is blocked)`);
    assert.equal(typeof provider.parse, 'function');
  }
});

test('each provider parser normalizes into the same shape', () => {
  const parsed = [
    parseIpWhoIs(ipWhoIsPayload),
    parseIpinfo(ipinfoPayload),
    parseIpSb(ipSbPayload)
  ];
  for (const location of parsed) {
    assert.equal(location.lat, 23.02);
    assert.equal(location.lon, 113.75);
    assert.equal(location.city, 'Dongguan');
    assert.equal(location.countryCode, 'CN');
    assert.equal(location.source, 'network');
  }
  assert.equal(parseIpWhoIs(ipWhoIsPayload).provider, 'ipwho.is');
  assert.equal(parseIpinfo(ipinfoPayload).provider, 'ipinfo.io');
});

test('parsers reject unusable payloads instead of guessing', () => {
  assert.equal(parseIpWhoIs({ success: false }), null);
  assert.equal(parseIpWhoIs(null), null);
  assert.equal(parseIpWhoIs({ latitude: 999, longitude: 0 }), null, 'latitude out of range');
  assert.equal(parseIpinfo({ ip: 'x' }), null, 'missing loc');
  assert.equal(parseIpinfo({ loc: 'a,b' }), null, 'unparsable loc');
  assert.equal(parseIpSb({}), null);
  assert.equal(parseIpSb({ ip: '1.2.3.4' }), null, 'no coordinates');
});

test('lookupNetworkLocation resolves with the first usable provider', async () => {
  const calls = [];
  const fetchJson = url => {
    calls.push(url);
    if (url === 'https://fast.invalid/') return Promise.resolve({ lat: 1, lon: 2 });
    return Promise.reject(new Error('nope'));
  };
  const providers = [
    { id: 'slow', url: 'https://slow.invalid/', parse: () => new Promise(() => {}) },
    { id: 'fast', url: 'https://fast.invalid/', parse: value => value }
  ];
  const found = await lookupNetworkLocation(fetchJson, { providers });
  assert.deepEqual(found, { lat: 1, lon: 2 });
  assert.ok(calls.length >= 1);
});

test('lookupNetworkLocation returns null when every provider fails', async () => {
  const fetchJson = () => Promise.reject(new Error('offline'));
  const found = await lookupNetworkLocation(fetchJson, { timeoutMs: 200 });
  assert.equal(found, null);
});

test('lookupNetworkLocation respects its own timeout', async () => {
  const fetchJson = () => new Promise(() => {});
  const started = Date.now();
  const found = await lookupNetworkLocation(fetchJson, { timeoutMs: 40 });
  assert.equal(found, null);
  assert.ok(Date.now() - started < 2000, 'must not hang');
});

test('lookupNetworkLocation honors an external abort', async () => {
  const controller = new AbortController();
  const fetchJson = () => new Promise(() => {});
  const pending = lookupNetworkLocation(fetchJson, { signal: controller.signal, timeoutMs: 5000 });
  controller.abort();
  assert.equal(await pending, null);
});

test('localityLabel prefers city + district and never repeats itself', () => {
  assert.equal(
    localityLabel({ city: '青岛市', locality: '黄岛区', principalSubdivision: '山东省', countryName: '中华人民共和国' }),
    '青岛市 · 黄岛区'
  );
  assert.equal(localityLabel({ city: '新加坡', locality: '新加坡' }), '新加坡');
  assert.equal(localityLabel({ principalSubdivision: '山东省' }), '山东省');
  assert.equal(localityLabel({}), '');
  assert.equal(localityLabel(null), '');
});

test('reverseGeocode asks for the requested locality language', async () => {
  const urls = [];
  const fetchJson = (url) => {
    urls.push(url);
    return Promise.resolve({ city: '青岛市', locality: '黄岛区', principalSubdivision: '山东省', countryCode: 'CN' });
  };
  const result = await reverseGeocode(fetchJson, 36.06, 120.38, { language: 'en' });
  assert.match(urls[0], /localityLanguage=en/);
  assert.equal(result.label, '青岛市 · 黄岛区');
  assert.equal(result.countryCode, 'CN');
});

test('searchCities merges the 市 variant and ranks the settlement first', async () => {
  const queries = [];
  const fetchJson = url => {
    const name = new URL(url).searchParams.get('name');
    queries.push(name);
    if (name === '青岛') {
      return Promise.resolve({
        results: [{ id: 1, name: '青岛', latitude: 39.32, longitude: 121.73, feature_code: 'PPL', admin1: '辽宁', admin2: '大连市', country: '中国', country_code: 'CN' }]
      });
    }
    return Promise.resolve({
      results: [{ id: 2, name: '青岛市', latitude: 36.06, longitude: 120.38, feature_code: 'PPLA2', admin1: '山东', admin2: '青岛市', country: '中国', country_code: 'CN' }]
    });
  };

  const cities = await searchCities(fetchJson, '青岛', { language: 'zh' });
  assert.deepEqual(queries.sort(), ['青岛', '青岛市'].sort());
  // 内置索引先给结果（含正确的省/市归属），网络结果补位。
  assert.equal(cities[0].name, '青岛市');
  assert.equal(cities[0].source, 'district');
  assert.equal(cities[0].region, '山东省');
  const remote = cities.find(hit => hit.id === 2);
  assert.ok(remote, 'the Open-Meteo hit is still merged in');
  assert.equal(remote.region, '山东');
});

test('a district query resolves offline and keeps the parent city', async () => {
  const offline = () => Promise.reject(new Error('offline'));
  const cities = await searchCities(offline, '徐汇区', { language: 'zh' });
  assert.equal(cities[0].name, '徐汇区');
  assert.equal(cities[0].city, '上海市');
  assert.equal(cities[0].district, '徐汇区');
  assert.equal(cities[0].region, '上海市');
  assert.equal(cities[0].featureCode, 'ADM3');
  assert.ok(Math.abs(cities[0].lat - 31.2) < 1 && Math.abs(cities[0].lon - 121.4) < 1);
});

test('searchCities returns [] for a blank query and tolerates failures', async () => {
  assert.deepEqual(await searchCities(() => Promise.resolve({}), '   '), []);
  const failing = () => Promise.reject(new Error('offline'));
  assert.deepEqual(await searchCities(failing, 'Qingdao'), []);
});
