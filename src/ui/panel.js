/**
 * The weather panel: view layer only.
 *
 * Data, caching and the ten-minute refresh loop live in `store.js` so the
 * startup notice can share them. This file renders from the store, owns the tab
 * state and the location picker, and keeps every style inside one <style>
 * element (see styles.js) so nothing leaks globally.
 */

const PANEL_FORECAST_DAYS = 5;
const PANEL_STALE_AFTER_MS = 30 * 60 * 1000;

function readActiveLocale(localeService) {
  if (!localeService || typeof localeService.getSnapshot !== 'function') return '';
  try {
    const snapshot = localeService.getSnapshot();
    return snapshot && snapshot.active !== undefined ? String(snapshot.active) : '';
  } catch (error) {
    return '';
  }
}

/**
 * Track the active language as a plain string.
 *
 * Deliberately not `useSyncExternalStore`: it would require the locale snapshot
 * object to be referentially stable, and a Host that rebuilt it per call would
 * throw "The result of getSnapshot should be cached" and blank the slot.
 */
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

function ParameterList(props) {
  const items = props.items;
  return h('div', { className: 'dshw-grid' },
    items.map(item => h('div', { className: 'dshw-param', key: item.key || item.label },
      h('span', { className: 'dshw-param-k' }, item.label),
      h('span', { className: 'dshw-param-v' }, item.value)
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
  const { t, units, hours, currentTime } = props;
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

function AlertsBanner(props) {
  const { alerts, t, lang } = props;
  const [expanded, setExpanded] = React.useState(false);
  if (!alerts || alerts.length === 0) return null;

  const listId = 'dshw-alerts-list';
  const visible = expanded ? alerts : alerts.slice(0, 1);
  const hidden = alerts.length - visible.length;

  return h('section', { className: `dshw-card dshw-alerts${expanded ? ' dshw-alerts-expanded' : ''}` },
    h('div', { className: 'dshw-alerts-head' },
      h('h2', { className: 'dshw-section-title' }, t('alerts.title')),
      h('div', { className: 'dshw-alerts-head-right' },
        h('span', { className: 'dshw-note' },
          `${t('alerts.count', { n: alerts.length })} · ${t('alerts.source')}`
        ),
        alerts.length > 1
          ? h('button', {
            type: 'button',
            className: 'dshw-alerts-toggle',
            'aria-expanded': expanded ? 'true' : 'false',
            'aria-controls': listId,
            onClick: () => setExpanded(value => !value)
          },
            expanded ? t('alerts.collapse') : t('alerts.expand'),
            h('span', { className: `dshw-caret${expanded ? ' dshw-caret-up' : ''}`, 'aria-hidden': 'true' })
          )
          : null
      )
    ),
    h('div', { className: 'dshw-alert-list', id: listId },
      visible.map(alert => h('a', {
        className: 'dshw-alert-row',
        key: alert.id,
        href: alert.url || 'https://www.nmc.cn/publish/alarm.html',
        target: '_blank',
        rel: 'noreferrer noopener'
      },
        h('span', { className: `dshw-level-chip dshw-level-${alert.level || 'blue'}` },
          lang === 'en' ? (alert.levelEn || 'Alert') : (alert.levelZh || '预警')
        ),
        h('span', { className: 'dshw-alert-text' }, alert.title),
        h('span', { className: 'dshw-alert-scope' },
          alert.scope === 'city' ? t('alerts.scopeCity') : t('alerts.scopeRegion')
        )
      ))
    ),
    h('div', { className: 'dshw-alerts-foot' },
      !expanded && hidden > 0 ? h('span', { className: 'dshw-note' }, t('alerts.more', { n: hidden })) : h('span', null),
      h('a', {
        className: 'dshw-link',
        href: 'https://www.nmc.cn/publish/alarm.html',
        target: '_blank',
        rel: 'noreferrer noopener'
      }, t('alerts.openAll'))
    )
  );
}

function ProxyHint(props) {
  const { location, t, onPick } = props;
  if (!location || location.source !== 'network') return null;
  const code = String(location.countryCode || '').toUpperCase();
  if (!code || code === 'CN') return null;
  return h('div', { className: 'dshw-hint', role: 'note' },
    h('span', { className: 'dshw-hint-text' }, t('proxy.hint', { country: code })),
    h('button', { type: 'button', className: 'dshw-btn', onClick: onPick }, t('proxy.action'))
  );
}

function LocationPicker(props) {
  const { t, lang, settings, onClose, onAuto, onTogglePrecise, onPreviewNotice, onSelect } = props;
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
    h('div', { className: 'dshw-switch-row' },
      h('div', { className: 'dshw-switch-text' },
        h('span', { className: 'dshw-switch-label' }, h(GpsGlyph, { size: 14 }), t('location.precise')),
        h('span', { className: 'dshw-note' }, t('location.preciseHint'))
      ),
      h('div', {
        className: 'dshw-switch-control',
        'data-on': settings.preciseLocation ? 'true' : 'false'
      },
        h('span', { className: 'dshw-switch-state' },
          settings.preciseLocation ? t('location.preciseOn') : t('location.preciseOff')),
        h('button', {
          type: 'button',
          role: 'switch',
          'aria-checked': settings.preciseLocation ? 'true' : 'false',
          'aria-label': t('location.precise'),
          className: `dshw-switch ${settings.preciseLocation ? 'dshw-switch-on' : ''}`,
          onClick: () => onTogglePrecise(!settings.preciseLocation)
        }, h('span', { className: 'dshw-switch-knob' }))
      )
    ),
    h('div', { className: 'dshw-picker-actions' },
      h('button', { type: 'button', className: 'dshw-btn', onClick: onAuto }, h(PinGlyph), t('location.auto')),
      h('button', {
        type: 'button',
        className: 'dshw-btn',
        onClick: onPreviewNotice,
        title: t('location.previewNoticeHint')
      }, h(RefreshGlyph, { size: 13 }), t('location.previewNotice'))
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
  return h('div', { className: 'dshw-loading', 'aria-live': 'polite' },
    h('div', { className: 'dshw-skeleton' }),
    h('p', { className: 'dshw-note' }, props.label)
  );
}

function PanelFooter(props) {
  const { t, state } = props;
  const provider = state.location && state.location.provider ? state.location.provider : '';
  return h('footer', { className: 'dshw-footer' },
    h('span', null,
      `${t('footer.weather')}: `,
      h('a', { href: 'https://open-meteo.com/', target: '_blank', rel: 'noreferrer noopener' }, 'Open-Meteo'),
      ` · ${t('footer.license')}`
    ),
    h('span', null,
      `${t('footer.alerts')}: `,
      h('a', { href: 'https://www.nmc.cn/publish/alarm.html', target: '_blank', rel: 'noreferrer noopener' }, '中央气象台')
    ),
    h('span', null,
      `${t('footer.location')}: `,
      h('a', { href: 'https://ipwho.is/', target: '_blank', rel: 'noreferrer noopener' }, provider || 'IP'),
      ' · ',
      h('a', { href: 'https://www.bigdatacloud.com/', target: '_blank', rel: 'noreferrer noopener' }, 'BigDataCloud')
    ),
    h('span', null, t('footer.note')),
    h('span', { className: 'dshw-footer-feedback' },
      h('a', {
        href: PROJECT_NEW_ISSUE_URL,
        target: '_blank',
        rel: 'noreferrer noopener',
        title: PROJECT_ISSUES_URL
      }, t('footer.feedback'))
    )
  );
}

/** Panel body for the weather tab. */
function WeatherTab(props) {
  const { t, lang, units, forecast, current, today, upcoming, hours } = props;
  if (!forecast) return null;
  return h(React.Fragment, null,
    h(NowSection, { t, lang, units, current, today }),
    h('section', { className: 'dshw-section' },
      h('div', { className: 'dshw-section-head' },
        h('h2', { className: 'dshw-section-title' }, t('forecast.title'))
      ),
      h('div', { className: 'dshw-forecast' },
        upcoming.map((day, index) => h(ForecastCard, {
          key: day.date || `day-${index}`,
          t,
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
          h('h2', { className: 'dshw-section-title' }, t('hourly.title'))
        ),
        h(PrecipitationChart, { hours, units, t, lang }),
        h(HourlyStrip, { t, units, hours, currentTime: current && current.time })
      )
      : null
  );
}

/** The panel component registered into the `main` slot. */
function WeatherPanel(props) {
  const store = props.store;
  const rawTranslate = props && typeof props.t === 'function' ? props.t : key => key;
  const activeLocale = useActiveLocale(props ? props.locale : null);
  const lang = String(activeLocale || '').toLowerCase().startsWith('en') ? 'en' : 'zh';
  const translate = React.useCallback((key, vars) => {
    try {
      const text = rawTranslate(key);
      return interpolate(text === key ? lookupMessage(lang, key) : text, vars);
    } catch (error) {
      return lookupMessage(lang, key);
    }
  }, [rawTranslate, lang]);

  const state = useWeatherStore(store);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [tab, setTab] = React.useState('weather');

  React.useEffect(() => {
    store.setLanguage(lang, translate);
  }, [store, lang, translate]);

  const typhoonAvailable = Boolean(state.typhoon);
  React.useEffect(() => {
    if (tab === 'typhoon' && !typhoonAvailable) setTab('weather');
  }, [tab, typhoonAvailable]);

  const closePanel = props ? props.closePanel : null;
  const settings = state.settings;
  const units = settings.units;
  const forecast = state.forecast;
  const current = forecast ? forecast.current : null;
  const daily = forecast ? forecast.daily : [];
  const today = daily && daily[0] ? daily[0] : null;
  const upcoming = upcomingDays(daily, PANEL_FORECAST_DAYS);
  const hours = forecast ? selectUpcomingHours(forecast.hourly, current && current.time, 24) : [];
  const isStale = Boolean(state.updatedAt) && Date.now() - state.updatedAt > PANEL_STALE_AFTER_MS;

  const subtitleParts = [];
  if (state.location) subtitleParts.push(state.location.label);
  if (state.location && state.location.source === 'network' && state.location.ip) {
    subtitleParts.push(translate('panel.subtitleNetwork', { ip: state.location.ip }));
  } else if (state.location && state.location.source === 'gps') {
    subtitleParts.push(isNumber(state.location.accuracy)
      ? translate('panel.subtitleGpsAccurate', { accuracy: state.location.accuracy })
      : translate('panel.subtitleGps'));
  } else if (state.location && state.location.source === 'manual') {
    subtitleParts.push(translate('panel.subtitleManual'));
  }
  if (state.updatedAt) subtitleParts.push(translate('panel.updated', { time: formatClockFromDate(new Date(state.updatedAt)) }));

  const openPicker = () => setPickerOpen(true);

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
            state.busy ? h('span', { className: 'dshw-chip dshw-chip-busy' }, translate('state.updating')) : null,
            isStale ? h('span', { className: 'dshw-chip dshw-chip-warn' }, translate('state.stale')) : null
          )
        ),
        h('div', { className: 'dshw-actions' },
          h('button', {
            type: 'button',
            className: 'dshw-btn dshw-btn-icon',
            onClick: () => store.refresh({ force: true }),
            title: translate('action.refresh'),
            'aria-label': translate('action.refresh'),
            disabled: state.busy
          }, h(RefreshGlyph)),
          h('button', {
            type: 'button',
            className: 'dshw-btn',
            onClick: () => store.toggleUnits(),
            title: units === 'imperial' ? translate('action.useMetric') : translate('action.useImperial'),
            'aria-label': units === 'imperial' ? translate('action.useMetric') : translate('action.useImperial')
          }, units === 'imperial' ? '°F' : '°C'),
          h('button', {
            type: 'button',
            className: 'dshw-btn',
            onClick: openPicker,
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
          settings,
          onClose: () => setPickerOpen(false),
          onAuto: () => {
            store.clearOverride();
            setPickerOpen(false);
          },
          onTogglePrecise: enabled => {
            store.setPreciseLocation(enabled);
            setPickerOpen(false);
          },
          onPreviewNotice: () => {
            store.showDemoAlert('typhoon-red');
            setPickerOpen(false);
          },
          onSelect: city => {
            store.selectCity(city);
            setPickerOpen(false);
          }
        })
        : null,

      state.locationWarning === 'gps-fallback'
        ? h('div', { className: 'dshw-hint', role: 'note' },
          h('span', { className: 'dshw-hint-text' }, translate('location.gpsFallback')),
          h('button', { type: 'button', className: 'dshw-btn', onClick: openPicker }, translate('action.changeLocation'))
        )
        : null,

      h(ProxyHint, { location: state.location, t: translate, onPick: openPicker }),

      state.error
        ? h('div', { className: 'dshw-alert', role: 'alert' },
          h('span', null, state.error),
          h('button', { type: 'button', className: 'dshw-btn', onClick: () => store.refresh({ force: true }) },
            translate('action.retry'))
        )
        : null,

      h(AlertsBanner, { alerts: state.alerts, t: translate, lang }),

      typhoonAvailable
        ? h('div', { className: 'dshw-tabs', role: 'tablist' },
          h('button', {
            type: 'button',
            role: 'tab',
            className: `dshw-tab ${tab === 'weather' ? 'dshw-tab-active' : ''}`,
            'aria-selected': tab === 'weather' ? 'true' : 'false',
            onClick: () => setTab('weather')
          }, translate('tab.weather')),
          h('button', {
            type: 'button',
            role: 'tab',
            className: `dshw-tab ${tab === 'typhoon' ? 'dshw-tab-active' : ''}`,
            'aria-selected': tab === 'typhoon' ? 'true' : 'false',
            onClick: () => setTab('typhoon')
          }, translate('tab.typhoon'))
        )
        : null,

      !forecast && tab === 'weather'
        ? h(PanelSkeleton, {
          label: state.phase === 'locating' ? translate('state.locating') : translate('state.loading')
        })
        : null,

      tab === 'weather' && forecast
        ? h(WeatherTab, { t: translate, lang, units, forecast, current, today, upcoming, hours })
        : null,

      tab === 'typhoon'
        ? h(TyphoonView, {
          typhoon: state.typhoon,
          typhoonList: state.typhoonList,
          t: translate,
          lang,
          onSelectTyphoon: id => store.selectTyphoon(id)
        })
        : null,

      h(PanelFooter, { t: translate, state })
    )
  );
}

function PanelStyles() {
  return h('style', { 'data-dsh-weather-panel-style': '' }, PANEL_CSS);
}
