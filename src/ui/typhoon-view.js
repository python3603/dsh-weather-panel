/**
 * Typhoon track view (inline SVG, no map library).
 *
 * There is deliberately no tile layer: a plugin should not hammer a tile service
 * or depend on one more third party. Instead the track is drawn on an
 * equirectangular graticule with a few reference cities, which is enough to read
 * where a system is going and keeps the whole view self-contained.
 *
 * The projection corrects longitude by `cos(midLatitude)` so the shape is not
 * stretched, exactly like a small-scale chart should be.
 */

const TYPHOON_MAP_WIDTH = 660;
const TYPHOON_MAP_HEIGHT = 420;
const TYPHOON_MAP_PAD = 34;

const TYPHOON_REFERENCE_CITIES = [
  { zh: '上海', en: 'Shanghai', lon: 121.47, lat: 31.23 },
  { zh: '青岛', en: 'Qingdao', lon: 120.38, lat: 36.07 },
  { zh: '厦门', en: 'Xiamen', lon: 118.08, lat: 24.48 },
  { zh: '香港', en: 'Hong Kong', lon: 114.17, lat: 22.32 },
  { zh: '台北', en: 'Taipei', lon: 121.56, lat: 25.03 },
  { zh: '马尼拉', en: 'Manila', lon: 120.98, lat: 14.60 },
  { zh: '东京', en: 'Tokyo', lon: 139.69, lat: 35.69 },
  { zh: '关岛', en: 'Guam', lon: 144.79, lat: 13.44 }
];

/** Build a lon/lat → x/y projector that fits the bounds into the canvas. */
function createProjection(bounds) {
  const midLat = (bounds.south + bounds.north) / 2;
  const cosLat = Math.max(0.2, Math.cos((midLat * Math.PI) / 180));
  const spanX = (bounds.east - bounds.west) * cosLat;
  const spanY = bounds.north - bounds.south;
  const usableW = TYPHOON_MAP_WIDTH - TYPHOON_MAP_PAD * 2;
  const usableH = TYPHOON_MAP_HEIGHT - TYPHOON_MAP_PAD * 2;
  const scale = Math.min(usableW / spanX, usableH / spanY);
  const offsetX = (TYPHOON_MAP_WIDTH - spanX * scale) / 2;
  const offsetY = (TYPHOON_MAP_HEIGHT - spanY * scale) / 2;
  return {
    x: lon => offsetX + (lon - bounds.west) * cosLat * scale,
    y: lat => offsetY + (bounds.north - lat) * scale,
    scale,
    cosLat
  };
}

function graticuleFor(bounds, project) {
  const lines = [];
  const startLon = Math.ceil(bounds.west / 10) * 10;
  for (let lon = startLon; lon <= bounds.east; lon += 10) {
    const x = project.x(lon);
    lines.push(h('g', { key: `lon-${lon}` },
      h('line', { x1: x, x2: x, y1: TYPHOON_MAP_PAD, y2: TYPHOON_MAP_HEIGHT - TYPHOON_MAP_PAD, className: 'dshw-grid-line' }),
      h('text', { x, y: TYPHOON_MAP_HEIGHT - TYPHOON_MAP_PAD + 12, className: 'dshw-grid-label', textAnchor: 'middle' }, `${lon}°E`)
    ));
  }
  const startLat = Math.ceil(bounds.south / 10) * 10;
  for (let lat = startLat; lat <= bounds.north; lat += 10) {
    const y = project.y(lat);
    lines.push(h('g', { key: `lat-${lat}` },
      h('line', { x1: TYPHOON_MAP_PAD, x2: TYPHOON_MAP_WIDTH - TYPHOON_MAP_PAD, y1: y, y2: y, className: 'dshw-grid-line' }),
      h('text', { x: TYPHOON_MAP_PAD - 6, y: y + 3, className: 'dshw-grid-label', textAnchor: 'end' }, `${lat}°N`)
    ));
  }
  return lines;
}

function referenceCities(bounds, project, lang) {
  return TYPHOON_REFERENCE_CITIES
    .filter(city => city.lon >= bounds.west && city.lon <= bounds.east && city.lat >= bounds.south && city.lat <= bounds.north)
    .map(city => {
      const x = project.x(city.lon);
      const y = project.y(city.lat);
      return h('g', { key: `city-${city.en}`, className: 'dshw-ref-city' },
        h('circle', { cx: x, cy: y, r: 2.2 }),
        h('text', { x: x + 4, y: y + 3 }, lang === 'en' ? city.en : city.zh)
      );
    });
}

