import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatNsmcTime,
  nsmcManifestUrl,
  NSMC_PRODUCTS,
  nsmcProduct,
  parseNsmcManifest
} from '../src/lib/satellite.js';

const NSMC_XML = `<?xml version="1.0" encoding="utf-8"?>
<imagelist name="GEOS IMAGR GBAL L2 MOS IRX GLL">
  <image time="2026-10-23 10:00 (UTC)" desc="x" url="//img.nsmc.org.cn/CLOUDIMAGE/GEOS/MOS/IRX/PIC/GBAL/20261023/GEOS_IMAGR_GBAL_L2_MOS_IRX_GLL_20261023_1000_10KM_MS.jpg"/>
  <image time="2026-10-23 11:00 (UTC)" desc="x" url="//img.nsmc.org.cn/CLOUDIMAGE/GEOS/MOS/IRX/PIC/GBAL/20261023/GEOS_IMAGR_GBAL_L2_MOS_IRX_GLL_20261023_1100_10KM_MS.jpg"/>
</imagelist>`;

test('the NSMC manifest turns into newest-first frames with https URLs', () => {
  const frames = parseNsmcManifest(NSMC_XML);
  assert.equal(frames.length, 2);
  assert.equal(frames[0].time, '2026-10-23 11:00 (UTC)');
  assert.match(frames[0].url, /^https:\/\/img\.nsmc\.org\.cn\/CLOUDIMAGE\//);
  assert.match(frames[1].url, /_1000_10KM_MS\.jpg$/);
  assert.deepEqual(parseNsmcManifest('not xml'), []);
});

test('NSMC times are UTC and the labels are Beijing time', () => {
  assert.equal(formatNsmcTime('2026-10-23 11:00 (UTC)', 'zh'), '10/23 19:00');
  assert.equal(formatNsmcTime('2026-10-23 11:00 (UTC)', 'en'), '19:00 BJT · 10/23');
  assert.equal(formatNsmcTime('garbage', 'zh'), 'garbage');
});

test('every NSMC product resolves to one manifest URL', () => {
  for (const product of NSMC_PRODUCTS) {
    const url = nsmcManifestUrl(product);
    assert.match(url, /^https:\/\/img\.nsmc\.org\.cn\/.*\.xml$/, `${product.id} has a manifest`);
  }
  // One product keeps a full URL because its manifest lives outside PORTAL/NSMC/XML.
  assert.match(nsmcManifestUrl(nsmcProduct('FY4B_AGRI_IMG_REGI_GCLR_GLL')), /CLOUDIMAGE\/FY4B\/AGRI\/GCLR\/SEC\/xml\/FY4B-china-72h\.xml$/);
  assert.match(nsmcManifestUrl(nsmcProduct('FY4B_AGRI_IMG_REGI_PCC_GLL')), /\/PORTAL\/NSMC\/XML\/FY4B\/FY4B_AGRI_IMG_REGI_PCC_GLL\.xml$/);
  assert.equal(nsmcProduct('nope').id, 'FY4B_AGRI_IMG_REGI_PCC_GLL');
});


