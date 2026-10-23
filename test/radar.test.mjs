import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RADAR_PRODUCTS,
  formatRadarStamp,
  radarBeijingParts,
  radarImageUrl,
  radarPageUrl,
  radarProduct,
  radarStampAt,
  radarStamps
} from '../src/lib/radar.js';

test('a stamp is the UTC yyyymmddhhmm of the moment', () => {
  assert.equal(radarStampAt(Date.UTC(2026, 9, 23, 8, 24)), '202610230824');
  assert.equal(radarStampAt(Date.UTC(2026, 0, 5, 0, 6)), '202601050006');
});

test('frames step back six minutes, newest first', () => {
  const now = Date.UTC(2026, 9, 23, 8, 27, 30);
  assert.deepEqual(radarStamps(now, 3), ['202610230824', '202610230818', '202610230812']);
});

test('the image URL follows the official RDCP naming rule', () => {
  assert.equal(
    radarImageUrl(radarProduct('chinaall'), '202610230824'),
    'https://image.nmc.cn/product/2026/10/23/RDCP/medium/SEVP_AOC_RDCP_SLDAS3_ECREF_ACHN_L88_PI_20261023082400000.PNG'
  );
  // Only the nationwide mosaic lives under medium/.
  assert.equal(
    radarImageUrl(radarProduct('huadong'), '202610230824'),
    'https://image.nmc.cn/product/2026/10/23/RDCP/SEVP_AOC_RDCP_SLDAS3_ECREF_AECN_L88_PI_20261023082400000.PNG'
  );
});

test('file stamps are UTC while the labels are Beijing time', () => {
  assert.deepEqual(radarBeijingParts('202610230824'), { day: '10/23', clock: '16:24', minutes: 984 });
  assert.equal(formatRadarStamp('202610230824', 'zh'), '10/23 16:24');
  assert.equal(formatRadarStamp('202610230824', 'en'), '16:24 BJT · 10/23');
});

test('every product carries its official code and page', () => {
  assert.equal(RADAR_PRODUCTS.length, 8);
  for (const product of RADAR_PRODUCTS) {
    assert.match(product.code, /^A[A-Z]{3}$/, `${product.id} has a code`);
    assert.ok(product.frames >= 20, `${product.id} has a usable window`);
  }
  assert.equal(radarProduct('nope').id, 'chinaall');
  assert.equal(radarPageUrl(radarProduct('huabei')), 'https://www.nmc.cn/publish/radar/huabei.html');
});
