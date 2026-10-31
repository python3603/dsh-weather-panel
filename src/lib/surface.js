/**
 * Opaque surface resolution for overlays.
 *
 * Why this exists: under the "liquid glass" theme the alias background tokens
 * resolve to *translucent* colours. A popup painted with
 * `var(--dsw-alias-bg-overlay)` then shows the page behind it and the text is
 * hard to read. CSS cannot know how transparent a token is, so the overlay
 * reads the resolved colours in JS, composites them over an opaque fallback
 * chosen from the theme's text polarity, and paints a solid colour.
 *
 * Everything here is pure and unit-tested; DOM access stays in the component.
 */

const HEX = /^#([0-9a-f]{3,8})$/i;
const RGB = /^rgba?\(([^)]+)\)$/i;
// Chrome returns this form for colours derived from color-mix(); channels are 0..1.
const COLOR_FN = /^color\(\s*(?:srgb|display-p3)\s+([^)]+)\)$/i;

/** Parse `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()` and `rgba()`. */
export function parseColor(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (text === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  const hex = HEX.exec(text);
  if (hex) {
    const digits = hex[1];
    const expand = part => (part.length === 1 ? part + part : part);
    if (digits.length === 3 || digits.length === 4) {
      const [r, g, b, a] = digits.split('');
      return {
        r: parseInt(expand(r), 16),
        g: parseInt(expand(g), 16),
        b: parseInt(expand(b), 16),
        a: a === undefined ? 1 : parseInt(expand(a), 16) / 255
      };
    }
    if (digits.length === 6 || digits.length === 8) {
      return {
        r: parseInt(digits.slice(0, 2), 16),
        g: parseInt(digits.slice(2, 4), 16),
        b: parseInt(digits.slice(4, 6), 16),
        a: digits.length === 8 ? parseInt(digits.slice(6, 8), 16) / 255 : 1
      };
    }
    return null;
  }
  const colorFn = COLOR_FN.exec(text);
  if (colorFn) {
    const parts = colorFn[1].split(/[\s/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const channel = value => Math.round(Math.min(1, Math.max(0, parseFloat(value))) * 255);
    const alpha = parts[3] === undefined ? 1 : parseFloat(parts[3]);
    const color = { r: channel(parts[0]), g: channel(parts[1]), b: channel(parts[2]), a: alpha };
    if ([color.r, color.g, color.b, color.a].some(number => !Number.isFinite(number))) return null;
    return color;
  }
  const rgb = RGB.exec(text);
  if (rgb) {
    const parts = rgb[1].split(/[,\s/]+/).filter(Boolean).map(part => part.trim());
    if (parts.length < 3) return null;
    const channel = part => {
      if (part.endsWith('%')) return Math.round((parseFloat(part) / 100) * 255);
      return Math.round(parseFloat(part));
    };
    const alphaPart = parts[3];
    let alpha = 1;
    if (alphaPart !== undefined) {
      alpha = alphaPart.endsWith('%') ? parseFloat(alphaPart) / 100 : parseFloat(alphaPart);
    }
    const color = { r: channel(parts[0]), g: channel(parts[1]), b: channel(parts[2]), a: alpha };
    if ([color.r, color.g, color.b, color.a].some(number => !Number.isFinite(number))) return null;
    return color;
  }
  return null;
}

/** WCAG relative luminance, 0 (black) … 1 (white). */
export function relativeLuminance(color) {
  if (!color) return 0;
  const channel = value => {
    const normalized = Math.min(1, Math.max(0, value / 255));
    return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

/** True for a light colour (used to infer a dark theme from its text colour). */
export function isLightColor(color) {
  return relativeLuminance(color) > 0.5;
}

/** Alpha-composite `front` over an opaque `back`. */
export function compositeOver(front, back) {
  const alpha = Math.min(1, Math.max(0, front.a));
  return {
    r: Math.round(front.r * alpha + back.r * (1 - alpha)),
    g: Math.round(front.g * alpha + back.g * (1 - alpha)),
    b: Math.round(front.b * alpha + back.b * (1 - alpha)),
    a: 1
  };
}

/** `rgb(15, 18, 24)` */
export function colorToCss(color) {
  return color ? `rgb(${color.r}, ${color.g}, ${color.b})` : '';
}

const DARK_SURFACE = { r: 20, g: 22, b: 27, a: 1 };
const LIGHT_SURFACE = { r: 252, g: 252, b: 253, a: 1 };
const DARK_INK = { r: 245, g: 247, b: 251, a: 1 };
const LIGHT_INK = { r: 22, g: 24, b: 29, a: 1 };

/** WCAG contrast ratio between two opaque colours (1 … 21). */
export function contrastRatio(left, right) {
  const a = relativeLuminance(left);
  const b = relativeLuminance(right);
  const high = Math.max(a, b);
  const low = Math.min(a, b);
  return (high + 0.05) / (low + 0.05);
}

/**
 * Pick a solid surface for text of a known colour.
 *
 * This is the reliable half of the readability fix: the theme's *tokens* cannot
 * be trusted here (the liquid-glass theme resolves them differently from what
 * the page actually paints: a real report had a white card carrying the dark
 * theme's pale-blue text). The *computed* text colour, on the other hand, is
 * exactly what the user sees, so the surface is chosen as its opposite pole.
 *
 * @param {string} textColor any CSS colour string, e.g. the computed `color`
 * @returns {{ background: string, ink: string, ratio: number } | null}
 *   `null` when the colour cannot be parsed (the caller keeps the CSS fallback)
 */
export function contrastSurfaceFor(textColor) {
  const text = parseColor(textColor);
  if (!text) return null;
  const lightText = isLightColor(text);
  const background = lightText ? DARK_SURFACE : LIGHT_SURFACE;
  const ink = lightText ? DARK_INK : LIGHT_INK;
  const ratio = Math.round(contrastRatio(text, background) * 10) / 10;
  return { background: colorToCss(background), ink: colorToCss(ink), ratio };
}
