/**
 * WMO 4677 weather codes → stable presentation data.
 *
 * Open-Meteo reports `weather_code` as a WMO 4677 number. Mapping it here keeps
 * wording, icon group and severity in one table instead of scattering `if`
 * chains through the view, and it lets the whole table be unit-tested.
 */

/** Every code Open-Meteo can return, with neutral wording and a severity hint. */
export const WMO_TABLE = {
  0: { icon: 'clear', zh: '晴', en: 'Clear sky', severity: 0 },
  1: { icon: 'mostly-clear', zh: '大部晴朗', en: 'Mainly clear', severity: 0 },
  2: { icon: 'partly-cloudy', zh: '局部多云', en: 'Partly cloudy', severity: 0 },
  3: { icon: 'overcast', zh: '阴', en: 'Overcast', severity: 1 },
  45: { icon: 'fog', zh: '雾', en: 'Fog', severity: 1 },
  48: { icon: 'fog', zh: '凇雾', en: 'Depositing rime fog', severity: 1 },
  51: { icon: 'drizzle', zh: '小毛毛雨', en: 'Light drizzle', severity: 1 },
  53: { icon: 'drizzle', zh: '毛毛雨', en: 'Moderate drizzle', severity: 1 },
  55: { icon: 'drizzle', zh: '大毛毛雨', en: 'Dense drizzle', severity: 2 },
  56: { icon: 'sleet', zh: '轻冻毛毛雨', en: 'Light freezing drizzle', severity: 2 },
  57: { icon: 'sleet', zh: '冻毛毛雨', en: 'Dense freezing drizzle', severity: 2 },
  61: { icon: 'rain', zh: '小雨', en: 'Slight rain', severity: 1 },
  63: { icon: 'rain', zh: '中雨', en: 'Moderate rain', severity: 2 },
  65: { icon: 'rain', zh: '大雨', en: 'Heavy rain', severity: 3 },
  66: { icon: 'sleet', zh: '轻冻雨', en: 'Light freezing rain', severity: 2 },
  67: { icon: 'sleet', zh: '冻雨', en: 'Heavy freezing rain', severity: 3 },
  71: { icon: 'snow', zh: '小雪', en: 'Slight snow', severity: 1 },
  73: { icon: 'snow', zh: '中雪', en: 'Moderate snow', severity: 2 },
  75: { icon: 'snow', zh: '大雪', en: 'Heavy snow', severity: 3 },
  77: { icon: 'snow', zh: '米雪', en: 'Snow grains', severity: 1 },
  80: { icon: 'showers', zh: '小阵雨', en: 'Slight rain showers', severity: 1 },
  81: { icon: 'showers', zh: '阵雨', en: 'Moderate rain showers', severity: 2 },
  82: { icon: 'showers', zh: '强阵雨', en: 'Violent rain showers', severity: 3 },
  85: { icon: 'snow', zh: '小阵雪', en: 'Slight snow showers', severity: 1 },
  86: { icon: 'snow', zh: '阵雪', en: 'Heavy snow showers', severity: 2 },
  95: { icon: 'thunder', zh: '雷暴', en: 'Thunderstorm', severity: 3 },
  96: { icon: 'thunder', zh: '雷暴伴小冰雹', en: 'Thunderstorm with slight hail', severity: 3 },
  99: { icon: 'thunder', zh: '雷暴伴大冰雹', en: 'Thunderstorm with heavy hail', severity: 3 }
};

/** Used for a missing or unknown code; never throws on odd upstream data. */
export const WMO_FALLBACK = { icon: 'unknown', zh: '未知天气', en: 'Unknown', severity: 0 };

/**
 * Describe one WMO code.
 * @param {unknown} code raw `weather_code` from the API
 * @returns {{code: number|null, icon: string, zh: string, en: string, severity: number}}
 */
export function describeWeather(code) {
  const numeric = Number(code);
  if (!Number.isFinite(numeric)) return { code: null, ...WMO_FALLBACK };
  const entry = WMO_TABLE[Math.trunc(numeric)];
  if (!entry) return { code: Math.trunc(numeric), ...WMO_FALLBACK };
  return { code: Math.trunc(numeric), ...entry };
}

/** Convert a WMO code into the drawing group used by the weather glyph. */
export function weatherIconFor(code, isDay) {
  const described = describeWeather(code);
  if (described.icon === 'clear' && isDay === false) return 'moon';
  return described.icon;
}

/** Localized label for a WMO code. */
export function weatherLabel(code, lang) {
  const described = describeWeather(code);
  return lang === 'en' ? described.en : described.zh;
}
