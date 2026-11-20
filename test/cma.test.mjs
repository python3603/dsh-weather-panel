import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCmaSearchUrl,
  buildCmaViewUrl,
  cmaCandidateNames,
  cmaCodeToWmo,
  cmaPathInRegion,
  normalizeCmaForecast,
  parseCmaStations,
  pickCmaStation
} from '../src/lib/cma.js';

const VIEW = {
  data: {
    lastUpdate: '2026/11/17 11:30',
    location: { id: '54857', name: '青岛', path: '山东 > 青岛' },
    now: {
      temperature: '9.6',
      feelst: '6.4',
      humidity: '59',
      precipitation: '0.0',
      pressure: '1015',
      windDirectionDegree: '358',
      windSpeed: '3.9',
      windScale: '3级'
    },
    daily: [
      { date: '2026/11/17', high: '12', low: '6', dayCode: '2', nightCode: '0' },
      { date: '2026/11/18', high: '13', low: '7', dayCode: '1', nightCode: '1' }
    ]
  }
};

test('parses autocomplete rows and drops malformed ones', () => {
  const stations = parseCmaStations({
    data: ['54857|青岛|Qingdao|中国', '54943|黄岛|Huangdao|中国', '', 'bad']
  });
  assert.equal(stations.length, 2);
  assert.deepEqual(stations[0], { id: '54857', name: '青岛', en: 'Qingdao', country: '中国' });
});

test('builds the documented CMA URLs', () => {
  assert.equal(buildCmaSearchUrl('青岛市'), 'https://weather.cma.cn/api/autocomplete?q=%E9%9D%92%E5%B2%9B%E5%B8%82');
  assert.equal(buildCmaViewUrl('54857'), 'https://weather.cma.cn/api/weather/view?stationid=54857');
});

test('candidate names go from the city to the district and strip suffixes', () => {
  assert.deepEqual(
    cmaCandidateNames({ city: '青岛市', district: '黄岛区', label: '青岛市·黄岛区' }),
    ['青岛市', '青岛', '黄岛区', '黄岛']
  );
  assert.deepEqual(cmaCandidateNames({ label: '青岛市·黄岛区' }), ['青岛市', '青岛', '黄岛区', '黄岛']);
});

test('station picking prefers an exact city match over a containing district', () => {
  const stations = [
    { id: '1', name: '黄岛', country: '中国' },
    { id: '2', name: '青岛', country: '中国' },
    { id: '3', name: '青岛', country: '美国' }
  ];
  assert.equal(pickCmaStation(stations, ['青岛市', '黄岛区']).id, '2');
  assert.equal(pickCmaStation([{ id: '9', name: '黄岛', country: '中国' }], ['青岛市', '黄岛区']).id, '9');
  assert.equal(pickCmaStation([], ['青岛市']), null);
});

test('CMA phenomenon codes map to WMO codes and unknown values stay null', () => {
  assert.equal(cmaCodeToWmo(0), 0);
  assert.equal(cmaCodeToWmo('3'), 80);
  assert.equal(cmaCodeToWmo(14), 71);
  assert.equal(cmaCodeToWmo(99), 3);
  assert.equal(cmaCodeToWmo('x'), null);
  assert.equal(cmaCodeToWmo(999), null);
});

test('normalizes current + daily into the panel shape and marks it partial', () => {
  const forecast = normalizeCmaForecast(VIEW, { station: { id: '54857', name: '青岛' } });
  assert.ok(forecast);
  assert.equal(forecast.partial, true);
  assert.equal(forecast.source.id, 'cma');
  assert.equal(forecast.timezone, 'Asia/Shanghai');
  assert.equal(forecast.utcOffsetSeconds, 28800);
  assert.equal(forecast.hourly.length, 0);
  assert.equal(forecast.current.temperature, 9.6);
  assert.equal(forecast.current.apparentTemperature, 6.4);
  assert.equal(forecast.current.pressure, 1015);
  // m/s → km/h
  assert.equal(forecast.current.windSpeed, 14);
  assert.equal(forecast.current.windDirection, 358);
  assert.equal(forecast.current.time, '2026-11-17T11:30');
  assert.equal(forecast.daily.length, 2);
  assert.deepEqual(forecast.daily[0].date, '2026-11-17');
  assert.equal(forecast.daily[0].tempMax, 12);
  assert.equal(forecast.daily[0].tempMin, 6);
  assert.equal(forecast.station.id, '54857');
});

test('region guard rejects a same-named district from another province', () => {
  assert.equal(cmaPathInRegion('山东 > 青岛', '山东省'), true);
  assert.equal(cmaPathInRegion('山东 > 青岛 > 黄岛', '山东省'), true);
  assert.equal(cmaPathInRegion('辽宁 > 朝阳', '北京市'), false);
  assert.equal(cmaPathInRegion('北京 > 朝阳', '北京市'), true);
  assert.equal(cmaPathInRegion('', '北京市'), true);
  assert.equal(cmaPathInRegion('山东 > 青岛', ''), true);
});

test('uses the night code outside daytime and rejects empty payloads', () => {
  const night = JSON.parse(JSON.stringify(VIEW));
  night.data.lastUpdate = '2026/11/17 23:10';
  const forecast = normalizeCmaForecast(night, { station: { id: '54857', name: '青岛' } });
  assert.equal(forecast.current.weatherCode, cmaCodeToWmo(0));
  assert.equal(normalizeCmaForecast({ data: { now: { temperature: 1 } } }), null);
  assert.equal(normalizeCmaForecast({ data: { now: {}, daily: [] } }), null);
  assert.equal(normalizeCmaForecast(null), null);
});
