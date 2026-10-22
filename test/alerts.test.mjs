import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ALERT_LEVELS,
  alertSignature,
  buildAlarmPageUrl,
  highestAlertRank,
  matchAlerts,
  normalizeAlert,
  normalizeAlarmPage,
  parseAlertTitle,
  parseIssueTime,
  placeRoots
} from '../src/lib/alerts.js';

test('the alarm URL is paged and capped at the service limit', () => {
  assert.equal(buildAlarmPageUrl(1, 20), 'https://www.nmc.cn/rest/findAlarm?pageNo=1&pageSize=20');
  assert.match(buildAlarmPageUrl(2, 500), /pageSize=100$/, 'pageSize is capped at 100');
  assert.match(buildAlarmPageUrl(0, 0), /pageNo=1&pageSize=100$/, 'invalid values fall back to defaults');
});

test('issue times are read as Beijing wall clock', () => {
  assert.equal(parseIssueTime('2026/10/22 20:12'), Date.UTC(2026, 9, 22, 12, 12));
  assert.equal(parseIssueTime('2026/01/01 00:05'), Date.UTC(2025, 11, 31, 16, 5));
  assert.equal(parseIssueTime('bogus'), null);
  assert.equal(parseIssueTime(null), null);
});

test('titles are parsed into type, level and place', () => {
  const wind = parseAlertTitle('内蒙古自治区呼伦贝尔市气象台发布大风蓝色预警信号');
  assert.equal(wind.type, '大风');
  assert.equal(wind.typeEn, 'Gale');
  assert.equal(wind.level, 'blue');
  assert.equal(wind.levelRank, 1);
  assert.equal(wind.place, '内蒙古自治区呼伦贝尔市');

  const seaWind = parseAlertTitle('山东省气象台发布海上大风黄色预警');
  assert.equal(seaWind.type, '海上大风', 'the longest matching type wins');
  assert.equal(seaWind.level, 'yellow');
  assert.equal(seaWind.levelRank, 2);

  const rain = parseAlertTitle('广东省深圳市气象台发布暴雨红色预警信号');
  assert.equal(rain.type, '暴雨');
  assert.equal(rain.level, 'red');
  assert.equal(rain.levelRank, 4);

  const noLevel = parseAlertTitle('某某市气象台发布雷电预警信号');
  assert.equal(noLevel.type, '雷电');
  assert.equal(noLevel.level, '');
  assert.equal(noLevel.levelRank, 0);

  const unknown = parseAlertTitle('某某市气象台发布神秘现象橙色预警信号');
  assert.equal(unknown.level, 'orange');
  assert.ok(unknown.type.length > 0, 'an unknown type is still surfaced');
});

test('every level has a rank that increases with severity', () => {
  const ranks = ALERT_LEVELS.map(item => item.rank);
  assert.deepEqual(ranks, [1, 2, 3, 4]);
  assert.deepEqual(ALERT_LEVELS.map(item => item.key), ['blue', 'yellow', 'orange', 'red']);
});

test('one API entry normalizes into the shape the UI renders', () => {
  const alert = normalizeAlert({
    alertid: '15070041600000_20261022201237',
    issuetime: '2026/10/22 20:12',
    title: '山东省青岛市气象台发布大风蓝色预警信号',
    url: '/publish/alarm/15070041600000_20261022201237.html',
    pic: 'https://image.nmc.cn/assets/img/alarm/p0007004.png'
  });
  assert.equal(alert.id, '15070041600000_20261022201237');
  assert.equal(alert.url, 'https://www.nmc.cn/publish/alarm/15070041600000_20261022201237.html');
  assert.equal(alert.level, 'blue');
  assert.equal(alert.levelZh, '蓝色');
  assert.equal(alert.levelEn, 'Blue');
  assert.equal(alert.issuedAt, Date.UTC(2026, 9, 22, 12, 12));
  assert.equal(normalizeAlert({}), null);
  assert.equal(normalizeAlert(null), null);
});

test('a page payload reports counts and tolerates missing rows', () => {
  const page = normalizeAlarmPage({
    data: {
      page: {
        pageNo: 1,
        count: 296,
        totalPage: 3,
        list: [
          { alertid: 'a', issuetime: '2026/10/22 20:12', title: '山东省气象台发布暴雨黄色预警信号', url: '/x' },
          null,
          { alertid: 'b', issuetime: '2026/10/22 19:00', title: '', url: '/y' }
        ]
      }
    }
  });
  assert.equal(page.alerts.length, 1);
  assert.equal(page.count, 296);
  assert.equal(page.totalPage, 3);
  assert.deepEqual(normalizeAlarmPage(null), { alerts: [], count: 0, pageNo: 1, totalPage: 1 });
});

test('place roots strip administrative suffixes', () => {
  assert.deepEqual(placeRoots('山东省'), ['山东省', '山东']);
  assert.deepEqual(placeRoots('青岛市'), ['青岛市', '青岛']);
  assert.deepEqual(placeRoots('内蒙古自治区'), ['内蒙古自治区', '内蒙古']);
  assert.deepEqual(placeRoots('深圳'), ['深圳']);
  assert.deepEqual(placeRoots(''), []);
});

test('matching prefers the city and then the province, highest level first', () => {
  const location = { city: '青岛市', region: '山东省' };
  const alerts = [
    normalizeAlert({ alertid: '1', issuetime: '2026/10/22 08:00', title: '山东省气象台发布暴雨黄色预警信号', url: '/1' }),
    normalizeAlert({ alertid: '2', issuetime: '2026/10/22 09:00', title: '山东省青岛市气象台发布大风蓝色预警信号', url: '/2' }),
    normalizeAlert({ alertid: '3', issuetime: '2026/10/22 10:00', title: '广东省气象台发布台风红色预警信号', url: '/3' })
  ];
  const matched = matchAlerts(alerts, location);
  assert.equal(matched.length, 2, 'other provinces are dropped');
  assert.equal(matched[0].id, '2', 'city level first');
  assert.equal(matched[0].scope, 'city');
  assert.equal(matched[1].scope, 'region');
  assert.equal(highestAlertRank(matched), 2);
  assert.equal(alertSignature(matched), '1,2', 'signature is order independent');
  assert.deepEqual(matchAlerts([], location), []);
  assert.deepEqual(matchAlerts(alerts, null), [], 'no place means no match');
});

test('a higher-level city alert outranks a lower-level one', () => {
  const location = { city: '深圳市', region: '广东省' };
  const alerts = [
    normalizeAlert({ alertid: 'low', issuetime: '2026/10/22 08:00', title: '广东省深圳市气象台发布大风蓝色预警信号', url: '/a' }),
    normalizeAlert({ alertid: 'high', issuetime: '2026/10/22 07:00', title: '广东省深圳市气象台发布暴雨红色预警信号', url: '/b' })
  ];
  const matched = matchAlerts(alerts, location);
  assert.equal(matched[0].id, 'high');
  assert.equal(highestAlertRank(matched), 4);
});
