/**
 * Locale dictionaries for the panel's own UI.
 *
 * The Host reads `locale/*.json` for the plugin's *display metadata* (title,
 * description, icon). This table is what the panel, the startup notice and the
 * typhoon view render, registered through the Client locale service so all of
 * them follow the Harness language switch.
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
    'proxy.hint': '当前出口 IP 显示为「{country}」，可能开了代理/VPN。若定位不对，请手动切换城市。',
    'proxy.action': '手动切换城市',
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
    'forecast.title': '未来 5 天',
    'hourly.title': '未来 24 小时',
    'hourly.now': '现在',
    'chart.title': '逐小时降水',
    'chart.amount': '降水量',
    'chart.chance': '降水概率',
    'chart.empty': '未来 24 小时基本无降水',
    'tab.weather': '天气',
    'tab.typhoon': '台风',
    'alerts.title': '气象预警',
    'alerts.none': '当前没有生效的预警',
    'alerts.count': '{n} 条生效',
    'alerts.scopeCity': '本市',
    'alerts.scopeRegion': '本省',
    'alerts.more': '另有 {n} 条',
    'alerts.source': '中央气象台 · 中国气象局',
    'alerts.openAll': '查看全部预警',
    'alert.level.blue': '蓝色',
    'alert.level.yellow': '黄色',
    'alert.level.orange': '橙色',
    'alert.level.red': '红色',
    'notice.title': '天气提醒',
    'notice.rainTitle': '今天有降水',
    'notice.rainBody': '预计降水量 {amount}，降水概率最高 {chance}。出门记得带伞。',
    'notice.alertTitle': '收到气象预警',
    'notice.alertBody': '当前有 {count} 条生效预警，最高等级：{level}。',
    'notice.confirm': '知道了',
    'notice.dismiss': '关闭提醒',
    'notice.more': '还有 {n} 条',
    'notice.source': '数据：Open-Meteo · 中央气象台',
    'typhoon.title': '台风路径',
    'typhoon.active': '活跃',
    'typhoon.ended': '已结束',
    'typhoon.none': '当前没有台风信息',
    'typhoon.latest': '最近定位',
    'typhoon.pressure': '中心气压',
    'typhoon.wind': '最大风速',
    'typhoon.move': '移动',
    'typhoon.forecast': '未来路径',
    'typhoon.peak': '最强强度',
    'typhoon.meaning': '名称含义',
    'typhoon.source': '中央气象台台风网',
    'typhoon.official': '查看官方路径图',
    'typhoon.land': '底图：Natural Earth（公有领域）',
    'typhoon.select': '切换台风',
    'typhoon.hint': '点击轨迹点查看该时刻详情',
    'typhoon.windRadius': '风圈半径',
    'typhoon.updated': '更新于 {time}',
    'typhoon.noForecast': '暂无预报路径',
    'location.title': '位置来源',
    'location.description': '默认按公网 IP 判断城市（城市级精度）。如果你开了网络代理 / VPN，IP 会变成代理出口，城市会判错——这种情况下请直接在下面搜索并手动切换城市，或用「系统定位」。',
    'location.auto': '自动（网络定位）',
    'location.autoHint': '重新检测当前网络所在城市',
    'location.gps': '使用系统定位',
    'location.gpsHint': '调用浏览器地理位置，精度更高',
    'location.precise': '高精度系统定位',
    'location.preciseHint': '开启后每次启动都优先使用浏览器 / 系统定位（会请求一次定位权限）；不可用时自动回退到 IP。',
    'location.gpsFallback': '系统定位不可用，本次已回退到网络定位。',
    'panel.subtitleGpsAccurate': '系统定位 · 精度约 {accuracy} 米',
    'location.searchTitle': '搜索城市',
    'location.placeholder': '输入城市名，例如 青岛',
    'location.searching': '搜索中…',
    'location.noResult': '没有找到匹配的城市。',
    'footer.weather': '天气数据',
    'footer.location': '定位数据',
    'footer.alerts': '预警数据',
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
    'proxy.hint': 'This network exits in “{country}”, which usually means a proxy or VPN is on. If the location is wrong, switch the city manually.',
    'proxy.action': 'Pick a city',
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
    'forecast.title': 'Next 5 days',
    'hourly.title': 'Next 24 hours',
    'hourly.now': 'Now',
    'chart.title': 'Hourly precipitation',
    'chart.amount': 'Amount',
    'chart.chance': 'Chance',
    'chart.empty': 'Almost no rain in the next 24 hours',
    'tab.weather': 'Weather',
    'tab.typhoon': 'Typhoon',
    'alerts.title': 'Weather alerts',
    'alerts.none': 'No active alerts',
    'alerts.count': '{n} active',
    'alerts.scopeCity': 'City',
    'alerts.scopeRegion': 'Province',
    'alerts.more': '{n} more',
    'alerts.source': 'NMC · China Meteorological Administration',
    'alerts.openAll': 'See all alerts',
    'alert.level.blue': 'Blue',
    'alert.level.yellow': 'Yellow',
    'alert.level.orange': 'Orange',
    'alert.level.red': 'Red',
    'notice.title': 'Weather notice',
    'notice.rainTitle': 'Rain today',
    'notice.rainBody': 'About {amount} expected, chance up to {chance}. Take an umbrella.',
    'notice.alertTitle': 'Weather alert received',
    'notice.alertBody': '{count} active alert(s), highest level: {level}.',
    'notice.confirm': 'Got it',
    'notice.dismiss': 'Dismiss',
    'notice.more': '{n} more',
    'notice.source': 'Data: Open-Meteo · NMC',
    'typhoon.title': 'Typhoon track',
    'typhoon.active': 'Active',
    'typhoon.ended': 'Ended',
    'typhoon.none': 'No typhoon information',
    'typhoon.latest': 'Latest fix',
    'typhoon.pressure': 'Central pressure',
    'typhoon.wind': 'Max wind',
    'typhoon.move': 'Moving',
    'typhoon.forecast': 'Forecast track',
    'typhoon.peak': 'Peak intensity',
    'typhoon.meaning': 'Name meaning',
    'typhoon.source': 'NMC typhoon service',
    'typhoon.official': 'Open official map',
    'typhoon.land': 'Basemap: Natural Earth (public domain)',
    'typhoon.select': 'Switch typhoon',
    'typhoon.hint': 'Click a track point for that moment',
    'typhoon.windRadius': 'Wind radius',
    'typhoon.updated': 'Updated {time}',
    'typhoon.noForecast': 'No forecast track yet',
    'location.title': 'Location source',
    'location.description': 'The city is derived from your public IP (city-level accuracy). If a proxy or VPN is on, the IP belongs to its exit and the city will be wrong — in that case search for your city below and switch manually, or use device location.',
    'location.auto': 'Automatic (network)',
    'location.autoHint': 'Detect the city this network belongs to',
    'location.gps': 'Use device location',
    'location.gpsHint': 'Uses the browser geolocation API for better accuracy',
    'location.precise': 'High-accuracy device location',
    'location.preciseHint': 'When on, every start prefers the browser / system location (asks for permission once) and falls back to the IP when unavailable.',
    'location.gpsFallback': 'Device location unavailable; fell back to network location this time.',
    'panel.subtitleGpsAccurate': 'Device location · ~{accuracy} m',
    'location.searchTitle': 'Search a city',
    'location.placeholder': 'City name, e.g. Qingdao',
    'location.searching': 'Searching…',
    'location.noResult': 'No matching city.',
    'footer.weather': 'Weather data',
    'footer.location': 'Location data',
    'footer.alerts': 'Alert data',
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