function windRadiusRings(latest, project) {
  if (!latest || !Array.isArray(latest.windRadii)) return [];
  const kmPerDegLat = 111.32;
  const cx = project.x(latest.lon);
  const cy = project.y(latest.lat);
  // Colour carries the wind-force grade (7 / 10 / 12), matching the legend; the
  // rings stay outline-only so the track underneath is never hidden.
  return latest.windRadii.map((ring, index) => {
    const rx = Math.max(1, (ring.radiusKm / (kmPerDegLat * project.cosLat)) * project.scale);
    const ry = Math.max(1, (ring.radiusKm / kmPerDegLat) * project.scale);
    const color = windRadiusColor(ring.level);
    return h('ellipse', {
      key: `ring-${ring.level || index}`,
      cx,
      cy,
      rx,
      ry,
      style: { stroke: color, fill: color },
      className: `dshw-wind-ring dshw-wind-ring-${index}`
    });
  });
}

/** Label/value pairs for one track point, shared by the card and the detail row. */
function trackPointRows(point, t, lang) {
  const info = describeTrackPoint(point, lang);
  if (!info) return [];
  return [
    { key: 'time', label: lang === 'en' ? 'Time' : '时间', value: info.time || '—' },
    { key: 'intensity', label: lang === 'en' ? 'Intensity' : '强度', value: info.intensity, color: info.color },
    { key: 'position', label: lang === 'en' ? 'Position' : '位置', value: info.position },
    { key: 'pressure', label: t('typhoon.pressure'), value: isNumber(info.pressure) ? `${info.pressure} hPa` : '—' },
    { key: 'wind', label: t('typhoon.wind'), value: isNumber(info.wind) ? `${info.wind} m/s` : '—' },
    {
      key: 'move',
      label: t('typhoon.move'),
      value: [info.moveDirection, isNumber(info.moveSpeed) ? `${info.moveSpeed} km/h` : ''].filter(Boolean).join(' ') || '—'
    }
  ];
}

function selectedPointDetail(point, t, lang) {
  const rows = trackPointRows(point, t, lang);
  if (rows.length === 0) return null;
  return h('div', { className: 'dshw-typhoon-detail' },
    rows.map(row => h('div', { className: 'dshw-param', key: row.key },
      h('span', { className: 'dshw-param-k' }, row.label),
      h('span', { className: 'dshw-param-v', style: row.color ? { color: row.color } : null }, row.value)
    ))
  );
}

/**
 * The selected fix, floating over the map.
 *
 * A full-size track chart is taller than the viewport, so the detail row below
 * it can sit off-screen; this card is where the click actually becomes visible.
 * It is `pointer-events:none` so it never eats clicks meant for the map; the
 * single action button opts back in.
 */
function TrackPointCard(props) {
  const { point, t, lang, isCurrent, onBackToCurrent } = props;
  const info = describeTrackPoint(point, lang);
  if (!info) return null;
  const secondLine = [
    isNumber(info.pressure) ? `${info.pressure} hPa` : '',
    isNumber(info.wind) ? `${info.wind} m/s` : '',
    [info.moveDirection, isNumber(info.moveSpeed) ? `${info.moveSpeed} km/h` : ''].filter(Boolean).join(' ')
  ].filter(Boolean).join(' · ');
  return h('div', { className: 'dshw-map-card', 'aria-live': 'polite' },
    h('span', { className: 'dshw-map-card-head' },
      h('span', { className: 'dshw-map-card-badge', style: { background: info.color } }, info.intensity),
      h('span', { className: 'dshw-map-card-time' }, info.time || '—'),
      isCurrent
        ? h('span', { className: 'dshw-map-card-chip' }, t('typhoon.latest'))
        : h('button', {
          type: 'button',
          className: 'dshw-map-card-action',
          onClick: onBackToCurrent,
          title: t('typhoon.backToCurrent')
        }, h(RefreshGlyph, { size: 11 }), t('typhoon.backToCurrent'))
    ),
    h('span', { className: 'dshw-map-card-line' }, secondLine || '—'),
    h('span', { className: 'dshw-map-card-line dshw-map-card-pos' }, info.position)
  );
}

