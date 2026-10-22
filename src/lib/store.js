/**
 * Shared weather store: one place that owns settings, caching, network work and
 * the ten-minute refresh loop.
 *
 * Why a store and not a hook: the panel and the startup notice are two separate
 * slot entries. Both need the same location / forecast / alerts, and neither
 * may duplicate requests. One store, many subscribers — the notice can check
 * alerts at page boot while the panel is never opened, without a second fetch.
 *
 * Everything here is plain JavaScript (no React), so it is unit-testable; the
 * subscription helper at the bottom is the only React-aware part.
 */

export const PANEL_ID = 'dsh-weather-panel';
const SETTINGS_STORAGE_KEY = `${PANEL_ID}:settings`;
const LOCATION_CACHE_KEY = 'resolved';
const NOTICE_STORAGE_KEY = `${PANEL_ID}:notice`;
const LOCATION_TTL_MS = 6 * 60 * 60 * 1000;
const FORECAST_TTL_MS = 10 * 60 * 1000;
const ALERTS_TTL_MS = 10 * 60 * 1000;
const TYPHOON_TTL_MS = 60 * 60 * 1000;
const AUTO_REFRESH_MS = 10 * 60 * 1000;
const TICK_MS = 30 * 1000;
const REQUEST_TIMEOUT_MS = 12000;
const DEFAULT_SETTINGS = { units: 'metric', override: null };

let sharedStorage = null;
let sharedLocationCache = null;
let sharedForecastCaches = new Map();
let sharedAlertCache = null;
let sharedTyphoonCache = null;

export function getPanelStorage() {
  if (!sharedStorage) sharedStorage = createSafeStorage(`${PANEL_ID}:probe`);
  return sharedStorage;
}

export function getLocationCache() {
  if (!sharedLocationCache) {
    sharedLocationCache = createTtlCache(getPanelStorage(), `${PANEL_ID}:location:`, () => Date.now());
  }
  return sharedLocationCache;
}

export function forecastCacheFor(location) {
  const key = `${Number(location.lat).toFixed(2)},${Number(location.lon).toFixed(2)}`;
  if (!sharedForecastCaches.has(key)) {
    sharedForecastCaches.set(key, createTtlCache(getPanelStorage(), `${PANEL_ID}:forecast:${key}:`, () => Date.now()));
  }
  return sharedForecastCaches.get(key);
}

function getAlertCache() {
  if (!sharedAlertCache) sharedAlertCache = createTtlCache(getPanelStorage(), `${PANEL_ID}:alerts:`, () => Date.now());
  return sharedAlertCache;
}

function getTyphoonCache() {
  if (!sharedTyphoonCache) sharedTyphoonCache = createTtlCache(getPanelStorage(), `${PANEL_ID}:typhoon:`, () => Date.now());
  return sharedTyphoonCache;
}

/** One cache key per place, so switching cities does not reuse another city's alerts. */
export function placeCacheKey(location) {
  if (!location) return 'unknown';
  const label = typeof location.label === 'string' ? location.label : '';
  const coords = `${Number(location.lat).toFixed(1)},${Number(location.lon).toFixed(1)}`;
  return `${coords}:${label}`;
}

/* ------------------------------------------------------------------ */
/* Settings                                                           */
/* ------------------------------------------------------------------ */

function normalizeOverride(value) {
  if (!value || !isNumber(value.lat) || !isNumber(value.lon)) return null;
  return {
    lat: value.lat,
    lon: value.lon,
    label: typeof value.label === 'string' ? value.label : '',
    city: typeof value.city === 'string' ? value.city : '',
    region: typeof value.region === 'string' ? value.region : '',
    source: value.source === 'gps' ? 'gps' : 'manual'
  };
}

