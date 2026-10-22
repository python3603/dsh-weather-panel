/**
 * Inline SVG artwork for the panel.
 *
 * Two rules keep these safe next to other plugins:
 * - UI glyphs (`RefreshGlyph`, `PanelNavIcon`, …) inherit `currentColor`, so
 *   they follow the host theme without any token guessing.
 * - Weather artwork uses its own palette on purpose: it is illustration, not
 *   chrome, and it must read the same in light and dark themes.
 */

const WEATHER_PALETTE = {
  sun: '#f6b93b',
  sunCore: '#ffd166',
  moon: '#c7d3e3',
  moonCore: '#eef3fa',
  cloud: '#91a4bf',
  cloudSoft: '#c3d0e2',
  cloudDark: '#6f8199',
  rain: '#4f9cf9',
  snow: '#dbe7f6',
  bolt: '#f5b942',
  fog: '#93a3b8'
};

function svgRoot(extra) {
  return {
    viewBox: '0 0 64 64',
    width: extra && extra.size ? extra.size : 64,
    height: extra && extra.size ? extra.size : 64,
    role: 'img',
    focusable: 'false',
    style: { display: 'block', flex: 'none' }
  };
}

function cloudGroup(color, transform) {
  return h('g', transform ? { transform } : null,
    h('circle', { cx: 24, cy: 36, r: 9, fill: color }),
    h('circle', { cx: 34, cy: 32, r: 11, fill: color }),
    h('circle', { cx: 42, cy: 38, r: 8, fill: color }),
    h('rect', { x: 18, y: 39, width: 28, height: 9, rx: 4.5, fill: color })
  );
}

function sunRays(cx, cy, inner, outer, color) {
  const rays = [];
  for (let index = 0; index < 8; index += 1) {
    const angle = (Math.PI / 4) * index;
    const x1 = cx + Math.cos(angle) * inner;
    const y1 = cy + Math.sin(angle) * inner;
    const x2 = cx + Math.cos(angle) * outer;
    const y2 = cy + Math.sin(angle) * outer;
    rays.push(h('path', {
      key: `ray-${index}`,
      d: `M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}`,
      stroke: color,
      strokeWidth: 3.4,
      strokeLinecap: 'round'
    }));
  }
  return h('g', null, rays);
}

function rainLines(color, count, slanted) {
  const lines = [];
  for (let index = 0; index < count; index += 1) {
    const x = 24 + index * 8;
    const drift = slanted ? 2.5 : 0;
    lines.push(h('path', {
      key: `drop-${index}`,
      d: `M${x} 50l-${drift} ${slanted ? 8 : 6}`,
      stroke: color,
      strokeWidth: 3.2,
      strokeLinecap: 'round'
    }));
  }
  return h('g', null, lines);
}

function snowFlakes(color, count) {
  const flakes = [];
  for (let index = 0; index < count; index += 1) {
    const x = 24 + index * 8;
    flakes.push(h('g', { key: `flake-${index}`, stroke: color, strokeWidth: 2.4, strokeLinecap: 'round' },
      h('path', { d: `M${x} 50v7` }),
      h('path', { d: `M${x - 2.6} 51.8l5.2 3.4` }),
      h('path', { d: `M${x + 2.6} 51.8l-5.2 3.4` })
    ));
  }
  return h('g', null, flakes);
}

function fogLines(color) {
  return h('g', { stroke: color, strokeWidth: 3.2, strokeLinecap: 'round' },
    h('path', { d: 'M20 50h24' }),
    h('path', { d: 'M24 56h20' })
  );
}

function boltShape(color) {
  return h('path', {
    d: 'M33 46l-7 12h5.2l-2.6 8 10.4-13h-5.4l3.4-7z',
    fill: color,
    stroke: color,
    strokeWidth: 1.4,
    strokeLinejoin: 'round'
  });
}