function TyphoonLegend(props) {
  const lang = props.lang;
  return h('div', { className: 'dshw-typhoon-legend' },
    TYPHOON_LEVELS.map(level => h('span', { className: 'dshw-legend-item', key: level.code },
      h('i', { className: 'dshw-legend-dot', style: { background: level.color } }),
      lang === 'en' ? level.en : level.zh
    )),
    h('span', { className: 'dshw-legend-sep', 'aria-hidden': 'true' }),
    h('span', { className: 'dshw-legend-item dshw-legend-group' },
      lang === 'en' ? 'Wind rings' : '风圈'
    ),
    Object.keys(WIND_RADIUS_GRADES).map(key => h('span', { className: 'dshw-legend-item', key: `ring-${key}` },
      h('i', { className: 'dshw-legend-ring', style: { borderColor: windRadiusColor(key) } }),
      windRadiusGrade(key, lang)
    ))
  );
}

/**
 * Build one SVG path for every land ring that touches the current view.
 *
 * The rings come from the generated `BASEMAP_LAND` (Natural Earth, public
 * domain): land only, no borders. Rendering them with the same projection as the
 * track keeps the coastline and the track aligned, and skipping rings outside
 * the view keeps the DOM to a single <path>.
 */
function landPathFor(bounds, project) {
  let path = '';
  for (const ring of BASEMAP_LAND) {
    if (ring[2] < bounds.west || ring[0] > bounds.east || ring[3] < bounds.south || ring[1] > bounds.north) continue;
    let ringPath = '';
    for (let index = 4; index < ring.length; index += 2) {
      const x = project.x(ring[index]).toFixed(1);
      const y = project.y(ring[index + 1]).toFixed(1);
      ringPath += `${index === 4 ? 'M' : 'L'}${x} ${y}`;
    }
    if (ringPath) path += `${ringPath}Z`;
  }
  return path;
}

