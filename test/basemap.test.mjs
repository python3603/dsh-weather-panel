import test from 'node:test';
import assert from 'node:assert/strict';

import { BASEMAP_LAND, BASEMAP_META } from '../src/ui/basemap-data.js';

/**
 * The land mask is generated (`npm run basemap`), so these checks guard the
 * generated artifact rather than the generator: a truncated file or a bad clip
 * would otherwise only show up as a wrong-looking chart in the browser.
 */

test('the mask is the expected public-domain source', () => {
  assert.equal(BASEMAP_META.license, 'Public domain');
  assert.match(BASEMAP_META.source, /Natural Earth/);
  assert.match(BASEMAP_META.scale, /^(50m|110m)$/);
});

test('every ring is a flat, even-length lon/lat list', () => {
  assert.ok(BASEMAP_LAND.length > 20, 'the western Pacific should have plenty of land');
  for (const ring of BASEMAP_LAND) {
    assert.ok(Array.isArray(ring));
    assert.ok(ring.length > 4 + 3 * 2, 'at least a triangle');
    assert.equal((ring.length - 4) % 2, 0, 'coordinates come in lon/lat pairs');
    assert.ok(ring.slice(4).every(value => typeof value === 'number' && Number.isFinite(value)));
  }
});

test('the stored bbox matches the coordinates and stays inside the mask region', () => {
  for (const ring of BASEMAP_LAND) {
    const [west, south, east, north] = ring;
    assert.ok(west <= east && south <= north, 'bbox is ordered');
    assert.ok(west >= BASEMAP_META.west - 0.001 && east <= BASEMAP_META.east + 0.001, 'longitudes inside the clipped region');
    assert.ok(south >= BASEMAP_META.south - 0.001 && north <= BASEMAP_META.north + 0.001, 'latitudes inside the clipped region');
    for (let index = 4; index < ring.length; index += 2) {
      const lon = ring[index];
      const lat = ring[index + 1];
      assert.ok(lon >= west - 0.001 && lon <= east + 0.001, `lon ${lon} inside its bbox`);
      assert.ok(lat >= south - 0.001 && lat <= north + 0.001, `lat ${lat} inside its bbox`);
    }
  }
});

test('the artifact stays small enough to ship inside the bundle', () => {
  const points = BASEMAP_LAND.reduce((sum, ring) => sum + (ring.length - 4) / 2, 0);
  assert.ok(points > 500, 'too few points would mean a broken simplification');
  assert.ok(points < 40000, `too many points (${points}) would bloat the bundle`);
});
