/**
 * The weather panel: data flow, view and styles.
 *
 * Compatibility / performance rules this file follows:
 * - It owns exactly one additive `main` panel and one additive
 *   `sidebar.panellist` entry; it never replaces host UI or reads another
 *   plugin's DOM.
 * - Every style lives in one <style> element rendered by the panel, so nothing
 *   leaks globally and unmounting removes everything.
 * - Only `--dsw-alias-*` theme tokens are used for chrome, so light/dark
 *   switching works without the plugin knowing the theme.
 * - Network work is cached (forecast 10 min, location 6 h), coalesced through
 *   an AbortController, and paused while the document is hidden.
 */

const PANEL_ID = 'dsh-weather-panel';
const SETTINGS_STORAGE_KEY = `${PANEL_ID}:settings`;
const LOCATION_CACHE_KEY = 'resolved';
const LOCATION_TTL_MS = 6 * 60 * 60 * 1000;
const FORECAST_TTL_MS = 10 * 60 * 1000;
const STALE_AFTER_MS = 30 * 60 * 1000;
const AUTO_REFRESH_MS = 10 * 60 * 1000;
const TICK_MS = 60 * 1000;
const REQUEST_TIMEOUT_MS = 12000;
const FORECAST_DAYS_SHOWN = 3;
const DEFAULT_SETTINGS = { units: 'metric', override: null };

let panelStorage = null;
let panelLocationCache = null;
const panelForecastCaches = new Map();

function getPanelStorage() {
  if (!panelStorage) panelStorage = createSafeStorage(`${PANEL_ID}:probe`);
  return panelStorage;
}

function getLocationCache() {
  if (!panelLocationCache) {
    panelLocationCache = createTtlCache(getPanelStorage(), `${PANEL_ID}:location:`, () => Date.now());
  }
  return panelLocationCache;
}

function forecastCacheFor(location) {
  const key = `${Number(location.lat).toFixed(2)},${Number(location.lon).toFixed(2)}`;
  if (!panelForecastCaches.has(key)) {
    panelForecastCaches.set(key, createTtlCache(getPanelStorage(), `${PANEL_ID}:forecast:${key}:`, () => Date.now()));
  }
  return panelForecastCaches.get(key);
}

function readPanelSettings() {
  try {
    const raw = getPanelStorage().getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    const override = parsed && parsed.override && isNumber(parsed.override.lat) && isNumber(parsed.override.lon)
      ? {
        lat: parsed.override.lat,
        lon: parsed.override.lon,
        label: typeof parsed.override.label === 'string' ? parsed.override.label : '',
        source: parsed.override.source === 'gps' ? 'gps' : 'manual'
      }
      : null;
    return { units: parsed && parsed.units === 'imperial' ? 'imperial' : 'metric', override };
  } catch (error) {
    return { ...DEFAULT_SETTINGS };
  }
}

function writePanelSettings(settings) {
  try {
    getPanelStorage().setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    /* best effort: the in-memory state still works */
  }
}

/** JSON fetch with a hard timeout, mapped to the panel's own error vocabulary. */
function fetchJson(url, options) {
  const settings = options || {};
  const externalSignal = settings.signal;
  const controller = new AbortController();
  const abortFromOutside = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', abortFromOutside, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), Number.isFinite(settings.timeoutMs) ? settings.timeoutMs : REQUEST_TIMEOUT_MS);

  return fetch(url, {
    method: 'GET',
    mode: 'cors',
    credentials: 'omit',
    cache: 'no-store',
    redirect: 'follow',
    referrerPolicy: 'no-referrer',
    headers: { accept: 'application/json' },
    signal: controller.signal
  }).then(response => {
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  }).finally(() => {
    clearTimeout(timer);
    if (externalSignal) externalSignal.removeEventListener('abort', abortFromOutside);
  });
}

/** Ask the browser for device location; resolves `{lat, lon, accuracy}`. */
function requestDevicePosition() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      position => resolve({
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        accuracy: position.coords.accuracy
      }),
      error => reject(error),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 }
    );
  });
}

