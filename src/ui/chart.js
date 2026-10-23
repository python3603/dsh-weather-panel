/**
 * Hourly precipitation chart (inline SVG, no chart library).
 *
 * Bars = precipitation amount, dashed line = precipitation probability. Both are
 * scaled independently so a 0.4 mm drizzle in a 5% chance hour is still visible.
 * Every bar carries a <title> tooltip, which needs no JS and works on hover.
 */

const CHART_WIDTH = 660;
const CHART_HEIGHT = 126;
const CHART_PAD_TOP = 12;
const CHART_PAD_BOTTOM = 8;
const CHART_PAD_X = 4;

function PrecipitationChart(props) {
  const { hours, units, t } = props;
  const list = Array.isArray(hours) ? hours : [];
  if (list.length === 0) return null;

  const hasRain = list.some(hour => (isNumber(hour.precipitation) && hour.precipitation > 0)
    || (isNumber(hour.precipitationProbability) && hour.precipitationProbability >= 10));
  if (!hasRain) return h('p', { className: 'dshw-note dshw-chart-empty' }, t('chart.empty'));

  const plotWidth = CHART_WIDTH - CHART_PAD_X * 2;
  const plotHeight = CHART_HEIGHT - CHART_PAD_TOP - CHART_PAD_BOTTOM;
  const slot = plotWidth / list.length;
  const barWidth = Math.max(2, Math.min(14, slot * 0.56));
  const amounts = list.map(hour => (isNumber(hour.precipitation) ? hour.precipitation : 0));
  const maxAmount = Math.max(0.5, ...amounts);

  const xFor = index => CHART_PAD_X + slot * (index + 0.5);
  const yForAmount = amount => CHART_PAD_TOP + plotHeight * (1 - Math.min(1, amount / maxAmount));
  const yForChance = chance => CHART_PAD_TOP + plotHeight * (1 - Math.max(0, Math.min(100, chance)) / 100);

  const bars = list.map((hour, index) => {
    const amount = amounts[index];
    const chance = isNumber(hour.precipitationProbability) ? hour.precipitationProbability : 0;
    const x = xFor(index);
    const y = yForAmount(amount);
    const height = Math.max(amount > 0 ? 2 : 1, CHART_PAD_TOP + plotHeight - y);
    const label = [
      formatClock(hour.time),
      `${t('chart.amount')} ${formatPrecipitation(amount, units)}`,
      `${t('chart.chance')} ${Math.round(chance)}%`
    ].join(' · ');
    return h('g', { key: hour.time || index, className: 'dshw-bar-group' },
      h('title', null, label),
      h('rect', {
        x: x - barWidth / 2,
        y: amount > 0 ? y : CHART_PAD_TOP + plotHeight - 1,
        width: barWidth,
        height,
        rx: Math.min(2, barWidth / 2),
        className: amount > 0 ? 'dshw-bar' : 'dshw-bar-empty'
      })
    );
  });

  const probabilityPoints = list
    .map((hour, index) => {
      const chance = isNumber(hour.precipitationProbability) ? hour.precipitationProbability : 0;
      return `${xFor(index).toFixed(1)},${yForChance(chance).toFixed(1)}`;
    })
    .join(' ');

  // Axis labels are HTML, not SVG text. The plot keeps preserveAspectRatio="none"
  // so the bars can stretch with the panel width; text inside that box would be
  // stretched with them (it came out squashed and unevenly spaced).
  const axisTicks = list.map((hour, index) => {
    if (index % 3 !== 0) return null;
    const pct = (xFor(index) / CHART_WIDTH) * 100;
    const align = pct < 4 ? 'start' : (pct > 86 ? 'end' : 'middle');
    return h('span', {
      key: `tick-${index}`,
      className: `dshw-chart-tick dshw-chart-tick-${align}`,
      style: { left: `${pct.toFixed(2)}%` }
    }, index === 0 ? t('hourly.now') : formatClock(hour.time));
  });

  const baseline = h('line', {
    x1: CHART_PAD_X,
    x2: CHART_WIDTH - CHART_PAD_X,
    y1: CHART_PAD_TOP + plotHeight,
    y2: CHART_PAD_TOP + plotHeight,
    className: 'dshw-chart-baseline'
  });

  // Right-hand scale for the dashed probability line: without it the curve had no
  // readable values. Percentages map exactly onto the line's own y positions.
  const chanceTicks = [100, 50, 0].map(value => h('span', {
    key: `chance-${value}`,
    style: { top: `${((yForChance(value) / CHART_HEIGHT) * 100).toFixed(2)}%` }
  }, `${value}%`));

  return h('div', { className: 'dshw-chart' },
    h('div', { className: 'dshw-chart-legend' },
      h('span', { className: 'dshw-legend-item' },
        h('i', { className: 'dshw-legend-swatch dshw-legend-bar' }),
        `${t('chart.amount')} (${units === 'imperial' ? 'in' : 'mm'})`
      ),
      h('span', { className: 'dshw-legend-item' },
        h('i', { className: 'dshw-legend-swatch dshw-legend-line' }),
        `${t('chart.chance')} (%)`
      )
    ),
    h('div', { className: 'dshw-chart-plot' },
      h('svg', {
        className: 'dshw-chart-svg',
        viewBox: `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`,
        preserveAspectRatio: 'none',
        role: 'img',
        'aria-label': t('chart.title')
      },
        baseline,
        bars,
        h('polyline', { className: 'dshw-chart-line', points: probabilityPoints })
      ),
      h('div', { className: 'dshw-chart-axis', 'aria-hidden': 'true' }, axisTicks),
      h('div', { className: 'dshw-chart-axis-y', 'aria-hidden': 'true' }, chanceTicks)
    )
  );
}
