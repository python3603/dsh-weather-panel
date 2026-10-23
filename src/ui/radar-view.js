/**
 * Radar tab: the official CMA radar mosaic product images.
 *
 * The frame list cannot be fetched in the browser (nmc.cn serves no CORS headers
 * on those pages), so the frames are generated from the documented 6-minute
 * cadence and verified by the image itself: a frame that has not been published
 * yet fires `onError`, and the view steps back to the previous one.
 */

const RADAR_MAX_AUTO_STEPS = 6;

function RadarView(props) {
  const { t, lang } = props;
  const [productId, setProductId] = React.useState('chinaall');
  const [index, setIndex] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [failed, setFailed] = React.useState({});
  const [loadedUrl, setLoadedUrl] = React.useState('');
  const [zoomed, setZoomed] = React.useState(false);

  const product = radarProduct(productId);
  const stamps = React.useMemo(
    () => radarStamps(Date.now(), product.frames),
    [product.id, product.frames]
  );
  const safeIndex = Math.min(index, stamps.length - 1);
  const stamp = stamps[safeIndex] || '';
  const url = stamp ? radarImageUrl(product, stamp) : '';
  const when = stamp ? radarBeijingParts(stamp) : null;
  const isBroken = Boolean(failed[stamp]);
  const isLoaded = Boolean(url) && loadedUrl === url;

  React.useEffect(() => {
    if (!playing) return undefined;
    const timer = setInterval(() => {
      setIndex(current => (current + 1 >= stamps.length ? 0 : current + 1));
    }, 650);
    return () => clearInterval(timer);
  }, [playing, stamps.length]);

  React.useEffect(() => {
    setIndex(0);
    setPlaying(false);
    setFailed({});
    setLoadedUrl('');
    setZoomed(false);
  }, [productId]);

  const step = delta => {
    const next = Math.min(stamps.length - 1, Math.max(0, safeIndex + delta));
    setIndex(next);
  };

  const handleLoad = () => setLoadedUrl(url);

  const handleError = () => {
    setLoadedUrl('');
    setFailed(previous => ({ ...previous, [stamp]: true }));
    // Only the newest frames can be "not published yet"; try a few, then stop so
    // the user can pick another time instead of the view chasing broken URLs.
    if (safeIndex < RADAR_MAX_AUTO_STEPS && safeIndex + 1 < stamps.length) {
      setIndex(safeIndex + 1);
    }
  };

  return h('section', { className: 'dshw-card dshw-radar' },
    h('div', { className: 'dshw-radar-head' },
      h('h2', { className: 'dshw-section-title' }, t('radar.title')),
      h('span', { className: 'dshw-note' }, t('radar.source'))
    ),
    h('div', { className: 'dshw-radar-controls' },
      h('label', { className: 'dshw-radar-field' },
        h('span', { className: 'dshw-note' }, t('radar.region')),
        h('select', {
          className: 'dshw-radar-select',
          value: productId,
          onChange: event => setProductId(event.target.value),
          'aria-label': t('radar.region')
        }, RADAR_PRODUCTS.map(item => h('option', { key: item.id, value: item.id },
          radarProductName(item, lang)
        )))
      ),
      h('div', { className: 'dshw-radar-time' },
        h('span', { className: 'dshw-note' }, t('radar.time')),
        h('strong', { className: 'dshw-radar-clock' }, when ? formatRadarStamp(stamp, lang) : '—')
      )
    ),
    h('div', { className: 'dshw-radar-scrub' },
      h('button', {
        type: 'button',
        className: 'dshw-btn dshw-btn-icon',
        onClick: () => step(1),
        disabled: safeIndex >= stamps.length - 1,
        title: t('radar.prev'),
        'aria-label': t('radar.prev')
      }, '‹'),
      h('input', {
        className: 'dshw-radar-range',
        type: 'range',
        min: 0,
        max: Math.max(0, stamps.length - 1),
        step: 1,
        value: safeIndex,
        'aria-label': t('radar.time'),
        onChange: event => setIndex(Number(event.target.value) || 0)
      }),
      h('button', {
        type: 'button',
        className: 'dshw-btn dshw-btn-icon',
        onClick: () => step(-1),
        disabled: safeIndex <= 0,
        title: t('radar.next'),
        'aria-label': t('radar.next')
      }, '›'),
      h('button', {
        type: 'button',
        className: 'dshw-btn',
        onClick: () => setPlaying(value => !value),
        'aria-pressed': playing ? 'true' : 'false'
      }, playing ? t('radar.pause') : t('radar.play')),
      h('button', {
        type: 'button',
        className: 'dshw-btn',
        onClick: () => {
          setPlaying(false);
          setIndex(0);
        }
      }, t('radar.latest'))
    ),
    h('div', { className: `dshw-media-frame${isLoaded ? ' dshw-media-frame-ready' : ''}` },
      isLoaded ? null : h('div', { className: 'dshw-media-skeleton', 'aria-hidden': 'true' }),
      isBroken && !isLoaded
        ? h('p', { className: 'dshw-note dshw-media-broken' }, t('radar.unavailable'))
        : null,
      url
        ? h('button', {
          type: 'button',
          className: 'dshw-media-link',
          onClick: () => setZoomed(true),
          title: t('radar.zoomHint'),
          'aria-label': t('radar.zoomHint')
        }, h('img', {
          key: url,
          className: 'dshw-media-img',
          src: url,
          alt: when ? `${radarProductName(product, lang)} · ${when.day} ${when.clock}` : radarProductName(product, lang),
          referrerPolicy: 'no-referrer',
          loading: 'eager',
          decoding: 'async',
          onLoad: handleLoad,
          onError: handleError
        }))
        : null
    ),
    h('div', { className: 'dshw-radar-foot' },
      h('span', { className: 'dshw-note' }, t('radar.note')),
      h('a', {
        className: 'dshw-link',
        href: radarPageUrl(product),
        target: '_blank',
        rel: 'noreferrer noopener'
      }, t('radar.official'))
    ),
    h(MediaZoom, {
      open: zoomed,
      url,
      alt: when ? `${radarProductName(product, lang)} · ${when.day} ${when.clock}` : radarProductName(product, lang),
      meta: [radarProductName(product, lang), when ? `${when.day} ${when.clock}` : ''].filter(Boolean).join(' · '),
      t,
      onClose: () => setZoomed(false)
    })
  );
}
