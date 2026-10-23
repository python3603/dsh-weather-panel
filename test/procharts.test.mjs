import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ECMWF_CODES,
  ECMWF_HOURS,
  SST_DAYS,
  SST_REGIONS,
  ecmwfImageUrl,
  ecmwfRunLabel,
  ecmwfRuns,
  sstImageUrl,
  sstLabel,
  sstRegion,
  sstStamp
} from '../src/lib/procharts.js';

test('SST stamps are daily and region-scoped', () => {
  const now = Date.UTC(2026, 9, 23, 5, 30);
  assert.equal(sstStamp(0, now), '20261023');
  assert.equal(sstStamp(3, now), '20261020');
  assert.equal(
    sstImageUrl('wpac', '20261023'),
    'https://www.easterlywave.com/media/typhoon/sst/20261023/wpac.png'
  );
  assert.equal(sstLabel('20261023'), '10/23');
  assert.equal(SST_REGIONS[0].id, 'wpac', 'the NW Pacific is the default region');
  assert.equal(sstRegion('nope').id, 'wpac');
  assert.equal(SST_DAYS, 15);
});

test('ECMWF runs fall back from the newest 12Z run', () => {
  assert.deepEqual(
    ecmwfRuns(Date.UTC(2026, 9, 23, 13)),
    ['2026102312', '2026102300', '2026102212', '2026102200']
  );
  // Before 12Z the newest run is today's 00Z, so the list is one shorter.
  assert.deepEqual(
    ecmwfRuns(Date.UTC(2026, 9, 23, 5)),
    ['2026102300', '2026102212', '2026102200']
  );
});

test('ECMWF image URLs follow the site naming rule', () => {
  assert.equal(
    ecmwfImageUrl('GPT', '2026102312', 24),
    'https://www.easterlywave.com/media/model/ecmwf/2026102312/gpt_china_24.png'
  );
  assert.equal(
    ecmwfImageUrl('WNP', '2026102312', 240),
    'https://www.easterlywave.com/media/model/ecmwf/2026102312/wnp_china_240.png'
  );
  // Unknown codes fall back to the first product instead of producing a broken URL.
  assert.match(ecmwfImageUrl('NOPE', '2026102312', 0), /\/gpt_china_0\.png$/);
});

test('ECMWF hours step by 24 up to 240', () => {
  assert.equal(ECMWF_HOURS.length, 11);
  assert.deepEqual(ECMWF_HOURS.slice(0, 3), [0, 24, 48]);
  assert.equal(ECMWF_HOURS.at(-1), 240);
  assert.equal(ECMWF_CODES.length, 4);
  assert.equal(ecmwfRunLabel('2026102312'), '10/23 20时');
  assert.equal(ecmwfRunLabel('2026102300'), '10/23 08时');
});
