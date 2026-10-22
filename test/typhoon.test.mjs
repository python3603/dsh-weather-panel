import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TYPHOON_LEVELS,
  describeTrackPoint,
  describeTyphoonIntensity,
  formatTyphoonNumber,
  normalizeTyphoonDetail,
  normalizeTyphoonList,
  parseJsonp,
  parseTyphoonNumber,
  peakIntensity,
  pickTyphoon,
  trackBounds
} from '../src/lib/typhoon.js';

/** Two track points + one forecast entry, in the service's array shape. */
const TRACK_POINT = (id, utc, epoch, level, lon, lat, pressure, wind) => [
  id, utc, epoch, level, lon, lat, pressure, wind, 'NW', 18,
  [['30KTS', 500, 450, 350, 480, id]],
  { BABJ: [[24, utc, lon - 1.2, lat + 1.4, pressure + 10, wind - 5, 'BABJ', 'TY']] },
  [utc, '2026年10月22日14时00分', null, null]
];

const DETAIL_PAYLOAD = {
  typhoon: [
    3359119, 'CHAMPI', '蔷琵', 2630, 2630, null, '一种花', 'start',
    [
      TRACK_POINT(1, '202610220600', 1792648800000, 'SuperTY', 125.4, 20.8, 935, 52),
      TRACK_POINT(2, '202610221200', 1792670400000, 'STY', 124.9, 21.2, 945, 48)
    ]
  ]
};

test('JSONP is unwrapped without evaluating it', () => {
  assert.deepEqual(parseJsonp('cb({"a":1})'), { a: 1 });
  assert.deepEqual(parseJsonp('cb(({"a":1}))'), { a: 1 }, 'double-wrapped list payload');
  assert.deepEqual(parseJsonp('  cb( {"a":1} )  '), { a: 1 });
  assert.equal(parseJsonp('not jsonp at all'), null);
  assert.equal(parseJsonp('cb({broken})'), null);
  assert.equal(parseJsonp(''), null);
  assert.equal(parseJsonp(null), null);
});

test('the typhoon list normalizes and prefers a running system', () => {
  const payload = {
    typhoonList: [
      [3359119, 'CHAMPI', '蔷琵', '2630', '2630', null, '一种花', 'start'],
      [3346033, 'KOGUMA', '小熊', '2629', '2629', null, '小熊星座', 'stop'],
      [3346168, 'NOLO', '诺洛', '2628', '2628', null, '', 'stop']
    ]
  };
  const list = normalizeTyphoonList(payload);
  assert.equal(list.length, 3);
  assert.equal(list[0].nameZh, '蔷琵');
  assert.equal(list[0].status, 'start');
  const picked = pickTyphoon(list);
  assert.equal(picked.id, 3359119, 'a running typhoon wins');

  const ended = pickTyphoon(list.filter(item => item.status === 'stop'));
  assert.equal(ended.number, '2629', 'otherwise the newest number wins');
  assert.equal(pickTyphoon([]), null);
  assert.deepEqual(normalizeTyphoonList(null), []);
});

test('typhoon numbers are decoded for both digit widths', () => {
  assert.deepEqual(parseTyphoonNumber('2630'), { year: 2026, sequence: 30 });
  assert.deepEqual(parseTyphoonNumber('20260027'), { year: 2026, sequence: 27 });
  assert.deepEqual(parseTyphoonNumber(''), { year: null, sequence: null });
  assert.equal(formatTyphoonNumber('2630', 'zh'), '第 30 号');
  assert.equal(formatTyphoonNumber('2630', 'en'), 'No. 30');
  assert.equal(formatTyphoonNumber('', 'zh'), '');
});

