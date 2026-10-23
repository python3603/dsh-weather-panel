/**
 * 历史气温曲线（折线，不是 K 线）：近 7 / 30 天的日最高、日最低与平均。
 *
 * 坐标系是**精确**的：SVG 只画线、温度带和网格（横向拉伸不影响几何），
 * 所有文字和点位都用 HTML 按同一套坐标函数定位——SVG 高度固定 160px，
 * 所以 y 直接按像素落位，x 用百分比，比例永远与数据一致。
 * 每个点都有自己的圆点与 `<title>`，悬停能看到当天精确数值。
 */

const HISTORY_CACHE_TTL_MS = 10 * 60 * 1000;
let historyCacheInstance = null;
function historyCache() {
  if (!historyCacheInstance) {
    historyCacheInstance = createTtlCache(getPanelStorage(), `${PANEL_ID}:history:`, () => Date.now());
  }
  return historyCacheInstance;
}

const HISTORY_W = 660;
const HISTORY_H = 160;
const HISTORY_TOP = 12;
const HISTORY_BOTTOM = 22;
const HISTORY_AXIS_H = 16;

/** 把区间切成 3~5 个「好看」的刻度值（1 / 2 / 5 × 10ⁿ 步长）。 */
function historyTicks(low, high) {
  const range = Math.max(0.5, high - low);
  const raw = range / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const candidates = [1, 2, 2.5, 5, 10];
  let step = magnitude;
  for (const candidate of candidates) {
    if (candidate * magnitude >= raw) {
      step = candidate * magnitude;
      break;
    }
  }
  const ticks = [];
  const start = Math.ceil(low / step) * step;
  for (let value = start; value <= high + 1e-9; value += step) {
    ticks.push(Number(value.toFixed(2)));
  }
  // 两端补上极值，保证最高/最低点一定有刻度可对。
  if (!ticks.includes(Number(high.toFixed(2)))) ticks.push(Number(high.toFixed(2)));
  if (!ticks.includes(Number(low.toFixed(2)))) ticks.push(Number(low.toFixed(2)));
  return ticks.sort((left, right) => left - right);
}

function HistoryChart(props) {
  const { rows, units, lang, label } = props;
  const list = Array.isArray(rows) ? rows.filter(row => isNumber(row.max) || isNumber(row.min)) : [];
  if (list.length === 0) return null;

  const values = [];
  list.forEach(row => {
    if (isNumber(row.max)) values.push(row.max);
    if (isNumber(row.min)) values.push(row.min);
  });
  if (values.length === 0) return null;

  const high = Math.max(...values);
  const low = Math.min(...values);
  const span = Math.max(1, high - low);
  const plotWidth = HISTORY_W;
  const plotHeight = HISTORY_H - HISTORY_TOP - HISTORY_BOTTOM;

  const xFor = index => plotWidth * (list.length === 1 ? 0.5 : index / (list.length - 1));
  const yFor = value => HISTORY_TOP + plotHeight * (1 - (value - low) / span);
  const xPct = index => `${((xFor(index) / HISTORY_W) * 100).toFixed(3)}%`;

  const line = key => list
    .map((row, index) => (isNumber(row[key]) ? `${xFor(index).toFixed(1)},${yFor(row[key]).toFixed(1)}` : null))
    .filter(Boolean)
    .join(' ');

  const bandPoints = [];
  const bandBack = [];
  list.forEach((row, index) => {
    if (isNumber(row.max) && isNumber(row.min)) {
      bandPoints.push(`${xFor(index).toFixed(1)},${yFor(row.max).toFixed(1)}`);
      bandBack.unshift(`${xFor(index).toFixed(1)},${yFor(row.min).toFixed(1)}`);
    }
  });
  const band = bandPoints.length > 1 ? bandPoints.concat(bandBack).join(' ') : '';

  const ticks = historyTicks(low, high);
  // 7 天每天标注；30 天等距抽稀，但最后一天一定标出来。
  const labelStep = list.length <= 10 ? 1 : Math.ceil(list.length / 7);
  const xLabelIndexes = list
    .map((row, index) => index)
    .filter(index => index % labelStep === 0 || index === list.length - 1);

  const grid = ticks.map(value => h('line', {
    key: `grid-${value}`,
    x1: 0,
    x2: HISTORY_W,
    y1: yFor(value).toFixed(1),
    y2: yFor(value).toFixed(1),
    className: 'dshw-history-grid'
  }));

  const dots = [];
  list.forEach((row, index) => {
    ['max', 'min'].forEach(key => {
      if (!isNumber(row[key])) return;
      dots.push(h('span', {
        key: `dot-${key}-${row.date}`,
        className: `dshw-history-dot dshw-history-dot-${key}`,
        style: { left: xPct(index), top: `${yFor(row[key]).toFixed(1)}px` },
        title: `${formatMonthDay(row.date, lang)} · ${key === 'max' ? props.highLabel : props.lowLabel} `
          + `${formatTemperature(row[key], units)}`
      }));
    });
  });

  return h('div', { className: 'dshw-history-canvas' },
    h('div', { className: 'dshw-history-axis-y', 'aria-hidden': 'true' },
      ticks.map(value => h('span', {
        key: `y-${value}`,
        style: { top: `${yFor(value).toFixed(1)}px` }
      }, formatTemperature(value, units)))
    ),
    h('div', { className: 'dshw-history-plot' },
      h('svg', {
        className: 'dshw-history-svg',
        viewBox: `0 0 ${HISTORY_W} ${HISTORY_H}`,
        preserveAspectRatio: 'none',
        role: 'img',
        'aria-label': label || ''
      },
        grid,
        band ? h('polygon', { className: 'dshw-history-band', points: band }) : null,
        h('polyline', { className: 'dshw-history-max', points: line('max') }),
        h('polyline', { className: 'dshw-history-min', points: line('min') })
      ),
      dots,
      h('div', { className: 'dshw-history-axis-x' },
        xLabelIndexes.map(index => h('span', {
          key: `x-${list[index].date}`,
          className: `dshw-history-tick${index === 0 ? ' dshw-history-tick-start' : index === list.length - 1 ? ' dshw-history-tick-end' : ''}`,
          style: { left: xPct(index) }
        }, formatMonthDay(list[index].date, lang)))
      )
    )
  );
}

