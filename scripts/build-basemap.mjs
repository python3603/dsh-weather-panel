#!/usr/bin/env node
/**
 * Build the offline land mask used by the typhoon chart.
 *
 * Source: Natural Earth land polygons (public domain — no attribution required,
 * but the panel credits it anyway). The raw file is 135 KB (1:110m) / 1.6 MB
 * (1:50m), far too big to ship; this script clips it to the western Pacific,
 * simplifies it and rounds the coordinates, then writes a flat-array module the
 * renderer turns into one SVG path.
 *
 * Usage:
 *   node scripts/build-basemap.mjs                 # 1:110m, default tolerance
 *   node scripts/build-basemap.mjs --scale 50m --tolerance 0.06 --decimals 2
 *
 * The downloaded source is cached under `.cache/basemap/` (gitignored); the
 * generated `src/ui/basemap-data.js` is committed so builds work offline.
 */

import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = join(ROOT, '.cache', 'basemap');
const OUTPUT = join(ROOT, 'src', 'ui', 'basemap-data.js');

const SOURCES = {
  '110m': 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson',
  '50m': 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson'
};

/** Western Pacific: South China Sea, Japan, Philippines, Indonesia, east to 180. */
const BBOX = { west: 90, south: -12, east: 180, north: 48 };

function parseArgs(argv) {
  const options = { scale: '110m', tolerance: 0.12, decimals: 1, minArea: 0.05 };
  for (let index = 2; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === '--scale') options.scale = value;
    else if (key === '--tolerance') options.tolerance = Number(value);
    else if (key === '--decimals') options.decimals = Number(value);
    else if (key === '--min-area') options.minArea = Number(value);
  }
  if (!SOURCES[options.scale]) throw new Error(`unknown scale: ${options.scale}`);
  return options;
}

async function loadSource(scale) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const file = join(CACHE_DIR, `ne_${scale}_land.geojson`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  const response = await fetch(SOURCES[scale]);
  if (!response.ok) throw new Error(`download failed: HTTP ${response.status}`);
  const text = await response.text();
  writeFileSync(file, text, 'utf8');
  return JSON.parse(text);
}

function inside(point, edge) {
  if (edge === 'west') return point[0] >= BBOX.west;
  if (edge === 'east') return point[0] <= BBOX.east;
  if (edge === 'south') return point[1] >= BBOX.south;
  return point[1] <= BBOX.north;
}

function intersect(a, b, edge) {
  if (edge === 'west' || edge === 'east') {
    const x = edge === 'west' ? BBOX.west : BBOX.east;
    const t = (x - a[0]) / (b[0] - a[0]);
    return [x, a[1] + (b[1] - a[1]) * t];
  }
  const y = edge === 'south' ? BBOX.south : BBOX.north;
  const t = (y - a[1]) / (b[1] - a[1]);
  return [a[0] + (b[0] - a[0]) * t, y];
}

/** Sutherland–Hodgman clip of one ring against the bounding box. */
function clipRing(points) {
  let output = points;
  for (const edge of ['west', 'east', 'south', 'north']) {
    if (output.length === 0) break;
    const input = output;
    output = [];
    for (let index = 0; index < input.length; index += 1) {
      const current = input[index];
      const next = input[(index + 1) % input.length];
      const currentIn = inside(current, edge);
      const nextIn = inside(next, edge);
      if (currentIn) output.push(current);
      if (currentIn !== nextIn) output.push(intersect(current, next, edge));
    }
  }
  return output;
}

function perpendicularDistance(point, start, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (dx === 0 && dy === 0) return Math.hypot(point[0] - start[0], point[1] - start[1]);
  const t = ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  return Math.hypot(point[0] - (start[0] + clamped * dx), point[1] - (start[1] + clamped * dy));
}

/** Ramer–Douglas–Peucker, in degrees (planar is fine at this scale). */
function simplify(points, tolerance) {
  if (points.length <= 2) return points;
  let maxDistance = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }
  if (maxDistance <= tolerance) return [points[0], points[points.length - 1]];
  const left = simplify(points.slice(0, index + 1), tolerance);
  const right = simplify(points.slice(index), tolerance);
  return left.slice(0, -1).concat(right);
}

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function ringArea(points) {
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    sum += current[0] * next[1] - next[0] * current[1];
  }
  return Math.abs(sum) / 2;
}

function dedupe(points, decimals) {
  const output = [];
  for (const point of points) {
    const rounded = [round(point[0], decimals), round(point[1], decimals)];
    const last = output[output.length - 1];
    if (!last || last[0] !== rounded[0] || last[1] !== rounded[1]) output.push(rounded);
  }
  if (output.length > 1) {
    const first = output[0];
    const last = output[output.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) output.pop();
  }
  return output;
}

function ringBBox(points) {
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const point of points) {
    west = Math.min(west, point[0]);
    east = Math.max(east, point[0]);
    south = Math.min(south, point[1]);
    north = Math.max(north, point[1]);
  }
  return [west, south, east, north];
}

function collectRings(geometry, rings) {
  if (!geometry) return;
  if (geometry.type === 'Polygon') {
    geometry.coordinates.forEach(ring => rings.push(ring));
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach(polygon => polygon.forEach(ring => rings.push(ring)));
  }
}

const options = parseArgs(process.argv);
const geo = await loadSource(options.scale);
const rawRings = [];
for (const feature of geo.features || []) collectRings(feature.geometry, rawRings);

const processed = [];
for (const ring of rawRings) {
  const clipped = clipRing(ring);
  if (clipped.length < 4) continue;
  if (ringArea(clipped) < options.minArea) continue;
  const simplified = simplify(clipped, options.tolerance);
  const clean = dedupe(simplified, options.decimals);
  if (clean.length < 3) continue;
  if (ringArea(clean) < options.minArea * 0.5) continue;
  const bbox = ringBBox(clean);
  processed.push([bbox[0], bbox[1], bbox[2], bbox[3], ...clean.flat()]);
}

const round6 = value => Math.round(value * 1e6) / 1e6;
const rings = processed
  .sort((left, right) => left.length - right.length)
  .map(ring => ring.map(value => round6(value)));

// Hoist the shared coordinate bbox: every ring repeats it anyway, and a plain
// array of numbers keeps the artifact small and the parser trivial.
const header = `/*!
 * Offline land mask for the typhoon chart — generated, do not edit by hand.
 * Source: Natural Earth ${options.scale} land (public domain).
 * https://www.naturalearthdata.com/
 * Region: ${BBOX.west}..${BBOX.east}E, ${BBOX.south}..${BBOX.north}N
 * Simplified with RDP tolerance ${options.tolerance}°, rounded to ${options.decimals} decimal(s).
 * Ring format: [west, south, east, north, lon0, lat0, lon1, lat1, ...]
 */

export const BASEMAP_META = {
  source: 'Natural Earth',
  scale: '${options.scale}',
  license: 'Public domain',
  west: ${BBOX.west},
  south: ${BBOX.south},
  east: ${BBOX.east},
  north: ${BBOX.north},
  tolerance: ${options.tolerance},
  decimals: ${options.decimals},
  rings: ${rings.length}
};

export const BASEMAP_LAND = [
${rings.map(ring => `  [${ring.join(',')}]`).join(',\n')}
];
`;

writeFileSync(OUTPUT, header, 'utf8');
const bytes = Buffer.byteLength(header, 'utf8');
console.log(`basemap ${options.scale}: ${rings.length} rings, ${(bytes / 1024).toFixed(1)} KiB → src/ui/basemap-data.js`);