/** The typhoon tab body. */
function TyphoonView(props) {
  const { typhoon, typhoonList, t, lang, onSelectTyphoon } = props;
  const [selectedIndex, setSelectedIndex] = React.useState(-1);

  React.useEffect(() => {
    setSelectedIndex(-1);
  }, [typhoon && typhoon.id]);

  // The projection and the (several-kilobyte) land path only depend on the
  // track, so they are computed once per typhoon instead of per render — a click
  // on a track point re-renders the view and must not rebuild the coastline.
  const geometry = React.useMemo(() => {
    if (!typhoon) return null;
    const viewBounds = trackBounds(typhoon, 3);
    if (!viewBounds) return null;
    const viewProjection = createProjection(viewBounds);
    return { bounds: viewBounds, project: viewProjection, land: landPathFor(viewBounds, viewProjection) };
  }, [typhoon]);

  if (!typhoon) {
    return h('section', { className: 'dshw-card' },
      h('p', { className: 'dshw-note' }, t('typhoon.none'))
    );
  }

  if (!geometry) {
    return h('section', { className: 'dshw-card' },
      h('p', { className: 'dshw-note' }, t('typhoon.none'))
    );
  }

  const bounds = geometry.bounds;
  const project = geometry.project;
  const points = typhoon.points || [];
  const forecast = typhoon.forecast || [];
  const latest = typhoon.latest || points[points.length - 1];
  const latestLevel = describeTyphoonIntensity(latest && latest.intensity, lang);
  const peak = peakIntensity(typhoon);
  const active = typhoon.status === 'start';
  const selected = selectedIndex >= 0 && selectedIndex < points.length ? points[selectedIndex] : latest;
  const atCurrentFix = isCurrentFix(selectedIndex, points.length);

  const trackPoints = points.map(point => `${project.x(point.lon).toFixed(1)},${project.y(point.lat).toFixed(1)}`).join(' ');
  const forecastPoints = latest
    ? [`${project.x(latest.lon).toFixed(1)},${project.y(latest.lat).toFixed(1)}`]
      .concat(forecast.map(point => `${project.x(point.lon).toFixed(1)},${project.y(point.lat).toFixed(1)}`))
      .join(' ')
    : '';

  const trackDots = points.map((point, index) => {
    const level = describeTyphoonIntensity(point.intensity, lang);
    const info = describeTrackPoint(point, lang);
    const isSelected = index === selectedIndex || (selectedIndex < 0 && index === points.length - 1);
    const cx = project.x(point.lon);
    const cy = project.y(point.lat);
    return h('g', {
      key: point.id || `point-${index}`,
      className: 'dshw-track-dot',
      onClick: () => setSelectedIndex(index),
      role: 'button',
      tabIndex: 0,
      'aria-label': `${info.time || ''} ${level.label}`.trim(),
      onKeyDown: event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setSelectedIndex(index);
        }
      }
    },
      h('title', null, `${point.timeText} · ${level.label} · ${isNumber(point.pressure) ? Math.round(point.pressure) + ' hPa' : ''}`),
      // Invisible hit area: a 4 px dot is impossible to hit, and points close in
      // time overlap, so the target is deliberately much larger than the dot.
      h('circle', { className: 'dshw-hit', cx, cy, r: 9 }),
      h('circle', { className: 'dshw-track-point', cx, cy, r: isSelected ? 6 : 4, fill: level.color }),
      isSelected ? h('circle', { className: 'dshw-track-selected-ring', cx, cy, r: 10 }) : null
    );
  });

  const forecastDots = forecast.map((point, index) => {
    const level = describeTyphoonIntensity(point.intensity, lang);
    return h('g', { key: `fc-${index}`, className: 'dshw-forecast-dot' },
      h('title', null, `+${point.hour}h · ${level.label}`),
      h('circle', { cx: project.x(point.lon), cy: project.y(point.lat), r: 3.4, stroke: level.color }),
      index % 2 === 0
        ? h('text', { x: project.x(point.lon) + 5, y: project.y(point.lat) - 4, className: 'dshw-forecast-label' }, `+${point.hour}h`)
        : null
    );
  });

  const latestMarker = latest
    ? h('g', { className: 'dshw-latest-marker' },
      h('circle', { cx: project.x(latest.lon), cy: project.y(latest.lat), r: 11, className: 'dshw-latest-ring' }),
      h('circle', { cx: project.x(latest.lon), cy: project.y(latest.lat), r: 3.2, fill: latestLevel.color })
    )
    : null;

  // Crosshair through the selected fix: the click has to be visible on the map
  // itself, not only in a card that may be scrolled out of view.
  const crosshair = selected
    ? h('g', { className: 'dshw-crosshair' },
      h('line', { x1: 0, x2: TYPHOON_MAP_WIDTH, y1: project.y(selected.lat), y2: project.y(selected.lat) }),
      h('line', { x1: project.x(selected.lon), x2: project.x(selected.lon), y1: 0, y2: TYPHOON_MAP_HEIGHT })
    )
    : null;

  return h('div', { className: 'dshw-typhoon' },
    h('section', { className: 'dshw-card dshw-typhoon-head' },
      h('div', { className: 'dshw-typhoon-title-row' },
        h('div', { className: 'dshw-typhoon-name' },
          h('strong', null, typhoon.nameZh || typhoon.nameEn || `#${typhoon.id}`),
          h('span', { className: 'dshw-chip' }, formatTyphoonNumber(typhoon.number, lang)),
          h('span', { className: `dshw-chip ${active ? 'dshw-chip-active' : ''}` }, active ? t('typhoon.active') : t('typhoon.ended'))
        ),
        typhoonList && typhoonList.length > 1
          ? h('label', { className: 'dshw-typhoon-select' },
            h('span', { className: 'dshw-note' }, t('typhoon.select')),
            h('select', {
              className: 'dshw-select',
              value: typhoon.id,
              onChange: event => onSelectTyphoon && onSelectTyphoon(Number(event.target.value))
            }, typhoonList.slice(0, 12).map(item => h('option', { key: item.id, value: item.id },
              `${item.nameZh || item.nameEn} ${formatTyphoonNumber(item.number, lang)}`
            )))
          )
          : null,
        h('a', {
          className: 'dshw-btn',
          href: 'https://typhoon.nmc.cn/web.html',
          target: '_blank',
          rel: 'noreferrer noopener'
        }, t('typhoon.official'))
      ),
      h('div', { className: 'dshw-typhoon-stats' },
        h('div', { className: 'dshw-param' },
          h('span', { className: 'dshw-param-k' }, t('typhoon.latest')),
          h('span', { className: 'dshw-param-v' }, latest && latest.timeText ? latest.timeText : '—')
        ),
        h('div', { className: 'dshw-param' },
          h('span', { className: 'dshw-param-k' }, lang === 'en' ? 'Intensity' : '强度'),
          h('span', { className: 'dshw-param-v', style: { color: latestLevel.color } }, latestLevel.label)
        ),
        h('div', { className: 'dshw-param' },
          h('span', { className: 'dshw-param-k' }, t('typhoon.pressure')),
          h('span', { className: 'dshw-param-v' }, latest && isNumber(latest.pressure) ? `${Math.round(latest.pressure)} hPa` : '—')
        ),
        h('div', { className: 'dshw-param' },
          h('span', { className: 'dshw-param-k' }, t('typhoon.wind')),
          h('span', { className: 'dshw-param-v' }, latest && isNumber(latest.wind) ? `${Math.round(latest.wind)} m/s` : '—')
        ),
        h('div', { className: 'dshw-param' },
          h('span', { className: 'dshw-param-k' }, t('typhoon.peak')),
          h('span', { className: 'dshw-param-v', style: { color: peak.color } }, peak.label)
        ),
        h('div', { className: 'dshw-param' },
          h('span', { className: 'dshw-param-k' }, lang === 'en' ? 'Position' : '位置'),
          h('span', { className: 'dshw-param-v' }, latest ? `${latest.lat.toFixed(1)}°N ${latest.lon.toFixed(1)}°E` : '—')
        )
      ),
      h('p', { className: 'dshw-note' }, t('typhoon.hint'))
    ),

    h('section', { className: 'dshw-card dshw-typhoon-map' },
      h('svg', {
        viewBox: `0 0 ${TYPHOON_MAP_WIDTH} ${TYPHOON_MAP_HEIGHT}`,
        className: 'dshw-typhoon-svg',
        role: 'img',
        'aria-label': t('typhoon.title')
      },
        h('rect', { x: 0, y: 0, width: TYPHOON_MAP_WIDTH, height: TYPHOON_MAP_HEIGHT, className: 'dshw-map-bg' }),
        h('path', { className: 'dshw-land', d: geometry.land }),
        graticuleFor(bounds, project),
        referenceCities(bounds, project, lang),
        windRadiusRings(latest, project),
        crosshair,
        forecastPoints ? h('polyline', { className: 'dshw-forecast-line', points: forecastPoints }) : null,
        trackPoints ? h('polyline', { className: 'dshw-track-line', points: trackPoints }) : null,
        trackDots,
        forecastDots,
        latestMarker
      ),
      h(TrackPointCard, {
        point: selected,
        t,
        lang,
        isCurrent: atCurrentFix,
        onBackToCurrent: () => setSelectedIndex(-1)
      }),
      h(TyphoonLegend, { lang }),
      typhoon.forecastBase
        ? h('p', { className: 'dshw-note' }, `${t('typhoon.forecast')} · ${typhoon.forecastBase}`)
        : null
    ),

    selectedPointDetail(selected, t, lang),

    h('p', { className: 'dshw-note dshw-typhoon-source' },
      [t('typhoon.source'), latest && latest.timeText ? latest.timeText : '', t('typhoon.land')].filter(Boolean).join(' · ')
    )
  );
}