function HistoryCard(props) {
  const { t, lang, units, location, timezone } = props;
  const [range, setRange] = React.useState(HISTORY_DEFAULT_RANGE);
  const [status, setStatus] = React.useState('loading');
  const [rows, setRows] = React.useState([]);
  const lat = location ? location.lat : null;
  const lon = location ? location.lon : null;
  const cacheKey = isNumber(lat) && isNumber(lon) ? `${lat.toFixed(3)},${lon.toFixed(3)},${range}` : '';

  React.useEffect(() => {
    if (!isNumber(lat) || !isNumber(lon)) return undefined;
    const cached = historyCache().get(cacheKey);
    if (Array.isArray(cached) && cached.length > 0) {
      setRows(cached);
      setStatus('ready');
      return undefined;
    }
    let alive = true;
    const controller = new AbortController();
    setStatus('loading');

    const load = async () => {
      for (const host of HISTORY_HOSTS) {
        try {
          const res = await fetch(buildHistoryUrl(host, lat, lon, range, { timezone }), { signal: controller.signal });
          if (!res.ok) throw new Error(String(res.status));
          const payload = await res.json();
          const list = normalizeHistory(payload, range);
          if (list.length > 0) return list;
        } catch (error) {
          if (controller.signal.aborted) return [];
        }
      }
      return [];
    };

    load()
      .then(list => {
        if (!alive) return;
        if (list.length > 0) historyCache().set(cacheKey, list, HISTORY_CACHE_TTL_MS);
        setRows(list);
        setStatus(list.length > 0 ? 'ready' : 'empty');
      })
      .catch(() => {
        if (alive) setStatus('error');
      });

    return () => {
      alive = false;
      controller.abort();
    };
  }, [lat, lon, range, timezone, cacheKey]);

  const summary = historySummary(rows);

  return h('section', { className: 'dshw-card dshw-history' },
    h('div', { className: 'dshw-history-head' },
      h('h2', { className: 'dshw-section-title' }, t('history.title')),
      h('div', { className: 'dshw-segmented dshw-segmented-compact', role: 'group', 'aria-label': t('history.title') },
        HISTORY_RANGES.map(days => h('button', {
          type: 'button',
          key: `range-${days}`,
          className: `dshw-seg${range === days ? ' dshw-seg-active' : ''}`,
          'aria-pressed': range === days ? 'true' : 'false',
          onClick: () => setRange(days)
        }, t('history.range', { n: days })))
      )
    ),
    status === 'ready'
      ? h(HistoryChart, {
        rows,
        units,
        lang,
        label: t('history.title'),
        highLabel: t('history.high'),
        lowLabel: t('history.low')
      })
      : null,
    status === 'loading'
      ? h('div', { className: 'dshw-skeleton dshw-history-skeleton' })
      : null,
    status === 'empty' || status === 'error'
      ? h('p', { className: 'dshw-note' }, t(status === 'empty' ? 'history.empty' : 'history.error'))
      : null,
    status === 'ready'
      ? h('div', { className: 'dshw-history-foot' },
        h('span', { className: 'dshw-history-legend' },
          h('i', { className: 'dshw-legend-swatch dshw-legend-max' }), t('history.high'),
          h('i', { className: 'dshw-legend-swatch dshw-legend-min' }), t('history.low')
        ),
        h('span', { className: 'dshw-note' },
          `${t('history.high')} ${formatTemperature(summary.high, units)} · ${t('history.low')} ${formatTemperature(summary.low, units)}`
          + (isNumber(summary.mean) ? ` · ${t('history.mean')} ${formatTemperature(summary.mean, units)}` : '')
        )
      )
      : null,
    h('p', { className: 'dshw-note' }, t('history.note'))
  );
}
