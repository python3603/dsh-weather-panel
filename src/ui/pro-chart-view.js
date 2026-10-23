/**
 * 专业栏：西北太平洋海表温度 + ECMWF 中国区域天气图。
 *
 * 图片来自 easterlywave.com 的静态产品目录（该站的 JSON 接口需要 cookie + CSRF
 * 且没有 CORS，浏览器里调不到，所以这里只按命名规则拼图片地址，并用
 * onerror 做「新时次还没出图」的回退）。
 */

function ProChartView(props) {
  const { t, lang } = props;

  const [sstRegionId, setSstRegionId] = React.useState(SST_REGIONS[0].id);
  const [sstDay, setSstDay] = React.useState(0);
  const [sstLoaded, setSstLoaded] = React.useState('');
  const [sstFailed, setSstFailed] = React.useState(false);

  const [ecmwfCodeId, setEcmwfCodeId] = React.useState(ECMWF_CODES[0].id);
  const [runIndex, setRunIndex] = React.useState(0);
  const [hourIndex, setHourIndex] = React.useState(0);
  const [ecmwfLoaded, setEcmwfLoaded] = React.useState('');
  const [ecmwfFailed, setEcmwfFailed] = React.useState(false);

  const [zoom, setZoom] = React.useState(null);

  const runs = React.useMemo(() => ecmwfRuns(Date.now()), []);
  const run = runs[Math.min(runIndex, runs.length - 1)] || '';
  const hour = ECMWF_HOURS[Math.min(hourIndex, ECMWF_HOURS.length - 1)];

  const sstStampValue = sstStamp(sstDay);
  const sstUrl = sstImageUrl(sstRegionId, sstStampValue);
  const sstMeta = `${sstRegionName(sstRegion(sstRegionId), lang)} · ${sstLabel(sstStampValue)}`;

  const ecmwfUrl = ecmwfImageUrl(ecmwfCodeId, run, hour);
  const ecmwfMeta = `${ecmwfCodeName(ecmwfCode(ecmwfCodeId), lang)} · ${ecmwfRunLabel(run)} · +${hour}h`;

  const sstReady = Boolean(sstUrl) && sstLoaded === sstUrl;
  const ecmwfReady = Boolean(ecmwfUrl) && ecmwfLoaded === ecmwfUrl;

  // 海温按日发布，最新一天偶尔还没图 → 自动往前退一天（最多 3 天）。
  const handleSstError = () => {
    setSstLoaded('');
    setSstFailed(true);
    if (sstDay < 3) setSstDay(sstDay + 1);
  };

  // ECMWF 一天两个时次，最新时次常还没出图 → 依次回退。
  const handleEcmwfError = () => {
    setEcmwfLoaded('');
    setEcmwfFailed(true);
    if (runIndex < runs.length - 1) setRunIndex(runIndex + 1);
  };

  const frame = (url, ready, brokenText, alt, onLoad, onError) => h('div', {
    className: `dshw-media-frame${ready ? ' dshw-media-frame-ready' : ''}`
  },
    ready ? null : h('div', { className: 'dshw-media-skeleton', 'aria-hidden': 'true' }),
    !ready && brokenText ? h('p', { className: 'dshw-note dshw-media-broken' }, brokenText) : null,
    url
      ? h('button', {
        type: 'button',
        className: 'dshw-media-link',
        onClick: () => setZoom({ url, meta: alt }),
        title: t('sat.zoomHint'),
        'aria-label': t('sat.zoomHint')
      }, h('img', {
        key: url,
        className: 'dshw-media-img',
        src: url,
        alt,
        referrerPolicy: 'no-referrer',
        loading: 'eager',
        decoding: 'async',
        onLoad,
        onError
      }))
      : null
  );

  return h('div', { className: 'dshw-pro' },
    h('section', { className: 'dshw-card dshw-sat' },
      h('div', { className: 'dshw-sat-head' },
        h('h2', { className: 'dshw-section-title' }, t('pro.sst.title')),
        h('a', { className: 'dshw-link', href: EW_SST_PAGE, target: '_blank', rel: 'noreferrer noopener' }, t('sat.official'))
      ),
      h('div', { className: 'dshw-sat-controls' },
        h('label', { className: 'dshw-sat-field' },
          h('span', { className: 'dshw-note' }, t('pro.sst.region')),
          h('select', {
            className: 'dshw-radar-select',
            value: sstRegionId,
            onChange: event => setSstRegionId(event.target.value),
            'aria-label': t('pro.sst.region')
          }, SST_REGIONS.map(item => h('option', { key: item.id, value: item.id },
            sstRegionName(item, lang)
          )))
        ),
        h('div', { className: 'dshw-sat-field' },
          h('span', { className: 'dshw-note' }, t('pro.sst.date')),
          h('strong', { className: 'dshw-radar-clock' }, sstLabel(sstStampValue))
        )
      ),
      h('div', { className: 'dshw-radar-scrub' },
        h('button', {
          type: 'button',
          className: 'dshw-btn dshw-btn-icon',
          onClick: () => setSstDay(Math.min(SST_DAYS - 1, sstDay + 1)),
          disabled: sstDay >= SST_DAYS - 1,
          title: t('pro.sst.older'),
          'aria-label': t('pro.sst.older')
        }, '‹'),
        h('input', {
          className: 'dshw-radar-range',
          type: 'range',
          min: 0,
          max: SST_DAYS - 1,
          step: 1,
          value: sstDay,
          'aria-label': t('pro.sst.date'),
          onChange: event => setSstDay(Number(event.target.value) || 0)
        }),
        h('button', {
          type: 'button',
          className: 'dshw-btn dshw-btn-icon',
          onClick: () => setSstDay(Math.max(0, sstDay - 1)),
          disabled: sstDay <= 0,
          title: t('pro.sst.newer'),
          'aria-label': t('pro.sst.newer')
        }, '›'),
        h('button', { type: 'button', className: 'dshw-btn', onClick: () => setSstDay(0) }, t('radar.latest'))
      ),
      frame(sstUrl, sstReady, sstFailed ? t('pro.sst.unavailable') : null, sstMeta,
        () => { setSstLoaded(sstUrl); setSstFailed(false); }, handleSstError),
      h('p', { className: 'dshw-note' }, t('pro.sst.note'))
    ),

    h('section', { className: 'dshw-card dshw-sat' },
      h('div', { className: 'dshw-sat-head' },
        h('h2', { className: 'dshw-section-title' }, t('pro.ecmwf.title')),
        h('a', {
          className: 'dshw-link',
          href: ewModelPage(ecmwfCodeId),
          target: '_blank',
          rel: 'noreferrer noopener'
        }, t('sat.official'))
      ),
      h('div', { className: 'dshw-sat-controls' },
        h('label', { className: 'dshw-sat-field' },
          h('span', { className: 'dshw-note' }, t('pro.ecmwf.code')),
          h('select', {
            className: 'dshw-radar-select',
            value: ecmwfCodeId,
            onChange: event => {
              setEcmwfCodeId(event.target.value);
              setEcmwfLoaded('');
            },
            'aria-label': t('pro.ecmwf.code')
          }, ECMWF_CODES.map(item => h('option', { key: item.id, value: item.id },
            ecmwfCodeName(item, lang)
          )))
        ),
        h('div', { className: 'dshw-sat-field' },
          h('span', { className: 'dshw-note' }, t('pro.ecmwf.run')),
          h('strong', { className: 'dshw-radar-clock' }, ecmwfRunLabel(run) || '—')
        ),
        h('div', { className: 'dshw-sat-field' },
          h('span', { className: 'dshw-note' }, t('pro.ecmwf.hour')),
          h('strong', { className: 'dshw-radar-clock' }, `+${hour}h`)
        )
      ),
      h('div', { className: 'dshw-radar-scrub' },
        h('button', {
          type: 'button',
          className: 'dshw-btn dshw-btn-icon',
          onClick: () => setHourIndex(Math.max(0, hourIndex - 1)),
          disabled: hourIndex <= 0,
          title: t('sat.prev'),
          'aria-label': t('sat.prev')
        }, '‹'),
        h('input', {
          className: 'dshw-radar-range',
          type: 'range',
          min: 0,
          max: ECMWF_HOURS.length - 1,
          step: 1,
          value: hourIndex,
          'aria-label': t('pro.ecmwf.hour'),
          onChange: event => setHourIndex(Number(event.target.value) || 0)
        }),
        h('button', {
          type: 'button',
          className: 'dshw-btn dshw-btn-icon',
          onClick: () => setHourIndex(Math.min(ECMWF_HOURS.length - 1, hourIndex + 1)),
          disabled: hourIndex >= ECMWF_HOURS.length - 1,
          title: t('sat.next'),
          'aria-label': t('sat.next')
        }, '›'),
        h('button', {
          type: 'button',
          className: 'dshw-btn',
          onClick: () => {
            setHourIndex(0);
            setRunIndex(0);
          }
        }, t('radar.latest'))
      ),
      frame(ecmwfUrl, ecmwfReady, ecmwfFailed ? t('pro.ecmwf.unavailable') : null, ecmwfMeta,
        () => { setEcmwfLoaded(ecmwfUrl); setEcmwfFailed(false); }, handleEcmwfError),
      h('p', { className: 'dshw-note' }, t('pro.ecmwf.note'))
    ),

    h('p', { className: 'dshw-note dshw-pro-source' }, t('pro.attribution')),

    h(MediaZoom, {
      open: Boolean(zoom && zoom.url),
      url: zoom ? zoom.url : '',
      alt: zoom ? zoom.meta : '',
      meta: zoom ? zoom.meta : '',
      t,
      onClose: () => setZoom(null)
    })
  );
}
