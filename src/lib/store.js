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

// Single-line imports are stripped by scripts/build.mjs (the bundle is one
// shared scope). They exist so this file is a real ESM module and Node tests
// import the actual implementation instead of a silently-degraded copy.
import { createSafeStorage, createTtlCache } from './cache.js';
import { ALARM_MAX_PAGES, ALARM_PAGE_SIZE, DEFAULT_ALERT_NOTICE, DEFAULT_ALERT_STRONG, ALERT_LEVELS, ALERT_TYPES, buildAlarmPageUrl, matchAlerts, normalizeAlarmPage } from './alerts.js';
import { TYPHOON_DETAIL_URL, TYPHOON_LIST_URL, listHasActiveTyphoon, normalizeTyphoonDetail, normalizeTyphoonList, parseJsonp, pickTyphoon } from './typhoon.js';
import { lookupNetworkLocation, reverseGeocode } from './geo.js';
import { buildForecastUrl, normalizeForecast } from './weather.js';
import { formatCoordinates, isNumber } from './format.js';

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
const DEFAULT_SETTINGS = {
  units: 'metric',
  preciseLocation: false,
  override: null,
  alertNotice: { ...DEFAULT_ALERT_NOTICE },
  alertStrong: { ...DEFAULT_ALERT_STRONG }
};

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

/** A persisted per-level switch map, missing keys filled from the defaults. */
export function normalizeLevelMap(value, defaults) {
  const base = defaults || DEFAULT_ALERT_NOTICE;
  const out = {};
  for (const key of Object.keys(base)) {
    out[key] = value && typeof value[key] === 'boolean' ? value[key] : base[key];
  }
  return out;
}

