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

/** Read one CSS template literal out of the built client bundle. */
function cssBlock(name) {
  const marker = 'const ' + name + ' = `';
  const start = bundle.indexOf(marker);
  assert.ok(start >= 0, name + ' ships in the bundle');
  const from = start + marker.length;
  const end = bundle.indexOf('`;', from);
  assert.ok(end > from, name + ' block is closed');
  return bundle.slice(from, end);
}

test('the alert dialog ships its own notice styles', () => {
  const modal = cssBlock('MODAL_BODY_CSS');
  for (const selector of [
    '.dshw-modal-strong',
    '.dshw-notice-strong-bar',
    '.dshw-notice-alert-main',
    '.dshw-notice-alert-text',
    '.dshw-notice-actions',
    '.dshw-notice-mute'
  ]) {
    assert.ok(modal.includes(selector), selector + ' must live in the dialog sheet');
  }
  // The dialog is the `shell.overlay` slot and can show while the panel is
  // closed, so it must never depend on the panel sheet being mounted.
  assert.ok(
    !cssBlock('PANEL_BODY_CSS').includes('.dshw-notice-alert-main'),
    'notice layout must not live only in PANEL_BODY_CSS'
  );
});

test('long alert titles wrap under the chip instead of running off the card', () => {
  const modal = cssBlock('MODAL_BODY_CSS');
  const main = /\.dshw-notice-alert-main\{([^}]*)\}/.exec(modal);
  assert.ok(main, 'the text column rule ships');
  assert.match(main[1], /flex-direction:column/);
  const text = /\.dshw-notice-alert-text\{([^}]*line-clamp[^}]*)\}/.exec(modal);
  assert.ok(text, 'the title rule ships');
  assert.match(text[1], /-webkit-line-clamp:2/, 'the title may take two lines');
  assert.doesNotMatch(text[1], /white-space:nowrap/, 'the title must wrap, not overflow');
});

test('the dialog footer wraps and the mute action keeps no host button chrome', () => {
  const modal = cssBlock('MODAL_BODY_CSS');
  const foot = /\.dshw-modal-foot\{([^}]*)\}/.exec(modal);
  assert.ok(foot, 'the footer rule ships');
  assert.match(foot[1], /flex-wrap:wrap/, 'source line and buttons may stack on a narrow card');
  const mute = /\.dshw-notice-mute\{([^}]*)\}/.exec(modal);
  assert.ok(mute, 'the mute action rule ships');
  assert.match(mute[1], /background:none/);
  assert.match(mute[1], /border:0/);
  assert.match(mute[1], /appearance:none/);
});
