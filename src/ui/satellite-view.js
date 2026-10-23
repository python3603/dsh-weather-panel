/**
 * 卫星云图页：只做国内官方源 —— 国家卫星气象中心（NSMC）。
 *
 * 每个产品都有一份 XML 清单：
 *   https://img.nsmc.org.cn/PORTAL/NSMC/XML/<GROUP>/<NAME>.xml
 * 里面逐帧列 `<image time="…" url="//img.nsmc.org.cn/…">`，实测清单带
 * `Access-Control-Allow-Origin: *`，图片本身也能直连。
 */

const NSMC_CACHE_TTL_MS = 5 * 60 * 1000;
let nsmcCacheInstance = null;
function nsmcCache() {
  if (!nsmcCacheInstance) {
    nsmcCacheInstance = createTtlCache(getPanelStorage(), `${PANEL_ID}:nsmc:`, () => Date.now());
  }
  return nsmcCacheInstance;
}

function SatelliteView(props) {
  const { t, lang } = props;
  const [productId, setProductId] = React.useState(NSMC_PRODUCTS[0].id);
  const [frames, setFrames] = React.useState([]);
  const [status, setStatus] = React.useState('loading');
  const [index, setIndex] = React.useState(0);
  const [zoomed, setZoomed] = React.useState(false);
  const [loadedUrl, setLoadedUrl] = React.useState('');

  const product = nsmcProduct(productId);

  React.useEffect(() => {
    const cached = nsmcCache().get(productId);
    if (Array.isArray(cached) && cached.length > 0) {
      setFrames(cached);
      setStatus('ready');
      setIndex(0);
      return undefined;
    }
    let alive = true;
    const controller = new AbortController();
    setStatus('loading');
    setFrames([]);
    setIndex(0);

    fetch(nsmcManifestUrl(product), { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error(String(res.status));
        return res.text();
      })
      .then(text => {
        if (!alive) return;
        const list = parseNsmcManifest(text);
        if (list.length > 0) nsmcCache().set(productId, list, NSMC_CACHE_TTL_MS);
        setFrames(list);
        setStatus(list.length > 0 ? 'ready' : 'empty');
      })
      .catch(() => {
        if (alive) setStatus('error');
      });

    return () => {
      alive = false;
      controller.abort();
    };
  }, [productId]);

  const safeIndex = Math.min(index, Math.max(0, frames.length - 1));
  const frame = frames[safeIndex] || null;
  const url = frame ? frame.url : '';
  const when = frame ? formatNsmcTime(frame.time, lang) : '';
  const meta = frame ? `${nsmcProductName(product, lang)} · ${when}` : '';
  const isLoaded = Boolean(url) && loadedUrl === url;

  const step = delta => {
    const next = Math.min(frames.length - 1, Math.max(0, safeIndex + delta));
    setIndex(next);
  };

  return h('section', { className: 'dshw-card dshw-sat' },
    h('div', { className: 'dshw-sat-head' },
      h('h2', { className: 'dshw-section-title' }, t('sat.title')),
      h('span', { className: 'dshw-note' }, t('sat.source'))
    ),
    h('div', { className: 'dshw-sat-controls' },
      h('label', { className: 'dshw-sat-field' },
        h('span', { className: 'dshw-note' }, t('sat.product')),
        h('select', {
          className: 'dshw-radar-select',
          value: productId,
          onChange: event => setProductId(event.target.value),
          'aria-label': t('sat.product')
        }, NSMC_PRODUCTS.map(item => h('option', { key: item.id, value: item.id },
          nsmcProductName(item, lang)
        )))
      ),
      h('div', { className: 'dshw-sat-field' },
        h('span', { className: 'dshw-note' }, t('sat.time')),
        h('strong', { className: 'dshw-radar-clock' }, when || '—')
      )
    ),
    frames.length > 1
      ? h('div', { className: 'dshw-radar-scrub' },
        h('button', {
          type: 'button',
          className: 'dshw-btn dshw-btn-icon',
          onClick: () => step(1),
          disabled: safeIndex >= frames.length - 1,
          title: t('sat.prev'),
          'aria-label': t('sat.prev')
        }, '‹'),
        h('input', {
          className: 'dshw-radar-range',
          type: 'range',
          min: 0,
          max: Math.max(0, frames.length - 1),
          step: 1,
          value: safeIndex,
          'aria-label': t('sat.time'),
          onChange: event => setIndex(Number(event.target.value) || 0)
        }),
        h('button', {
          type: 'button',
          className: 'dshw-btn dshw-btn-icon',
          onClick: () => step(-1),
          disabled: safeIndex <= 0,
          title: t('sat.next'),
          'aria-label': t('sat.next')
        }, '›'),
        h('button', {
          type: 'button',
          className: 'dshw-btn',
          onClick: () => setIndex(0)
        }, t('radar.latest'))
      )
      : null,
    h('div', { className: `dshw-media-frame${isLoaded ? ' dshw-media-frame-ready' : ''}` },
      isLoaded ? null : h('div', { className: 'dshw-media-skeleton', 'aria-hidden': 'true' }),
      status === 'loading'
        ? h('p', { className: 'dshw-note dshw-media-broken' }, t('sat.loading'))
        : null,
      status === 'empty' || status === 'error'
        ? h('p', { className: 'dshw-note dshw-media-broken' }, t(status === 'empty' ? 'sat.empty' : 'sat.error'))
        : null,
      url
        ? h('button', {
          type: 'button',
          className: 'dshw-media-link',
          onClick: () => setZoomed(true),
          title: t('sat.zoomHint'),
          'aria-label': t('sat.zoomHint')
        }, h('img', {
          key: url,
          className: 'dshw-media-img',
          src: url,
          alt: meta,
          referrerPolicy: 'no-referrer',
          loading: 'eager',
          decoding: 'async',
          onLoad: () => setLoadedUrl(url),
          onError: () => setLoadedUrl('')
        }))
        : null
    ),
    h(MediaZoom, { open: zoomed, url, alt: meta, meta, t, onClose: () => setZoomed(false) }),
    h('div', { className: 'dshw-radar-foot' },
      h('span', { className: 'dshw-note' }, t('sat.note')),
      h('a', {
        className: 'dshw-link',
        href: 'https://www.nsmc.org.cn/nsmc/cn/image/index.html',
        target: '_blank',
        rel: 'noreferrer noopener'
      }, t('sat.official'))
    )
  );
}