/** Reverse-geocode, falling back to the provider's city and then coordinates. */
async function describeLocation(found, signal, lang) {
  let label = '';
  try {
    const reversed = await reverseGeocode(fetchJson, found.lat, found.lon, { signal, language: lang });
    if (reversed && reversed.label) label = reversed.label;
  } catch (error) {
    label = '';
  }
  if (!label) {
    label = [found.city, found.region].filter(Boolean).join(' · ') || formatCoordinates(found.lat, found.lon);
  }
  return {
    lat: found.lat,
    lon: found.lon,
    label,
    source: found.source || 'network',
    ip: found.ip || '',
    provider: found.provider || '',
    countryCode: found.countryCode || ''
  };
}

/** Error with a tagged kind so the caller can pick the right message. */
function taggedError(kind, cause) {
  const error = cause instanceof Error ? cause : new Error(kind);
  error.kind = kind;
  return error;
}

function describeError(error, translate) {
  if (!error) return translate('error.weather');
  if (error.kind === 'locate') return translate('error.locate');
  if (typeof error.status === 'number') return translate('error.http', { status: error.status });
  if (error.name === 'AbortError') return translate('error.timeout');
  return translate('error.weather');
}

/** Resolve `{lat, lon, label, source}` for the current settings, or throw. */
async function resolveLocation(settings, signal, lang) {
  if (settings.override) return { ...settings.override };
  const cached = getLocationCache().get(LOCATION_CACHE_KEY);
  if (cached && isNumber(cached.lat) && isNumber(cached.lon)) return cached;
  const found = await lookupNetworkLocation(fetchJson, { signal });
  if (!found) throw taggedError('locate');
  const described = await describeLocation(found, signal, lang);
  getLocationCache().set(LOCATION_CACHE_KEY, described, LOCATION_TTL_MS);
  return described;
}

/* ------------------------------------------------------------------ */
/* Data hook                                                          */
/* ------------------------------------------------------------------ */