function normalizeOverride(value) {
  if (!value || !isNumber(value.lat) || !isNumber(value.lon)) return null;
  return {
    lat: value.lat,
    lon: value.lon,
    label: typeof value.label === 'string' ? value.label : '',
    city: typeof value.city === 'string' ? value.city : '',
    district: typeof value.district === 'string' ? value.district : '',
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
      // Persisted across starts: the switch is a user decision, not a one-shot.
      preciseLocation: Boolean(parsed && parsed.preciseLocation === true),
      override: parsed ? normalizeOverride(parsed.override) : null,
      alertNotice: normalizeLevelMap(parsed && parsed.alertNotice, DEFAULT_ALERT_NOTICE),
      alertStrong: normalizeLevelMap(parsed && parsed.alertStrong, DEFAULT_ALERT_STRONG)
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
/* Demo alerts (for checking the notice without waiting for weather)   */
/* ------------------------------------------------------------------ */

const DEMO_STORAGE_KEY = `${PANEL_ID}:demo-alert`;

const DEMO_ALERT_PRESETS = {
  'typhoon-red': {
    title: '山东省青岛市气象台发布台风红色预警信号',
    type: '台风',
    typeEn: 'Typhoon',
    level: 'red',
    levelZh: '红色',
    levelEn: 'Red',
    levelRank: 4,
    place: '山东省青岛市'
  },
  'rain-orange': {
    title: '山东省青岛市气象台发布暴雨橙色预警信号',
    type: '暴雨',
    typeEn: 'Rainstorm',
    level: 'orange',
    levelZh: '橙色',
    levelEn: 'Orange',
    levelRank: 3,
    place: '山东省青岛市'
  }
};

/** Which demo alert the user asked for, or `''` when demo mode is off. */
export function readDemoAlertKind() {
  try {
    const raw = getPanelStorage().getItem(DEMO_STORAGE_KEY);
    return typeof raw === 'string' ? raw.trim() : '';
  } catch (error) {
    return '';
  }
}

/** Turn demo mode on for one preset (the next refresh injects it). */
export function setDemoAlertKind(kind) {
  try {
    const preset = String(kind || '').trim();
    if (preset) getPanelStorage().setItem(DEMO_STORAGE_KEY, preset);
    else getPanelStorage().removeItem(DEMO_STORAGE_KEY);
  } catch (error) {
    /* storage blocked: demo simply does not start */
  }
}

/** Turn demo mode off; the next refresh loads the real alert feed again. */
export function clearDemoAlert() {
  setDemoAlertKind('');
}

/**
 * Build a fake alert for the notice test.
 *
 * Only used when `dsh-weather-panel:demo-alert` is set to a preset name; the
 * real alert pipeline is untouched, so nothing here can fire by accident.
 */
export function buildDemoAlert(kind, nowMs, location) {
  const raw = String(kind || '').trim();
  if (!raw) return null;
  const now = new Date(Number.isFinite(nowMs) ? nowMs : Date.now());
  const pad = value => String(value).padStart(2, '0');
  const issuedText = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const isPreview = raw.startsWith('preview:');
  let preset = null;
  if (isPreview) {
    // 预览用**当前定位**的城市名，这样弹窗里的地址和面板一致。
    const levelKey = raw.slice('preview:'.length).split(':')[0];
    const level = ALERT_LEVELS.find(item => item.key === levelKey) || ALERT_LEVELS[2];
    const type = ALERT_TYPES.find(item => item.zh === '暴雨') || { zh: '暴雨', en: 'Rainstorm' };
    const city = location ? String(location.city || '').trim() : '';
    const region = location ? String(location.region || '').trim() : '';
    const place = `${region}${city}` || (location && location.label ? String(location.label) : '本地');
    preset = {
      title: `${place}气象台发布${type.zh}${level.zh}预警信号`,
      type: type.zh,
      typeEn: type.en,
      level: level.key,
      levelZh: level.zh,
      levelEn: level.en,
      levelRank: level.rank,
      place
    };
  } else {
    preset = DEMO_ALERT_PRESETS[raw];
  }
  if (!preset) return null;
  return {
    id: `demo:${raw}`,
    title: preset.title,
    issuedAt: now.getTime(),
    issuedText,
    url: 'https://www.nmc.cn/publish/alarm.html',
    pic: '',
    type: preset.type,
    typeEn: preset.typeEn,
    level: preset.level,
    levelZh: preset.levelZh,
    levelEn: preset.levelEn,
    levelRank: preset.levelRank,
    place: preset.place,
    scope: 'city',
    demo: true,
    preview: isPreview
  };
}

/** Preset names available to the demo switch. */
export function demoAlertKinds() {
  return Object.keys(DEMO_ALERT_PRESETS);
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
    // 城市里的区/县：NMC 标题会写到区县一级，有了这个才能匹配到「本市某区」的预警。
    district: (reversed && reversed.locality) || found.district || '',
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

/**
 * Pick a location for this refresh.
 *
 * Order: an explicit manual city always wins; then the persisted
 * "high-accuracy device location" switch; then the cached/derived network
 * location. A failing geolocation never breaks the panel — it reports a warning
 * and falls through to the network path.
 *
 * @returns {Promise<{location: object, warning: string}>}
 */
async function resolveLocation(settings, signal, lang) {
  if (settings.override) return { location: { ...settings.override }, warning: '' };

  if (settings.preciseLocation) {
    try {
      const position = await requestDevicePosition();
      const described = await describeLocation(
        { lat: position.lat, lon: position.lon, source: 'gps' },
        signal,
        lang
      );
      return {
        location: {
          ...described,
          source: 'gps',
          accuracy: isNumber(position.accuracy) ? Math.round(position.accuracy) : null
        },
        warning: ''
      };
    } catch (error) {
      // Permission denied, no hardware, or a timeout: keep going with the IP.
    }
  }

  const cached = getLocationCache().get(LOCATION_CACHE_KEY);
  if (cached && isNumber(cached.lat) && isNumber(cached.lon)) {
    return { location: cached, warning: settings.preciseLocation ? 'gps-fallback' : '' };
  }
  const found = await lookupNetworkLocation(fetchJson, { signal });
  if (!found) throw taggedError('locate');
  const described = await describeLocation(found, signal, lang);
  getLocationCache().set(LOCATION_CACHE_KEY, described, LOCATION_TTL_MS);
  return { location: described, warning: settings.preciseLocation ? 'gps-fallback' : '' };
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

  // 全国预警按时间倒序，同一座城市的几条往往散落在不同页；只扫第一页会漏掉
  // 更早发布但仍生效的那条。前 5 页（最多 500 条）一次并行取完，代价是 5 个请求 / 10 分钟。
  const first = await fetchAlarmPage(1, signal);
  const lastPage = Math.min(first.totalPage || 1, ALARM_MAX_PAGES);
  let all = first.alerts;
  if (lastPage > 1) {
    const pages = [];
    for (let page = 2; page <= lastPage; page += 1) pages.push(page);
    const rest = await Promise.all(pages.map(page => fetchAlarmPage(page, signal).catch(() => ({ alerts: [] }))));
    all = first.alerts.concat(...rest.map(item => item.alerts || []));
  }
  const matched = matchAlerts(all, location);
  const scanned = Math.max(first.count || 0, all.length);
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
    locationWarning: '',
    typhoonList: [],
    typhoon: null,
    typhoonId: null,
    typhoonActive: false,
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
      const resolved = await resolveLocation(settings, controller.signal, lang);
      location = resolved.location;
      if (!alive(run)) return;
      emit({ location, locationWarning: resolved.warning || '', phase: state.forecast ? 'ready' : 'loading' });
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
      const demo = buildDemoAlert(readDemoAlertKind(), undefined, location);
      if (demo) {
        if (!alive(run)) return;
        emit({ alerts: [demo], alertsScanned: 1, alertsCheckedAt: Date.now() });
        return;
      }
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
        typhoonId: result.pickedId,
        typhoonActive: listHasActiveTyphoon(result.list)
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
    /** Back to plain network location (clears a manual city, switch off). */
    clearOverride() {
      getLocationCache().delete(LOCATION_CACHE_KEY);
      persist({ override: null, preciseLocation: false });
      refresh({ force: true });
    },
    /**
     * Persist the "high-accuracy device location" switch.
     *
     * Turning it on clears a manual city so the setting is actually visible, and
     * a refresh immediately triggers the permission prompt — that prompt *is*
     * the user's confirmation. Turning it off returns to the network location.
     */
    setPreciseLocation(enabled) {
      const next = enabled === true;
      persist({ preciseLocation: next, override: next ? null : settings.override });
      if (!next) getLocationCache().delete(LOCATION_CACHE_KEY);
      refresh({ force: true });
    },
    /** Manual city: wins over the switch until the user clears it. */
    selectCity(city) {
      const override = normalizeOverride({
        lat: city.lat,
        lon: city.lon,
        label: [city.name, city.subtitle || city.region].filter(Boolean).join(' · '),
        // 命中区县时 city 是它所属的地级市，district 才是区县名。
        city: city.city || city.name,
        district: city.district || '',
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
    },
    /** Which levels raise the startup notice. */
    setAlertNoticeLevel(level, enabled) {
      const key = String(level || '');
      if (!(key in DEFAULT_ALERT_NOTICE)) return;
      const next = { ...settings.alertNotice, [key]: enabled === true };
      persist({ alertNotice: next });
    },
    /** Which levels use the emphatic notice style. */
    setAlertStrongLevel(level, enabled) {
      const key = String(level || '');
      if (!(key in DEFAULT_ALERT_STRONG)) return;
      const next = { ...settings.alertStrong, [key]: enabled === true };
      persist({ alertStrong: next });
    },
    /** Preview the notice for one level, using the current location. */
    previewAlert(level) {
      setDemoAlertKind(`preview:${String(level || 'yellow')}`);
      refresh({ force: true });
    },
    /** Inject a fake alert to inspect the notice; cleared when acknowledged. */
    showDemoAlert(kind) {
      setDemoAlertKind(kind || 'typhoon-red');
      refresh({ force: true });
    },
    stopDemoAlert() {
      clearDemoAlert();
      refresh({ force: true });
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
