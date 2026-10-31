import test from 'node:test';
import assert from 'node:assert/strict';

import {
  colorToCss,
  compositeOver,
  contrastRatio,
  contrastSurfaceFor,
  isLightColor,
  parseColor,
  relativeLuminance
} from '../src/lib/surface.js';

test('hex and rgb colours are parsed with their alpha', () => {
  assert.deepEqual(parseColor('#abc'), { r: 170, g: 187, b: 204, a: 1 });
  assert.deepEqual(parseColor('#11223344'), { r: 17, g: 34, b: 51, a: 68 / 255 });
  assert.deepEqual(parseColor('rgba(10, 20, 30, 0.5)'), { r: 10, g: 20, b: 30, a: 0.5 });
  assert.deepEqual(parseColor('rgb(255 255 255 / 25%)'), { r: 255, g: 255, b: 255, a: 0.25 });
  assert.deepEqual(parseColor('transparent'), { r: 0, g: 0, b: 0, a: 0 });
  assert.equal(parseColor('color-mix(in srgb, red, blue)'), null);
});

test('luminance and light/dark detection', () => {
  assert.equal(relativeLuminance({ r: 255, g: 255, b: 255, a: 1 }), 1);
  assert.equal(relativeLuminance({ r: 0, g: 0, b: 0, a: 1 }), 0);
  assert.equal(isLightColor({ r: 240, g: 240, b: 240, a: 1 }), true);
  assert.equal(isLightColor({ r: 20, g: 20, b: 20, a: 1 }), false);
});

test('compositing an alpha colour over an opaque one stays opaque', () => {
  const result = compositeOver({ r: 255, g: 255, b: 255, a: 0.5 }, { r: 0, g: 0, b: 0, a: 1 });
  assert.deepEqual(result, { r: 128, g: 128, b: 128, a: 1 });
  assert.equal(colorToCss(result), 'rgb(128, 128, 128)');
});

test('the surface is the opposite pole of the text colour it is given', () => {
  const lightText = contrastSurfaceFor('rgb(233, 236, 242)');
  assert.equal(lightText.background, 'rgb(20, 22, 27)', 'light text gets a dark card');
  assert.ok(lightText.ratio >= 7, 'comfortable contrast');
  const darkText = contrastSurfaceFor('rgb(31, 35, 40)');
  assert.equal(darkText.background, 'rgb(252, 252, 253)', 'dark text gets a light card');
  assert.ok(darkText.ratio >= 7);
});

test('the colour the browser really paints wins over any theme token', () => {
  // This is the reported regression: a white card under the dark theme's
  // pale-blue text. The measured text colour decides the surface.
  const paleBlue = contrastSurfaceFor('rgb(150, 205, 245)');
  assert.equal(paleBlue.background, 'rgb(20, 22, 27)');
  assert.equal(paleBlue.ink, 'rgb(245, 247, 251)');
  assert.equal(contrastSurfaceFor('not-a-colour'), null);
});

test('contrastRatio matches the WCAG extremes', () => {
  const white = { r: 255, g: 255, b: 255, a: 1 };
  const black = { r: 0, g: 0, b: 0, a: 1 };
  assert.equal(Math.round(contrastRatio(white, black)), 21);
  assert.equal(Math.round(contrastRatio(white, white)), 1);
});