function useWeatherPanel(translate, lang) {
  const translateRef = React.useRef(translate);
  translateRef.current = translate;
  const langRef = React.useRef(lang);
  langRef.current = lang;

  const [settings, setSettings] = React.useState(readPanelSettings);
  const settingsRef = React.useRef(settings);
  settingsRef.current = settings;

  const [view, setView] = React.useState({
    phase: 'idle',
    busy: false,
    error: null,
    location: null,
    forecast: null,
    updatedAt: null
  });

  const runRef = React.useRef(0);
  const abortRef = React.useRef(null);
  const lastAttemptRef = React.useRef(0);
  const mountedRef = React.useRef(true);

  React.useEffect(() => () => {
    mountedRef.current = false;
    if (abortRef.current) abortRef.current.abort();
  }, []);

  const patchSettings = React.useCallback(patch => {
    setSettings(previous => {
      const next = { ...previous, ...patch };
      settingsRef.current = next;
      writePanelSettings(next);
      return next;
    });
  }, []);

  const load = React.useCallback(async options => {
    const opts = options || {};
    const force = opts.force === true;
    const run = runRef.current + 1;
    runRef.current = run;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    lastAttemptRef.current = Date.now();
    const alive = () => runRef.current === run && mountedRef.current;
    const t = translateRef.current;
    const currentLang = langRef.current;

    setView(previous => ({
      ...previous,
      busy: true,
      error: null,
      phase: previous.forecast ? 'ready' : 'locating'
    }));

    try {
      const currentSettings = settingsRef.current;
      let location = currentSettings.override || getLocationCache().get(LOCATION_CACHE_KEY) || null;

      // Paint whatever is cached before touching the network.
      if (location) {
        const cache = forecastCacheFor(location);
        const cachedForecast = cache.get('latest');
        const savedAt = cache.savedAt('latest');
        if (cachedForecast) {
          if (alive()) {
            setView(previous => ({
              ...previous,
              phase: 'ready',
              location,
              forecast: cachedForecast,
              updatedAt: savedAt
            }));
          }
          if (!force && savedAt && Date.now() - savedAt < FORECAST_TTL_MS) {
            if (alive()) setView(previous => ({ ...previous, busy: false }));
            return;
          }
        }
      }

      if (!location) {
        if (alive()) setView(previous => ({ ...previous, phase: 'locating' }));
        location = await resolveLocation(currentSettings, controller.signal, currentLang);
        if (!alive()) return;
        if (alive()) setView(previous => ({ ...previous, phase: 'loading', location }));
      } else if (!currentSettings.override) {
        // Refresh the cached network location in the background when it expired.
        const cachedLocation = getLocationCache().get(LOCATION_CACHE_KEY);
        if (!cachedLocation && alive()) {
          location = await resolveLocation({ ...currentSettings, override: null }, controller.signal, currentLang);
          if (!alive()) return;
        }
      }

      if (!alive()) return;
      setView(previous => ({
        ...previous,
        phase: previous.forecast ? 'ready' : 'loading',
        location
      }));

      const cache = forecastCacheFor(location);
      let forecast = force ? null : cache.get('latest');
      let updatedAt = cache.savedAt('latest') || Date.now();
      if (!forecast) {
        const payload = await fetchJson(buildForecastUrl(location.lat, location.lon), {
          signal: controller.signal,
          timeoutMs: REQUEST_TIMEOUT_MS
        });
        const normalized = normalizeForecast(payload);
        if (!normalized) throw taggedError('data');
        forecast = normalized;
        cache.set('latest', normalized, FORECAST_TTL_MS);
        updatedAt = Date.now();
      }

      if (!alive()) return;
      setView({
        phase: 'ready',
        busy: false,
        error: null,
        location,
        forecast,
        updatedAt
      });
    } catch (error) {
      if (!alive()) return;
      setView(previous => ({
        ...previous,
        busy: false,
        phase: previous.forecast ? 'ready' : 'error',
        error: describeError(error, translateRef.current)
      }));
    }
  }, []);

  const overrideKey = settings.override
    ? `${settings.override.lat.toFixed(3)}|${settings.override.lon.toFixed(3)}|${settings.override.source}`
    : '';

  React.useEffect(() => {
    load({ force: false });
  }, [overrideKey, load]);

  React.useEffect(() => {
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (Date.now() - lastAttemptRef.current >= AUTO_REFRESH_MS) load({ force: false });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [load]);

  const useAutoLocation = React.useCallback(() => {
    getLocationCache().delete(LOCATION_CACHE_KEY);
    patchSettings({ override: null });
    load({ force: true });
  }, [load, patchSettings]);

  const useDeviceLocation = React.useCallback(async () => {
    const t = translateRef.current;
    try {
      const position = await requestDevicePosition();
      const label = await describeLocation(
        { lat: position.lat, lon: position.lon, source: 'gps' },
        undefined,
        langRef.current
      ).then(described => described.label).catch(() => formatCoordinates(position.lat, position.lon));
      patchSettings({
        override: { lat: position.lat, lon: position.lon, label, source: 'gps' }
      });
      // Re-locate explicitly: the override may not change (same coordinates),
      // in which case the settings effect would not fire.
      load({ force: true });
    } catch (error) {
      setView(previous => ({ ...previous, error: t('error.gps') }));
    }
  }, [load, patchSettings]);

  const selectCity = React.useCallback(city => {
    patchSettings({
      override: {
        lat: city.lat,
        lon: city.lon,
        label: [city.name, city.region].filter(Boolean).join(' · '),
        source: 'manual'
      }
    });
  }, [patchSettings]);

  const toggleUnits = React.useCallback(() => {
    patchSettings({ units: settingsRef.current.units === 'imperial' ? 'metric' : 'imperial' });
  }, [patchSettings]);

  return {
    settings,
    view,
    refresh: () => load({ force: true }),
    useAutoLocation,
    useDeviceLocation,
    selectCity,
    toggleUnits
  };
}

/* ------------------------------------------------------------------ */
/* View                                                               */
/* ------------------------------------------------------------------ */

function ParameterList(props) {
  const items = props.items;
  return h('div', { className: 'dshw-grid' },
    items.map(item => h('div', { className: 'dshw-param', key: item.key || item.label },
      h('span', { className: 'dshw-param-k' }, item.label),
      h('span', { className: 'dshw-param-v' },
        item.value,
        item.unit ? h('small', null, item.unit) : null
      )
    ))
  );
}

function NowSection(props) {
  const { t, lang, units, current, today } = props;
  if (!current) return null;
  const described = describeWeather(current.weatherCode);
  const params = [
    { label: t('param.humidity'), value: formatPercent(current.humidity), key: 'humidity' },
    { label: t('param.pressure'), value: formatPressure(current.pressure, units), key: 'pressure' },
    {
      label: t('param.wind'),
      value: `${windDirectionLabel(current.windDirection, lang)} ${formatWindSpeed(current.windSpeed, units)}`,
      key: 'wind'
    },
    { label: t('param.gust'), value: formatWindSpeed(current.windGusts, units), key: 'gust' },
    { label: t('param.precipitation'), value: formatPrecipitation(current.precipitation, units), key: 'precip' },
    { label: t('param.cloudCover'), value: formatPercent(current.cloudCover), key: 'cloud' },
    {
      label: t('param.uv'),
      value: today && isNumber(today.uvMax) ? `${formatUv(today.uvMax)} · ${uvBand(today.uvMax, lang)}` : '—',
      key: 'uv'
    },
    {
      label: t('param.precipProbability'),
      value: today ? formatPercent(today.precipitationProbabilityMax) : '—',
      key: 'pop'
    }
  ];

  return h('section', { className: 'dshw-card dshw-now' },
    h('div', { className: 'dshw-now-main' },
      h('div', { className: 'dshw-glyph-box' },
        h(WeatherGlyph, { code: current.weatherCode, isDay: current.isDay, size: 72 })
      ),
      h('div', { className: 'dshw-now-text' },
        h('div', { className: 'dshw-temp' }, formatTemperature(current.temperature, units)),
        h('div', { className: 'dshw-cond' }, lang === 'en' ? described.en : described.zh),
        h('div', { className: 'dshw-muted dshw-small' },
          t('now.feelsLike', { temp: formatTemperature(current.apparentTemperature, units) })
        ),
        today
          ? h('div', { className: 'dshw-muted dshw-small' },
            `${t('day.high')} ${formatTemperature(today.tempMax, units)} / ${t('day.low')} ${formatTemperature(today.tempMin, units)}`
          )
          : null
      )
    ),
    h('div', { className: 'dshw-now-params' },
      h(ParameterList, { items: params }),
      h('div', { className: 'dshw-sun-row' },
        h('span', { className: 'dshw-sun-item' },
          h('span', { className: 'dshw-param-k' }, t('param.sunrise')),
          h('span', { className: 'dshw-param-v' }, today ? formatClock(today.sunrise) : '—')
        ),
        h('span', { className: 'dshw-sun-item' },
          h('span', { className: 'dshw-param-k' }, t('param.sunset')),
          h('span', { className: 'dshw-param-v' }, today ? formatClock(today.sunset) : '—')
        ),
        current.time
          ? h('span', { className: 'dshw-sun-item' },
            h('span', { className: 'dshw-param-k' }, '⏱'),
            h('span', { className: 'dshw-param-v' }, formatClock(current.time))
          )
          : null
      )
    )
  );
}

function ForecastCard(props) {
  const { t, lang, units, day, offset } = props;
  const described = describeWeather(day.weatherCode);
  return h('article', { className: 'dshw-card dshw-day' },
    h('header', { className: 'dshw-day-top' },
      h('span', { className: 'dshw-day-name' }, formatDayOffset(offset, lang, t)),
      h('span', { className: 'dshw-day-date' }, formatMonthDay(day.date, lang))
    ),
    h('div', { className: 'dshw-day-body' },
      h(WeatherGlyph, { code: day.weatherCode, isDay: true, size: 48 }),
      h('div', { className: 'dshw-day-text' },
        h('span', { className: 'dshw-day-cond' }, lang === 'en' ? described.en : described.zh),
        h('span', { className: 'dshw-day-temps' },
          h('strong', null, formatTemperature(day.tempMax, units)),
          h('span', { className: 'dshw-muted' }, ` / ${formatTemperature(day.tempMin, units)}`)
        )
      )
    ),
    h('dl', { className: 'dshw-day-meta' },
      h('div', null,
        h('dt', null, t('param.precipProbability')),
        h('dd', null, formatPercent(day.precipitationProbabilityMax))
      ),
      h('div', null,
        h('dt', null, t('param.precipitation')),
        h('dd', null, formatPrecipitation(day.precipitationSum, units))
      ),
      h('div', null,
        h('dt', null, t('param.wind')),
        h('dd', null, formatWindSpeed(day.windMax, units))
      ),
      h('div', null,
        h('dt', null, t('param.uv')),
        h('dd', null, isNumber(day.uvMax) ? formatUv(day.uvMax) : '—')
      )
    )
  );
}

function HourlyStrip(props) {
  const { t, lang, units, hours, currentTime } = props;
  if (!hours || hours.length === 0) return null;
  return h('div', { className: 'dshw-hours', role: 'list' },
    hours.map((hour, index) => {
      const isNow = index === 0 && currentTime && hour.time && hour.time.slice(0, 13) === currentTime.slice(0, 13);
      return h('div', { className: 'dshw-hour', role: 'listitem', key: hour.time || index },
        h('span', { className: 'dshw-hour-time' }, isNow ? t('hourly.now') : formatClock(hour.time)),
        h(WeatherGlyph, { code: hour.weatherCode, isDay: true, size: 26 }),
        h('span', { className: 'dshw-hour-temp' }, formatTemperature(hour.temperature, units)),
        isNumber(hour.precipitationProbability) && hour.precipitationProbability >= 10
          ? h('span', { className: 'dshw-hour-pop' }, `${Math.round(hour.precipitationProbability)}%`)
          : null
      );
    })
  );
}

function LocationPicker(props) {
  const { t, lang, onClose, onAuto, onDevice, onSelect } = props;
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState([]);
  const [status, setStatus] = React.useState('idle');
  const searchRunRef = React.useRef(0);

  React.useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setResults([]);
      setStatus('idle');
      return undefined;
    }
    const run = searchRunRef.current + 1;
    searchRunRef.current = run;
    setStatus('searching');
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchCities(fetchJson, text, { signal: controller.signal, language: lang })
        .then(found => {
          if (searchRunRef.current !== run) return;
          setResults(found);
          setStatus(found.length > 0 ? 'ready' : 'empty');
        })
        .catch(() => {
          if (searchRunRef.current !== run) return;
          setResults([]);
          setStatus('empty');
        });
    }, 280);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, lang]);

  return h('section', { className: 'dshw-card dshw-picker' },
    h('div', { className: 'dshw-picker-head' },
      h('h3', { className: 'dshw-section-title' }, t('location.title')),
      h('button', {
        type: 'button',
        className: 'dshw-btn dshw-btn-icon',
        onClick: onClose,
        title: t('action.cancel'),
        'aria-label': t('action.cancel')
      }, h(CloseGlyph, { size: 14 }))
    ),
    h('p', { className: 'dshw-note' }, t('location.description')),
    h('div', { className: 'dshw-picker-actions' },
      h('button', { type: 'button', className: 'dshw-btn', onClick: onAuto }, h(PinGlyph), t('location.auto')),
      h('button', { type: 'button', className: 'dshw-btn', onClick: onDevice }, h(GpsGlyph), t('location.gps'))
    ),
    h('label', { className: 'dshw-search' },
      h('span', { className: 'dshw-search-icon' }, h(SearchGlyph)),
      h('input', {
        className: 'dshw-input',
        type: 'search',
        value: query,
        placeholder: t('location.placeholder'),
        'aria-label': t('location.searchTitle'),
        onChange: event => setQuery(event.target.value)
      })
    ),
    status === 'searching' ? h('p', { className: 'dshw-note' }, t('location.searching')) : null,
    status === 'empty' ? h('p', { className: 'dshw-note' }, t('location.noResult')) : null,
    results.length > 0
      ? h('div', { className: 'dshw-results' },
        results.map(city => h('button', {
          type: 'button',
          className: 'dshw-result',
          key: `${city.id || city.name}-${city.lat}`,
          onClick: () => onSelect(city)
        },
          h('span', { className: 'dshw-result-name' }, city.name),
          h('span', { className: 'dshw-result-meta' },
            [city.region, city.country].filter(Boolean).join(' · ') || (lang === 'en' ? 'Unknown region' : '未知地区')
          )
        ))
      )
      : null
  );
}

