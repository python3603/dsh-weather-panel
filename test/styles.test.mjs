import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Style guards.
 *
 * These lock two visual bugs that only showed up on real themes:
 *
 * 1. the "high-accuracy location" switch painted its knob with the surface token,
 *    which some themes leave undefined/transparent — the knob turned white on a
 *    white track and the switch read as an empty pill;
 * 2. the precipitation chart drew its axis labels inside an SVG that stretches
 *    with the panel width (`preserveAspectRatio="none"`), so the labels were
 *    stretched out of proportion.
 *
 * The checks run against the built bundle, which is what users actually load.
 */

const bundle = readFileSync(new URL('../client.js', import.meta.url), 'utf8');

test('the on-state switch knob does not depend on the surface token', () => {
  const rule = /\.dshw-switch-on \.dshw-switch-knob\{([^}]*)\}/.exec(bundle);
  assert.ok(rule, 'the on-state knob rule ships in the bundle');
  assert.match(rule[1], /label-primary/, 'the knob uses the theme label colour');
  assert.doesNotMatch(rule[1], /bg-base/, 'the knob must not use --dsw-alias-bg-base');
});

test('chart axis labels are positioned HTML, not SVG text', () => {
  assert.match(bundle, /dshw-chart-axis/, 'the HTML axis row ships');
  assert.match(bundle, /dshw-chart-tick-\$\{align\}/, 'ticks get start/middle/end alignment');
  // An SVG-text tick rule would mean the labels moved back inside the stretched plot.
  assert.doesNotMatch(bundle, /\.dshw-chart-tick\{fill:/);
});

test('the radar product image is contained in a bounded viewport', () => {
  const frame = /\.dshw-media-frame\{([^}]*)\}/.exec(bundle);
  assert.ok(frame, 'the radar frame rule ships');
  assert.match(frame[1], /height:clamp\(/, 'the frame height is bounded so the whole product fits');

  const img = /\.dshw-media-img\{([^}]*)\}/.exec(bundle);
  assert.ok(img, 'the radar image rule ships');
  assert.match(img[1], /max-height:100%/, 'the image never exceeds the frame');
  assert.match(img[1], /object-fit:contain/, 'the image keeps its aspect ratio');
  assert.doesNotMatch(img[1], /width:100%;height:auto/, 'it must not stretch to the panel width again');
});
test('the radar zoom overlay is a fixed full-screen layer', () => {
  const zoom = /\.dshw-zoom\{([^}]*)\}/.exec(bundle);
  assert.ok(zoom, 'the zoom overlay rule ships');
  assert.match(zoom[1], /position:fixed/, 'it covers the window, not just the panel');
  assert.match(zoom[1], /inset:0/);
});