/**
 * Shown when the CMA list carries no active (numbered) typhoon.
 *
 * The most recent ended system is still offered behind a button, because its
 * track is often what people come to look at out of season.
 */
function NoActiveTyphoon(props) {
  const { typhoon, t, lang } = props;
  const [showLast, setShowLast] = React.useState(false);

  if (showLast && typhoon) {
    return h('div', { className: 'dshw-typhoon' },
      h('div', { className: 'dshw-typhoon-nonebar' },
        h('span', { className: 'dshw-note' }, t('typhoon.noActive')),
        h('button', {
          type: 'button',
          className: 'dshw-btn',
          onClick: () => setShowLast(false)
        }, t('typhoon.hideLatest'))
      ),
      h(TyphoonView, {
        typhoon,
        typhoonList: [],
        t,
        lang,
        onSelectTyphoon: () => {}
      })
    );
  }

  return h('section', { className: 'dshw-card dshw-typhoon-empty' },
    h('div', { className: 'dshw-typhoon-empty-icon', 'aria-hidden': 'true' }, '🌀'),
    h('h2', { className: 'dshw-section-title' }, t('typhoon.noActive')),
    h('p', { className: 'dshw-note' }, t('typhoon.noActiveHint')),
    h('div', { className: 'dshw-typhoon-empty-actions' },
      typhoon
        ? h('button', {
          type: 'button',
          className: 'dshw-btn',
          onClick: () => setShowLast(true)
        }, t('typhoon.viewLatest'))
        : null,
      h('a', {
        className: 'dshw-btn',
        href: 'https://typhoon.nmc.cn/web.html',
        target: '_blank',
        rel: 'noreferrer noopener'
      }, t('typhoon.official'))
    )
  );
}