function PanelSkeleton(props) {
  const label = props.label;
  return h('div', { className: 'dshw-loading', 'aria-live': 'polite' },
    h('div', { className: 'dshw-skeleton' }),
    h('p', { className: 'dshw-note' }, label)
  );
}

function PanelFooter(props) {
  const { t, view } = props;
  const provider = view.location && view.location.provider ? view.location.provider : '';
  return h('footer', { className: 'dshw-footer' },
    h('span', null,
      `${t('footer.weather')}: `,
      h('a', { href: 'https://open-meteo.com/', target: '_blank', rel: 'noreferrer noopener' }, 'Open-Meteo'),
      ` · ${t('footer.license')}`
    ),
    h('span', null,
      `${t('footer.location')}: `,
      h('a', { href: 'https://ipwho.is/', target: '_blank', rel: 'noreferrer noopener' }, provider || 'IP'),
      ' · ',
      h('a', { href: 'https://www.bigdatacloud.com/', target: '_blank', rel: 'noreferrer noopener' }, 'BigDataCloud')
    ),
    h('span', null, t('footer.note'))
  );
}

/** The panel component registered into the `main` slot. */
function WeatherPanel(props) {
  const rawTranslate = props && typeof props.t === 'function' ? props.t : key => key;
  const localeService = props ? props.locale : null;
  const activeLocale = useActiveLocale(localeService);
  const lang = String(activeLocale || '').toLowerCase().startsWith('en') ? 'en' : 'zh';
  const translate = React.useCallback((key, vars) => {
    try {
      const text = rawTranslate(key);
      return interpolate(text === key ? lookupMessage(lang, key) : text, vars);
    } catch (error) {
      return lookupMessage(lang, key);
    }
  }, [rawTranslate, lang]);

  const model = useWeatherPanel(translate, lang);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const closePanel = props ? props.closePanel : null;

  const view = model.view;
  const settings = model.settings;
  const units = settings.units;
  const forecast = view.forecast;
  const current = forecast ? forecast.current : null;
  const daily = forecast ? forecast.daily : [];
  const today = daily && daily[0] ? daily[0] : null;
  const upcoming = upcomingDays(daily, FORECAST_DAYS_SHOWN);
  const hours = forecast ? selectUpcomingHours(forecast.hourly, current && current.time, 24) : [];
  const isStale = view.updatedAt && Date.now() - view.updatedAt > STALE_AFTER_MS;

  const subtitleParts = [];
  if (view.location) subtitleParts.push(view.location.label);
  if (view.location && view.location.source === 'network' && view.location.ip) {
    subtitleParts.push(translate('panel.subtitleNetwork', { ip: view.location.ip }));
  } else if (view.location && view.location.source === 'gps') {
    subtitleParts.push(translate('panel.subtitleGps'));
  } else if (view.location && view.location.source === 'manual') {
    subtitleParts.push(translate('panel.subtitleManual'));
  }
  if (view.updatedAt) subtitleParts.push(translate('panel.updated', { time: formatClockFromDate(new Date(view.updatedAt)) }));

  return h('div', { className: 'dshw-root', 'data-dsh-weather-panel': '' },
    h(PanelStyles, null),
    h('div', { className: 'dshw-inner' },
      h('header', { className: 'dshw-header' },
        h('div', { className: 'dshw-titles' },
          h('h1', { className: 'dshw-h1' }, translate('panel.title')),
          h('p', { className: 'dshw-sub' },
            subtitleParts.map((part, index) => h('span', {
              className: index === 0 ? 'dshw-sub-strong' : 'dshw-chip',
              key: `${index}-${part}`
            }, part)),
            view.busy ? h('span', { className: 'dshw-chip dshw-chip-busy' }, translate('state.updating')) : null,
            isStale ? h('span', { className: 'dshw-chip dshw-chip-warn' }, translate('state.stale')) : null
          )
        ),
        h('div', { className: 'dshw-actions' },
          h('button', {
            type: 'button',
            className: 'dshw-btn dshw-btn-icon',
            onClick: model.refresh,
            title: translate('action.refresh'),
            'aria-label': translate('action.refresh'),
            disabled: view.busy
          }, h(RefreshGlyph)),
          h('button', {
            type: 'button',
            className: 'dshw-btn',
            onClick: model.toggleUnits,
            title: units === 'imperial' ? translate('action.useMetric') : translate('action.useImperial'),
            'aria-label': units === 'imperial' ? translate('action.useMetric') : translate('action.useImperial')
          }, units === 'imperial' ? '°F' : '°C'),
          h('button', {
            type: 'button',
            className: 'dshw-btn',
            onClick: () => setPickerOpen(open => !open),
            'aria-expanded': pickerOpen ? 'true' : 'false'
          }, h(PinGlyph), translate('action.changeLocation')),
          closePanel
            ? h('button', {
              type: 'button',
              className: 'dshw-btn dshw-btn-icon',
              onClick: () => closePanel(),
              title: translate('action.close'),
              'aria-label': translate('action.close')
            }, h(CloseGlyph))
            : null
        )
      ),

      pickerOpen
        ? h(LocationPicker, {
          t: translate,
          lang,
          onClose: () => setPickerOpen(false),
          onAuto: () => {
            model.useAutoLocation();
            setPickerOpen(false);
          },
          onDevice: () => {
            model.useDeviceLocation();
            setPickerOpen(false);
          },
          onSelect: city => {
            model.selectCity(city);
            setPickerOpen(false);
          }
        })
        : null,

      view.error
        ? h('div', { className: 'dshw-alert', role: 'alert' },
          h('span', null, view.error),
          h('button', {
            type: 'button',
            className: 'dshw-btn',
            onClick: model.refresh
          }, translate('action.retry'))
        )
        : null,

      !forecast
        ? h(PanelSkeleton, {
          label: view.phase === 'locating' ? translate('state.locating') : translate('state.loading')
        })
        : h(React.Fragment, null,
          h(NowSection, { t: translate, lang, units, current, today }),
          h('section', { className: 'dshw-section' },
            h('div', { className: 'dshw-section-head' },
              h('h2', { className: 'dshw-section-title' }, translate('forecast.title')),
              forecast.timezone ? h('span', { className: 'dshw-note' }, forecast.timezone) : null
            ),
            h('div', { className: 'dshw-forecast' },
              upcoming.map((day, index) => h(ForecastCard, {
                key: day.date || `day-${index}`,
                t: translate,
                lang,
                units,
                day,
                offset: index + 1
              }))
            )
          ),
          hours.length > 0
            ? h('section', { className: 'dshw-section' },
              h('div', { className: 'dshw-section-head' },
                h('h2', { className: 'dshw-section-title' }, translate('hourly.title'))
              ),
              h(HourlyStrip, { t: translate, lang, units, hours, currentTime: current && current.time })
            )
            : null
        ),

      h(PanelFooter, { t: translate, view })
    )
  );
}

/**
 * Track the active language as a plain string.
 *
 * Deliberately not `useSyncExternalStore`: it would require the locale snapshot
 * object to be referentially stable, and a Host that rebuilt it per call would
 * throw "The result of getSnapshot should be cached" and blank the slot. Reading
 * one primitive field through a subscription cannot have that failure mode.
 */
function readActiveLocale(localeService) {
  if (!localeService || typeof localeService.getSnapshot !== 'function') return '';
  try {
    const snapshot = localeService.getSnapshot();
    return snapshot && snapshot.active !== undefined ? String(snapshot.active) : '';
  } catch (error) {
    return '';
  }
}

function useActiveLocale(localeService) {
  const [active, setActive] = React.useState(() => readActiveLocale(localeService));
  React.useEffect(() => {
    setActive(readActiveLocale(localeService));
    if (!localeService || typeof localeService.subscribe !== 'function') return undefined;
    let disposed = false;
    const unsubscribe = localeService.subscribe(() => {
      if (!disposed) setActive(readActiveLocale(localeService));
    });
    return () => {
      disposed = true;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [localeService]);
  return active;
}

function PanelStyles() {
  return h('style', { 'data-dsh-weather-panel-style': '' }, PANEL_CSS);
}