/** Weather artwork for one WMO code. */
function WeatherGlyph(props) {
  const size = props && Number.isFinite(props.size) ? props.size : 64;
  const icon = weatherIconFor(props && props.code, props && props.isDay);
  const root = svgRoot({ size });
  const palette = WEATHER_PALETTE;
  let body = null;

  switch (icon) {
    case 'sun':
      body = h('g', null,
        sunRays(32, 32, 17, 25, palette.sun),
        h('circle', { cx: 32, cy: 32, r: 12.5, fill: palette.sunCore }),
        h('circle', { cx: 32, cy: 32, r: 9.5, fill: palette.sun, opacity: 0.55 })
      );
      break;
    case 'moon':
      body = h('g', null,
        h('path', {
          d: 'M37.5 12.5a19 19 0 1 0 12 27.5A15.5 15.5 0 0 1 37.5 12.5Z',
          fill: palette.moon
        }),
        h('path', {
          d: 'M33.5 21.5a12 12 0 0 1 8.5 17.4A13.5 13.5 0 0 1 33.5 21.5Z',
          fill: palette.moonCore,
          opacity: 0.55
        })
      );
      break;
    case 'mostly-clear':
      body = h('g', null,
        h('g', { transform: 'translate(9 -7) scale(0.78)' },
          sunRays(32, 32, 17, 25, palette.sun),
          h('circle', { cx: 32, cy: 32, r: 12.5, fill: palette.sunCore })
        ),
        cloudGroup(palette.cloudSoft)
      );
      break;
    case 'partly-cloudy':
      body = h('g', null,
        h('g', { transform: 'translate(13 -9) scale(0.7)' },
          sunRays(32, 32, 17, 24, palette.sun),
          h('circle', { cx: 32, cy: 32, r: 12.5, fill: palette.sunCore })
        ),
        cloudGroup(palette.cloud)
      );
      break;
    case 'overcast':
      body = h('g', null,
        h('g', { transform: 'translate(-4 -8) scale(0.82)' }, cloudGroup(palette.cloudSoft)),
        cloudGroup(palette.cloudDark)
      );
      break;
    case 'fog':
      body = h('g', null, cloudGroup(palette.cloudSoft), fogLines(palette.fog));
      break;
    case 'drizzle':
      body = h('g', null, cloudGroup(palette.cloudSoft), rainLines(palette.rain, 2, false));
      break;
    case 'rain':
      body = h('g', null, cloudGroup(palette.cloudDark), rainLines(palette.rain, 3, false));
      break;
    case 'showers':
      body = h('g', null, cloudGroup(palette.cloud), rainLines(palette.rain, 3, true));
      break;
    case 'snow':
      body = h('g', null, cloudGroup(palette.cloudSoft), snowFlakes(palette.snow, 3));
      break;
    case 'sleet':
      body = h('g', null,
        cloudGroup(palette.cloudSoft),
        h('g', { stroke: palette.snow, strokeWidth: 3, strokeLinecap: 'round' },
          h('path', { d: 'M24 50l-2 7' })
        ),
        h('circle', { cx: 36, cy: 54, r: 2.4, fill: palette.snow }),
        h('circle', { cx: 44, cy: 51, r: 2.4, fill: palette.snow })
      );
      break;
    case 'thunder':
      body = h('g', null, cloudGroup(palette.cloudDark), boltShape(palette.bolt));
      break;
    default:
      body = h('g', null, cloudGroup(palette.cloudSoft));
  }

  return h('svg', { ...root, 'aria-hidden': 'true' }, body);
}

/** Sidebar entry icon: 16 px stroke artwork in the host's own colour. */
function PanelNavIcon(props) {
  const size = props && Number.isFinite(props.size) ? props.size : 16;
  return h('svg', {
    viewBox: '0 0 16 16',
    width: size,
    height: size,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.3,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
    focusable: 'false',
    style: { display: 'block' }
  },
    h('circle', { cx: 5.4, cy: 5.4, r: 2.15 }),
    h('path', { d: 'M5.4 1.6v.8M1.6 5.4h.8M2.7 2.7l.6.6M8.1 2.7l-.6.6' }),
    h('path', { d: 'M5.6 13.2h5.1a2.35 2.35 0 0 0 .25-4.7 3.1 3.1 0 0 0-5.9-.95A2.2 2.2 0 0 0 5.6 13.2Z' })
  );
}

function RefreshGlyph(props) {
  const size = props && Number.isFinite(props.size) ? props.size : 15;
  return h('svg', {
    viewBox: '0 0 16 16', width: size, height: size, fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round',
    'aria-hidden': 'true', focusable: 'false', style: { display: 'block' }
  },
    h('path', { d: 'M13 8a5 5 0 1 1-1.6-3.7' }),
    h('path', { d: 'M13 3.4V7h-3.6' })
  );
}

function PinGlyph(props) {
  const size = props && Number.isFinite(props.size) ? props.size : 15;
  return h('svg', {
    viewBox: '0 0 16 16', width: size, height: size, fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round',
    'aria-hidden': 'true', focusable: 'false', style: { display: 'block' }
  },
    h('path', { d: 'M8 14s4.6-4.1 4.6-7.4A4.6 4.6 0 0 0 8 2a4.6 4.6 0 0 0-4.6 4.6C3.4 9.9 8 14 8 14Z' }),
    h('circle', { cx: 8, cy: 6.5, r: 1.7 })
  );
}

function GpsGlyph(props) {
  const size = props && Number.isFinite(props.size) ? props.size : 15;
  return h('svg', {
    viewBox: '0 0 16 16', width: size, height: size, fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round',
    'aria-hidden': 'true', focusable: 'false', style: { display: 'block' }
  },
    h('circle', { cx: 8, cy: 8, r: 2.2 }),
    h('circle', { cx: 8, cy: 8, r: 5.4 }),
    h('path', { d: 'M8 1v2M8 13v2M1 8h2M13 8h2' })
  );
}

function SearchGlyph(props) {
  const size = props && Number.isFinite(props.size) ? props.size : 15;
  return h('svg', {
    viewBox: '0 0 16 16', width: size, height: size, fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round',
    'aria-hidden': 'true', focusable: 'false', style: { display: 'block' }
  },
    h('circle', { cx: 7, cy: 7, r: 4.2 }),
    h('path', { d: 'M10.2 10.2L13.5 13.5' })
  );
}

function CloseGlyph(props) {
  const size = props && Number.isFinite(props.size) ? props.size : 15;
  return h('svg', {
    viewBox: '0 0 16 16', width: size, height: size, fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round',
    'aria-hidden': 'true', focusable: 'false', style: { display: 'block' }
  },
    h('path', { d: 'M4 4l8 8M12 4l-8 8' })
  );
}