export function readPanelSettings() {
  try {
    const raw = getPanelStorage().getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      units: parsed && parsed.units === 'imperial' ? 'imperial' : 'metric',
      override: parsed ? normalizeOverride(parsed.override) : null
    };
  } catch (error) {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writePanelSettings(settings) {
  try {
    getPanelStorage().setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    /* best effort: in-memory state still works */
  }
}

/* ------------------------------------------------------------------ */
/* Network                                                            */
/* ------------------------------------------------------------------ */

/** JSON fetch with a hard timeout and mapped errors. */
export function fetchJson(url, options) {
  return fetchRaw(url, options).then(response => response.json());
}

/** Text fetch, used for the JSONP typhoon endpoints. */
export function fetchText(url, options) {
  return fetchRaw(url, options).then(response => response.text());
}

function fetchRaw(url, options) {
  const settings = options || {};
  const externalSignal = settings.signal;
  const controller = new AbortController();
  const abortFromOutside = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', abortFromOutside, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), isNumber(settings.timeoutMs) ? settings.timeoutMs : REQUEST_TIMEOUT_MS);

  return fetch(url, {
    method: 'GET',
    mode: 'cors',
    credentials: 'omit',
    cache: 'no-store',
    redirect: 'follow',
    referrerPolicy: 'no-referrer',
    headers: { accept: settings.accept || 'application/json,text/plain,*/*' },
    signal: controller.signal
  }).then(response => {
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response;
  }).finally(() => {
    clearTimeout(timer);
    if (externalSignal) externalSignal.removeEventListener('abort', abortFromOutside);
  });
}

/** Ask the browser for device location. */
export function requestDevicePosition() {
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

/** Reverse-geocode, falling back to the provider city and then coordinates. */
export async function describeLocation(found, signal, lang) {
  let reversed = null;
  try {
    reversed = await reverseGeocode(fetchJson, found.lat, found.lon, { signal, language: lang });
  } catch (error) {
    reversed = null;
  }
  const label = (reversed && reversed.label)
    || [found.city, found.region].filter(Boolean).join(' · ')
    || formatCoordinates(found.lat, found.lon);
  return {
    lat: found.lat,
    lon: found.lon,
    label,
    source: found.source || 'network',
    ip: found.ip || '',
    provider: found.provider || '',
    countryCode: found.countryCode || (reversed && reversed.countryCode) || '',
    city: (reversed && reversed.city) || found.city || '',
    region: (reversed && reversed.region) || found.region || ''
  };
}

export function taggedError(kind, cause) {
  const error = cause instanceof Error ? cause : new Error(kind);
  error.kind = kind;
  return error;
}

export function describeError(error, translate) {
  if (!error) return translate('error.weather');
  if (error.kind === 'locate') return translate('error.locate');
  if (typeof error.status === 'number') return translate('error.http', { status: error.status });
  if (error.name === 'AbortError') return translate('error.timeout');
  return translate('error.weather');
}

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

async function fetchAlarmPage(pageNo, signal) {
  const payload = await fetchJson(buildAlarmPageUrl(pageNo, ALARM_PAGE_SIZE), { signal });
  return normalizeAlarmPage(payload);
}

/**
 * Domestic alerts for this place.
 *
 * The feed is national and newest-first; when page 1 has no match for this city
 * the remaining pages are fetched in parallel. The matched list is cached per
 * place so the ten-minute refresh usually costs nothing.
 */
async function loadAlerts(location, signal, force) {
  const cacheKey = placeCacheKey(location);
  const cached = getAlertCache().get(cacheKey);
  const savedAt = getAlertCache().savedAt(cacheKey);
  if (!force && cached && savedAt && Date.now() - savedAt < ALERTS_TTL_MS) return cached;

  const first = await fetchAlarmPage(1, signal);
  let matched = matchAlerts(first.alerts, location);
  let scanned = first.count || first.alerts.length;
  if (matched.length === 0 && first.totalPage > 1) {
    const pages = [];
    const lastPage = Math.min(first.totalPage, ALARM_MAX_PAGES);
    for (let page = 2; page <= lastPage; page += 1) pages.push(page);
    const rest = await Promise.all(pages.map(page => fetchAlarmPage(page, signal).catch(() => ({ alerts: [] }))));
    const all = first.alerts.concat(...rest.map(item => item.alerts || []));
    matched = matchAlerts(all, location);
    scanned = Math.max(first.count || 0, all.length);
  }
  const result = { alerts: matched, scanned, checkedAt: Date.now() };
  getAlertCache().set(cacheKey, result, ALERTS_TTL_MS);
  return result;
}

/** Typhoon list + detail for the newest running system. */
async function loadTyphoon(force, signal) {
  let list = force ? null : getTyphoonCache().get('list');
  if (!list) {
    const text = await fetchText(TYPHOON_LIST_URL, { signal, accept: '*/*' });
    list = normalizeTyphoonList(parseJsonp(text));
    getTyphoonCache().set('list', list, TYPHOON_TTL_MS);
  }
  const picked = pickTyphoon(list);
  if (!picked) return { list, detail: null, pickedId: null };
  const cacheKey = `detail:${picked.id}`;
  let detail = force ? null : getTyphoonCache().get(cacheKey);
  if (!detail) {
    const text = await fetchText(`${TYPHOON_DETAIL_URL}${picked.id}`, { signal, accept: '*/*' });
    detail = normalizeTyphoonDetail(parseJsonp(text));
    if (detail) getTyphoonCache().set(cacheKey, detail, TYPHOON_TTL_MS);
  }
  return { list, detail, pickedId: picked.id };
}

async function loadTyphoonDetail(id, signal, force) {
  const cacheKey = `detail:${id}`;
  let detail = force ? null : getTyphoonCache().get(cacheKey);
  if (detail) return detail;
  const text = await fetchText(`${TYPHOON_DETAIL_URL}${id}`, { signal, accept: '*/*' });
  detail = normalizeTyphoonDetail(parseJsonp(text));
  if (detail) getTyphoonCache().set(cacheKey, detail, TYPHOON_TTL_MS);
  return detail;
}

/* ------------------------------------------------------------------ */
/* Store                                                              */
/* ------------------------------------------------------------------ */

export function createWeatherStore() {
  const listeners = new Set();
  let settings = readPanelSettings();
  let state = {
    settings,
    phase: 'idle',
    busy: false,
    error: null,
    location: null,
    forecast: null,
    alerts: [],
    alertsScanned: 0,
    alertsCheckedAt: null,
    typhoonList: [],
    typhoon: null,
    typhoonId: null,
    updatedAt: null
  };

  let runId = 0;
  let abortController = null;
  let lastAttempt = 0;
  let timer = null;
  let visibilityHandler = null;
  let started = false;
  let lang = 'zh';
  let translate = key => key;

  function emit(patch) {
    state = { ...state, ...patch };
    listeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        /* a broken subscriber must not break the store */
      }
    });
  }

  function alive(run) {
    return run === runId;
  }

  async function refresh(options) {
    const force = Boolean(options && options.force);
    const run = ++runId;
    if (abortController) abortController.abort();
    const controller = new AbortController();
    abortController = controller;
    lastAttempt = Date.now();
    emit({ busy: true, error: null, phase: state.forecast ? 'ready' : 'locating' });

    let location = null;
    try {
      location = await resolveLocation(settings, controller.signal, lang);
      if (!alive(run)) return;
      emit({ location, phase: state.forecast ? 'ready' : 'loading' });
    } catch (error) {
      if (!alive(run)) return;
      emit({ busy: false, phase: state.forecast ? 'ready' : 'error', error: describeError(error, translate) });
      return;
    }

    // Painful case: cached values first, so the panel and the notice paint instantly.
    const cache = forecastCacheFor(location);
    const cachedForecast = force ? null : cache.get('latest');
    const cachedSavedAt = cache.savedAt('latest');
    if (cachedForecast) {
      emit({ forecast: cachedForecast, updatedAt: cachedSavedAt, phase: 'ready' });
    }

    const tasks = [];
    tasks.push((async () => {
      if (cachedForecast && cachedSavedAt && Date.now() - cachedSavedAt < FORECAST_TTL_MS) return;
      const payload = await fetchJson(buildForecastUrl(location.lat, location.lon), { signal: controller.signal });
      const normalized = normalizeForecast(payload);
      if (!normalized) throw taggedError('data');
      cache.set('latest', normalized, FORECAST_TTL_MS);
      if (!alive(run)) return;
      emit({ forecast: normalized, updatedAt: Date.now(), phase: 'ready' });
    })());

    tasks.push((async () => {
      const result = await loadAlerts(location, controller.signal, force);
      if (!alive(run)) return;
      emit({ alerts: result.alerts, alertsScanned: result.scanned, alertsCheckedAt: result.checkedAt });
    })());

    tasks.push((async () => {
      const result = await loadTyphoon(force, controller.signal);
      if (!alive(run)) return;
      emit({
        typhoonList: result.list,
        typhoon: result.detail || state.typhoon,
        typhoonId: result.pickedId
      });
    })());

    const results = await Promise.allSettled(tasks);
    if (!alive(run)) return;
    const failed = results.find(item => item.status === 'rejected');
    emit({
      busy: false,
      error: failed && failed.status === 'rejected' ? describeError(failed.reason, translate) : null
    });
  }

  function start(options) {
    if (options && typeof options.lang === 'string') lang = options.lang;
    if (options && typeof options.translate === 'function') translate = options.translate;
    if (!started) {
      started = true;
      refresh({ force: false });
      timer = setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return;
        if (Date.now() - lastAttempt >= AUTO_REFRESH_MS) refresh({ force: false });
      }, TICK_MS);
      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        visibilityHandler = () => {
          if (!document.hidden && Date.now() - lastAttempt >= AUTO_REFRESH_MS) refresh({ force: false });
        };
        document.addEventListener('visibilitychange', visibilityHandler);
      }
    }
    return () => {
      if (timer) clearInterval(timer);
      timer = null;
      if (visibilityHandler && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', visibilityHandler);
        visibilityHandler = null;
      }
      started = false;
    };
  }

  function setLanguage(nextLang, nextTranslate) {
    lang = nextLang === 'en' ? 'en' : 'zh';
    if (typeof nextTranslate === 'function') translate = nextTranslate;
  }

  function persist(patch) {
    settings = { ...settings, ...patch };
    writePanelSettings(settings);
    emit({ settings });
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start,
    setLanguage,
    refresh,
    dispose() {
      if (abortController) abortController.abort();
      if (timer) clearInterval(timer);
      timer = null;
      if (visibilityHandler && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', visibilityHandler);
        visibilityHandler = null;
      }
      listeners.clear();
      started = false;
    },
    setUnits(units) {
      persist({ units: units === 'imperial' ? 'imperial' : 'metric' });
    },
    toggleUnits() {
      persist({ units: settings.units === 'imperial' ? 'metric' : 'imperial' });
    },
    setOverride(location) {
      const override = normalizeOverride(location);
      persist({ override });
      refresh({ force: true });
    },
    clearOverride() {
      getLocationCache().delete(LOCATION_CACHE_KEY);
      persist({ override: null });
      refresh({ force: true });
    },
    async useDeviceLocation() {
      try {
        const position = await requestDevicePosition();
        const described = await describeLocation(
          { lat: position.lat, lon: position.lon, source: 'gps' },
          undefined,
          lang
        ).catch(() => ({ lat: position.lat, lon: position.lon, label: formatCoordinates(position.lat, position.lon), city: '', region: '' }));
        const override = normalizeOverride({ ...described, source: 'gps' });
        persist({ override });
        refresh({ force: true });
      } catch (error) {
        emit({ error: translate('error.gps') });
      }
    },
    selectCity(city) {
      const override = normalizeOverride({
        lat: city.lat,
        lon: city.lon,
        label: [city.name, city.region].filter(Boolean).join(' · '),
        city: city.name,
        region: city.region,
        source: 'manual'
      });
      persist({ override });
      refresh({ force: true });
    },
    async selectTyphoon(id) {
      if (!isNumber(id)) return;
      emit({ typhoonId: id });
      try {
        const detail = await loadTyphoonDetail(id, undefined, false);
        if (detail) emit({ typhoon: detail });
      } catch (error) {
        /* keep the previous track; the UI shows the cached one */
      }
    }
  };
}

/* ------------------------------------------------------------------ */
/* React binding + notice bookkeeping                                 */
/* ------------------------------------------------------------------ */

/** Subscribe a component to the store; `getState` returns a stable object. */
export function useWeatherStore(store) {
  return React.useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

/** Read the per-day notice bookkeeping (never throws). */
export function readNoticeState() {
  try {
    const raw = getPanelStorage().getItem(NOTICE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      date: typeof parsed.date === 'string' ? parsed.date : '',
      signature: typeof parsed.signature === 'string' ? parsed.signature : '',
      confirmedAt: isNumber(parsed.confirmedAt) ? parsed.confirmedAt : null
    };
  } catch (error) {
    return null;
  }
}

export function writeNoticeState(value) {
  try {
    getPanelStorage().setItem(NOTICE_STORAGE_KEY, JSON.stringify(value));
  } catch (error) {
    /* ignore */
  }
}

/** Today's date in the viewer's own time zone, `YYYY-MM-DD`. */
export function todayKey(date) {
  const now = date instanceof Date ? date : new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