test('intensity codes map to labels, ranks and colours', () => {
  assert.equal(describeTyphoonIntensity('SuperTY', 'zh').label, '超强台风');
  assert.equal(describeTyphoonIntensity('TS', 'en').label, 'Tropical storm');
  assert.equal(describeTyphoonIntensity('SuperTY', 'zh').rank, TYPHOON_LEVELS.length);
  assert.equal(describeTyphoonIntensity('???', 'zh').rank, 0);
  assert.match(describeTyphoonIntensity('TY', 'zh').color, /^#/);
});

test('the detail payload becomes track points with a forecast', () => {
  const detail = normalizeTyphoonDetail(DETAIL_PAYLOAD);
  assert.equal(detail.id, 3359119);
  assert.equal(detail.nameZh, '蔷琵');
  assert.equal(detail.number, '2630');
  assert.equal(detail.status, 'start');
  assert.equal(detail.points.length, 2);
  const first = detail.points[0];
  assert.equal(first.lat, 20.8);
  assert.equal(first.lon, 125.4);
  assert.equal(first.pressure, 935);
  assert.equal(first.wind, 52);
  assert.equal(first.intensity, 'SuperTY');
  assert.equal(first.timeText, '2026年10月22日14时00分');
  assert.equal(first.windRadii[0].radiusKm, 500, 'the widest quadrant is used');
  assert.equal(detail.forecast.length, 1);
  assert.equal(detail.forecast[0].hour, 24);
  assert.equal(detail.latest.lat, 21.2);
  assert.equal(peakIntensity(detail).code, 'SuperTY');
});

test('a newest fix without a forecast falls back to the previous advisory', () => {
  const noForecast = TRACK_POINT(3, '202610221800', 1792700000000, 'TY', 124.4, 21.6, 955, 42);
  noForecast[11] = null;
  const detail = normalizeTyphoonDetail({
    typhoon: [
      3359119, 'CHAMPI', '蔷琵', 2630, 2630, null, '一种花', 'start',
      [
        TRACK_POINT(1, '202610220600', 1792648800000, 'SuperTY', 125.4, 20.8, 935, 52),
        TRACK_POINT(2, '202610221200', 1792670400000, 'STY', 124.9, 21.2, 945, 48),
        noForecast
      ]
    ]
  });
  assert.equal(detail.latest.intensity, 'TY', 'the latest point is still the latest fix');
  assert.equal(detail.forecast.length, 1, 'the forecast comes from the previous point');
  assert.equal(detail.forecastBase, '2026年10月22日14时00分');
});

test('a track point is reduced to the values both views show', () => {
  const detail = normalizeTyphoonDetail(DETAIL_PAYLOAD);
  const info = describeTrackPoint(detail.points[1], 'zh');
  assert.equal(info.time, '2026年10月22日14时00分');
  assert.equal(info.intensity, '强台风');
  assert.equal(info.position, '21.2°N 124.9°E');
  assert.equal(info.pressure, 945);
  assert.equal(info.wind, 48);
  assert.equal(info.moveDirection, 'NW');
  assert.equal(info.moveSpeed, 18);
  assert.match(info.color, /^#/);

  assert.equal(describeTrackPoint(null, 'zh'), null);
  const bare = describeTrackPoint({ lat: 10, lon: 120, intensity: 'TS' }, 'en');
  assert.equal(bare.pressure, null, 'missing numbers stay null, never NaN');
  assert.equal(bare.wind, null);
  assert.equal(bare.intensity, 'Tropical storm');
  assert.equal(bare.position, '10.0°N 120.0°E');
});

test('unusable detail payloads return null instead of a broken object', () => {
  assert.equal(normalizeTyphoonDetail(null), null);
  assert.equal(normalizeTyphoonDetail({}), null);
  assert.equal(normalizeTyphoonDetail({ typhoon: [1, 'X', '未知', '2630', '2630', null, '', 'start', []] }), null);
});

test('bounds cover the track plus the forecast, with a minimum span', () => {
  const detail = normalizeTyphoonDetail(DETAIL_PAYLOAD);
  const bounds = trackBounds(detail, 3);
  assert.ok(bounds.west < 124.9);
  assert.ok(bounds.east > 125.4);
  assert.ok(bounds.south < 20.8);
  assert.ok(bounds.north > 22.6, 'the forecast point at lat+1.4 is inside');
  assert.ok(bounds.east - bounds.west >= 6, 'a tiny track still gets a readable span');
  assert.equal(trackBounds(null), null);
});
