/**
 * Locale dictionaries for the panel's own UI.
 *
 * The Host reads `locale/*.json` for the plugin's *display metadata* (title,
 * description, icon). This table is what the panel renders, and it is
 * registered through the Client locale service so the panel follows the
 * Harness language switch instead of hard-coding one language.
 */

export const WEATHER_LOCALE_NAMESPACE = 'dsh-weather-panel';

export const WEATHER_DICT = {
  zh: {
    'nav.label': '天气',
    'panel.title': '天气面板',
    'panel.subtitleNetwork': '网络定位 · {ip}',
    'panel.subtitleManual': '手动选择的位置',
    'panel.subtitleGps': '系统定位',
    'panel.updated': '更新于 {time}',
    'action.refresh': '刷新',
    'action.retry': '重试',
    'action.useImperial': '切换为 °F',
    'action.useMetric': '切换为 °C',
    'action.changeLocation': '更换位置',
    'action.close': '关闭面板',
    'action.cancel': '取消',
    'state.locating': '正在定位…',
    'state.loading': '正在获取天气…',
    'state.updating': '更新中…',
    'state.cached': '本地缓存',
    'state.stale': '数据可能已过期',
    'error.locate': '无法通过网络判断当前位置，可以手动搜索城市。',
    'error.weather': '获取天气数据失败，请稍后重试。',
    'error.timeout': '请求超时。',
    'error.network': '网络不可用或被拦截。',
    'error.http': '服务返回 HTTP {status}。',
    'error.noResult': '没有找到匹配的城市。',
    'error.gps': '无法获取系统定位（可能被系统拒绝）。',
    'now.title': '当前天气',
    'now.feelsLike': '体感 {temp}',
    'param.humidity': '湿度',
    'param.pressure': '气压',
    'param.wind': '风',
    'param.gust': '阵风',
    'param.precipitation': '降水',
    'param.precipProbability': '降水概率',
    'param.cloudCover': '云量',
    'param.uv': '紫外线',
    'param.sunrise': '日出',
    'param.sunset': '日落',
    'day.today': '今天',
    'day.tomorrow': '明天',
    'day.afterTomorrow': '后天',
    'day.inDays': '{n} 天后',
    'day.high': '最高',
    'day.low': '最低',
    'forecast.title': '未来 3 天',
    'hourly.title': '未来 24 小时',
    'hourly.now': '现在',
    'location.title': '位置来源',
    'location.description': '默认按公网 IP 判断城市（城市级精度）。IP 可能落在运营商或代理出口，需要时请手动指定。',
    'location.auto': '自动（网络定位）',
    'location.autoHint': '重新检测当前网络所在城市',
    'location.gps': '使用系统定位',
    'location.gpsHint': '调用浏览器地理位置，精度更高',
    'location.searchTitle': '搜索城市',
    'location.placeholder': '输入城市名，例如 青岛',
    'location.searching': '搜索中…',
    'location.noResult': '没有找到匹配的城市。',
    'footer.weather': '天气数据',
    'footer.location': '定位数据',
    'footer.license': 'CC BY 4.0',
    'footer.note': '浏览器内直接请求，无需 API Key。',
    'aria.icon': '天气图标',
    'aria.loading': '加载中'
  },
  en: {
    'nav.label': 'Weather',
    'panel.title': 'Weather panel',
    'panel.subtitleNetwork': 'Network location · {ip}',
    'panel.subtitleManual': 'Manually selected location',
    'panel.subtitleGps': 'Device location',
    'panel.updated': 'Updated {time}',
    'action.refresh': 'Refresh',
    'action.retry': 'Retry',
    'action.useImperial': 'Switch to °F',
    'action.useMetric': 'Switch to °C',
    'action.changeLocation': 'Change location',
    'action.close': 'Close panel',
    'action.cancel': 'Cancel',
    'state.locating': 'Locating…',
    'state.loading': 'Loading weather…',
    'state.updating': 'Updating…',
    'state.cached': 'Cached',
    'state.stale': 'May be out of date',
    'error.locate': 'Could not determine this network’s location. Pick a city manually.',
    'error.weather': 'Could not load the weather. Try again in a moment.',
    'error.timeout': 'The request timed out.',
    'error.network': 'Network unavailable or blocked.',
    'error.http': 'The service returned HTTP {status}.',
    'error.noResult': 'No matching city.',
    'error.gps': 'Device location is unavailable (it may be denied).',
    'now.title': 'Now',
    'now.feelsLike': 'Feels like {temp}',
    'param.humidity': 'Humidity',
    'param.pressure': 'Pressure',
    'param.wind': 'Wind',
    'param.gust': 'Gusts',
    'param.precipitation': 'Precipitation',
    'param.precipProbability': 'Precip. chance',
    'param.cloudCover': 'Cloud cover',
    'param.uv': 'UV index',
    'param.sunrise': 'Sunrise',
    'param.sunset': 'Sunset',
    'day.today': 'Today',
    'day.tomorrow': 'Tomorrow',
    'day.afterTomorrow': 'In 2 days',
    'day.inDays': 'In {n} days',
    'day.high': 'High',
    'day.low': 'Low',
    'forecast.title': 'Next 3 days',
    'hourly.title': 'Next 24 hours',
    'hourly.now': 'Now',
    'location.title': 'Location source',
    'location.description': 'The city is derived from your public IP (city-level accuracy). A carrier or proxy exit can move it, so pick a city manually when it matters.',
    'location.auto': 'Automatic (network)',
    'location.autoHint': 'Detect the city this network belongs to',
    'location.gps': 'Use device location',
    'location.gpsHint': 'Uses the browser geolocation API for better accuracy',
    'location.searchTitle': 'Search a city',
    'location.placeholder': 'City name, e.g. Qingdao',
    'location.searching': 'Searching…',
    'location.noResult': 'No matching city.',
    'footer.weather': 'Weather data',
    'footer.location': 'Location data',
    'footer.license': 'CC BY 4.0',
    'footer.note': 'Requested in the browser; no API key.',
    'aria.icon': 'Weather icon',
    'aria.loading': 'Loading'
  }
};

/** Replace `{name}` placeholders in a message. Unknown placeholders are kept. */
export function interpolate(template, vars) {
  const text = typeof template === 'string' ? template : String(template == null ? '' : template);
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, key) => {
    const value = vars[key];
    return value === undefined || value === null ? match : String(value);
  });
}

/** Resolve a key from the bundled dictionary, falling back to the other language. */
export function lookupMessage(lang, key) {
  const primary = WEATHER_DICT[lang] || WEATHER_DICT.zh;
  if (Object.prototype.hasOwnProperty.call(primary, key)) return primary[key];
  const other = lang === 'en' ? WEATHER_DICT.zh : WEATHER_DICT.en;
  if (Object.prototype.hasOwnProperty.call(other, key)) return other[key];
  return key;
}

/**
 * Build a translator on top of the Host translator.
 *
 * `rawTranslate` is `ctx.locale.bind(ns)`: it follows the active language but
 * only knows the keys registered in its namespace dictionary. When it hands
 * back the key itself (unknown key), the bundled table is used instead.
 */
export function makeTranslate(rawTranslate, lang) {
  return function translate(key, vars) {
    let text = '';
    if (typeof rawTranslate === 'function') {
      try {
        text = rawTranslate(key);
      } catch (error) {
        text = '';
      }
    }
    if (!text || text === key) text = lookupMessage(lang, key);
    return interpolate(text, vars);
  };
}
