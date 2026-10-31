/**
 * Startup weather notice.
 *
 * Two things can interrupt the user:
 *   1. an active CMA alert (or rain inside a **rolling 12-hour window**, not
 *      "today"), so a shower that ended at 02:00 no longer nags at 08:00;
 *   2. an optional **daily digest** at a wall-clock time the user chose.
 *
 * Quiet hours (off by default) silence the rain part only — alerts are safety
 * information and always show.
 *
 * This lives in the `shell.overlay` slot (frame-wide floating layer) rather than
 * inside the panel, because the panel only mounts when the user opens it — the
 * notice must be able to appear without anyone opening the panel.
 *
 * Readability: under the liquid-glass theme the alias background tokens are
 * translucent, so the card reads the resolved colours once and paints an opaque
 * surface (see `src/lib/surface.js`); the modal is also larger than it used to
 * be so the text has room.
 *
 * Dedupe: the acknowledgement stores `{date, signature}` where the signature
 * carries a rain **event fingerprint**, so the same shower is acknowledged once
 * while a new one may still notify.
 */

/* `summarizeRainWindow`, `noticeSignature`, `shouldNotify`, `isWithinQuietHours`,
 * `isDailyReminderDue` live in `src/lib/notice-core.js`; `resolveOpaqueSurface`
 * lives in `src/lib/surface.js` — both are unit-tested. This file is the
 * presentation and the acknowledgement handling. */

function alertLevelLabel(alert, lang) {
  if (!alert) return '';
  return lang === 'en' ? (alert.levelEn || '') : (alert.levelZh || '');
}

/** Read the colour the browser actually paints for this element. */
function readComputedColor(element) {
  try {
    if (!element || typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return '';
    return String(window.getComputedStyle(element).color || '');
  } catch (error) {
    return '';
  }
}

function NoticeAlertRow(props) {
  const { alert, lang, t } = props;
  return h('a', {
    className: `dshw-notice-alert dshw-notice-alert-${alert.level || 'blue'}`,
    href: alert.url || 'https://www.nmc.cn/publish/alarm.html',
    target: '_blank',
    rel: 'noreferrer noopener'
  },
    h('span', { className: `dshw-level-chip dshw-level-${alert.level || 'blue'}` }, alertLevelLabel(alert, lang) || '—'),
    h('span', { className: 'dshw-notice-alert-main' },
      h('span', { className: 'dshw-notice-alert-text' }, alert.title),
      h('span', { className: 'dshw-notice-alert-meta' },
        [alertGradeLabel(alert.level, lang), alert.issuedText].filter(Boolean).join(' · '),
        t ? ` · ${t('notice.officialLink')}` : ''
      )
    )
  );
}

/** The overlay component registered into `shell.overlay`. */
function WeatherNotice(props) {
  const store = props.store;
  const t = props.t;
  const activeLocale = useActiveLocale(props.locale);
  const lang = String(activeLocale || '').toLowerCase().startsWith('en') ? 'en' : 'zh';
  const state = useWeatherStore(store);
  const [handled, setHandled] = React.useState('');
  const [tick, setTick] = React.useState(() => Date.now());
  const [surface, setSurface] = React.useState(null);
  const modalRef = React.useRef(null);
  const [dailyAck, setDailyAck] = React.useState(() => readDailyReminderState());
  const primaryRef = React.useRef(null);

  // Re-evaluate quiet hours and the daily reminder even when no data changes.
  React.useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const now = new Date(tick);
  const date = todayKey(now);
  const settings = state.settings || {};
  const units = settings.units === 'imperial' ? 'imperial' : 'metric';
  const quietHours = settings.quietHours || { enabled: false, start: '23:00', end: '07:00' };
  const dailyReminder = settings.dailyReminder || { enabled: false, time: '08:00' };

  const allAlerts = Array.isArray(state.alerts) ? state.alerts : [];
  const levelNotice = settings.alertNotice || DEFAULT_ALERT_NOTICE;
  const levelStrong = settings.alertStrong || DEFAULT_ALERT_STRONG;
  // 同市其他区县的预警只在「预警」栏里作参考，不参与弹窗。
  const relevantAlerts = allAlerts.filter(alert => alert.scope !== 'other');
  // 「预览」是你主动点出来的，即使该等级的提醒开关是关的也要照常弹一次。
  const previewAlerts = relevantAlerts.filter(alert => alert.preview);
  const alerts = previewAlerts.length > 0
    ? previewAlerts
    : filterAlertsByLevels(relevantAlerts, levelNotice);
  const hasAlert = alerts.length > 0;

  const rain = summarizeRainWindow(state.forecast, { hours: RAIN_WINDOW_HOURS });
  const quietActive = isWithinQuietHours(now, quietHours);
  // Quiet hours only silence the rain part; alerts always show.
  const rainForNotice = rain && rain.kind !== 'none' && !quietActive ? rain : null;
  const signature = noticeSignature(rainForNotice, alerts);
  const stored = readNoticeState();
  const noticeVisible = shouldNotify({
    summary: rainForNotice,
    alerts,
    stored,
    handled,
    date,
    hasForecast: Boolean(state.forecast),
    // Demo/preview mode ignores the acknowledgements so the dialog can be
    // inspected again on every reload; the real path never sets this.
    force: Boolean(readDemoAlertKind())
  });

  const dailyDue = isDailyReminderDue(now, dailyReminder);
  const dailyVisible = Boolean(state.forecast) && dailyDue && dailyAck !== date && !previewAlerts.length;
  const visible = dailyVisible || noticeVisible;

  // The card paints its own opaque surface: the theme tokens are unreliable
  // under the liquid-glass effect (a real bug showed a white card with the dark
  // theme's pale-blue text), so we measure the colour the browser actually
  // renders and pick its opposite pole. Runs before paint to avoid a flash.
  const useLayout = typeof React.useLayoutEffect === 'function' ? React.useLayoutEffect : React.useEffect;
  useLayout(() => {
    if (!visible) return;
    const element = modalRef.current;
    const next = contrastSurfaceFor(readComputedColor(element));
    if (next) setSurface(next);
  }, [visible, dailyVisible]);

  const strongAlerts = alerts.filter(alert => levelStrong[alert.level] === true);
  const strong = strongAlerts.length > 0;

  React.useEffect(() => {
    if (!visible) return undefined;
    const onKeyDown = event => {
      if (event.key === 'Escape') acknowledge();
    };
    document.addEventListener('keydown', onKeyDown);
    if (primaryRef.current && typeof primaryRef.current.focus === 'function') primaryRef.current.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [visible, signature, dailyVisible]);

  function acknowledge() {
    if (noticeVisible) {
      writeNoticeState({ date, signature, confirmedAt: Date.now() });
      setHandled(signature);
    }
    if (dailyVisible) {
      writeDailyReminderState(date);
      setDailyAck(date);
    }
    // A demo alert is a one-shot preview: acknowledging it clears the switch so
    // the next refresh goes back to the real feed instead of nagging forever.
    if (allAlerts.some(alert => alert.demo)) {
      clearDemoAlert();
      store.refresh({ force: true });
    }
  }

  if (!visible) return null;

  const highest = hasAlert ? alerts[0] : null;
  const accent = highest ? alertLevelColor(highest.level) : '';
  // 白字压在黄色上对比度只有 1.9:1，黄色等级改用深褐字。
  const accentInk = highest && highest.level === 'yellow' ? '#3f2d00' : '#ffffff';
  const shown = alerts.slice(0, 3);
  const remaining = alerts.length - shown.length;
  const current = state.forecast ? state.forecast.current : null;
  const today = state.forecast && state.forecast.daily && state.forecast.daily[0] ? state.forecast.daily[0] : null;
  const modalStyle = surface ? { background: surface.background } : undefined;
  const primaryStyle = surface ? { background: surface.ink, color: surface.background, borderColor: 'transparent' } : undefined;
  const rainText = rainTextFor(rain, t, units);

  if (dailyVisible) {
    return h('div', { className: 'dshw-modal-root' },
      h('style', { 'data-dsh-weather-panel-style': 'notice' }, WEATHER_MODAL_CSS),
      h('div', { className: 'dshw-modal-backdrop', onClick: acknowledge }),
      h('div', {
        className: 'dshw-modal dshw-modal-daily',
        ref: modalRef,
        style: modalStyle,
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'dshw-notice-title',
        onClick: event => event.stopPropagation()
      },
        h('header', { className: 'dshw-modal-head' },
          h('div', { className: 'dshw-modal-icon' },
            h(WeatherGlyph, { code: current && Number.isFinite(current.weatherCode) ? current.weatherCode : 0, isDay: true, size: 46 })
          ),
          h('div', { className: 'dshw-modal-titles' },
            h('h2', { className: 'dshw-modal-title', id: 'dshw-notice-title' }, t('notice.dailyTitle')),
            h('span', { className: 'dshw-note' }, state.location && state.location.label ? state.location.label : '')
          ),
          h('button', {
            type: 'button',
            className: 'dshw-btn dshw-btn-icon',
            onClick: acknowledge,
            title: t('notice.dismiss'),
            'aria-label': t('notice.dismiss')
          }, h(CloseGlyph, { size: 14 }))
        ),
        h('div', { className: 'dshw-modal-body dshw-daily-body' },
          h('div', { className: 'dshw-daily-now' },
            h('span', { className: 'dshw-daily-temp' },
              formatTemperature(current && current.temperature, units)),
            h('span', { className: 'dshw-daily-cond' },
              weatherLabel(current && current.weatherCode, lang),
              today
                ? ` · ${t('notice.todayRange', {
                  high: formatTemperature(today.temperatureMax, units),
                  low: formatTemperature(today.temperatureMin, units)
                })}`
                : ''
            )
          ),
          h('p', { className: 'dshw-notice-text' },
            rain && rain.kind !== 'none' ? rainText : t('notice.rainNone')
          ),
          h('p', { className: 'dshw-note' },
            hasAlert
              ? t('notice.dailyAlerts', { n: alerts.length })
              : t('notice.dailyNoAlerts')
          )
        ),
        h('footer', { className: 'dshw-modal-foot' },
          h('span', { className: 'dshw-note' }, t('notice.source')),
          h('div', { className: 'dshw-notice-actions' },
            h('button', {
              type: 'button',
              className: 'dshw-btn dshw-btn-primary',
              style: primaryStyle,
              onClick: acknowledge,
              ref: primaryRef
            }, t('notice.confirm'))
          )
        )
      )
    );
  }

  return h('div', { className: 'dshw-modal-root' },
    h('style', { 'data-dsh-weather-panel-style': 'notice' }, WEATHER_MODAL_CSS),
    h('div', { className: 'dshw-modal-backdrop', onClick: acknowledge }),
    h('div', {
      className: `dshw-modal${strong ? ' dshw-modal-strong' : ''}`,
      ref: modalRef,
      style: { ...(modalStyle || {}), ...(accent ? { '--dshw-alert-accent': accent } : {}) },
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'dshw-notice-title',
      onClick: event => event.stopPropagation()
    },
      strong
        ? h('div', { className: 'dshw-notice-strong-bar', role: 'note', style: { color: accentInk } },
          h('span', { className: 'dshw-notice-strong-dot', 'aria-hidden': 'true', style: { background: accentInk } }),
          t('notice.strong', { level: alertLevelLabel(highest, lang) || '' })
        )
        : null,
      h('header', { className: 'dshw-modal-head' },
        h('div', { className: 'dshw-modal-icon' },
          h(WeatherGlyph, { code: hasAlert ? 95 : 61, isDay: false, size: strong ? 50 : 42 })
        ),
        h('div', { className: 'dshw-modal-titles' },
          h('h2', { className: 'dshw-modal-title', id: 'dshw-notice-title' }, t('notice.title')),
          h('span', { className: 'dshw-note' }, state.location && state.location.label ? state.location.label : '')
        ),
        h('button', {
          type: 'button',
          className: 'dshw-btn dshw-btn-icon',
          onClick: acknowledge,
          title: t('notice.dismiss'),
          'aria-label': t('notice.dismiss')
        }, h(CloseGlyph, { size: 14 }))
      ),
      h('div', { className: 'dshw-modal-body' },
        hasAlert
          ? h('section', { className: 'dshw-notice-block' },
            h('h3', { className: 'dshw-notice-heading' },
              t('notice.alertTitle'),
              h('span', { className: `dshw-level-chip dshw-level-${highest.level || 'blue'}` }, alertLevelLabel(highest, lang) || ''),
              h('span', { className: 'dshw-notice-grade' }, alertGradeLabel(highest.level, lang))
            ),
            h('p', { className: 'dshw-note' }, t('notice.alertBody', {
              count: alerts.length,
              level: alertLevelLabel(highest, lang) || '—'
            })),
            h('div', { className: 'dshw-notice-list' }, shown.map(alert => h(NoticeAlertRow, { key: alert.id, alert, lang, t }))),
            remaining > 0 ? h('p', { className: 'dshw-note' }, t('notice.more', { n: remaining })) : null
          )
          : null,
        rainForNotice
          ? h('section', { className: 'dshw-notice-block' },
            h('h3', { className: 'dshw-notice-heading' }, t('notice.rainWindowTitle')),
            h('p', { className: 'dshw-notice-text' }, rainText)
          )
          : null,
        quietActive && rain && rain.kind !== 'none' && hasAlert
          ? h('p', { className: 'dshw-note' }, t('notice.quietNote'))
          : null,
        allAlerts.length > alerts.length
          ? h('p', { className: 'dshw-note' }, t('notice.filtered', { n: allAlerts.length - alerts.length }))
          : null
      ),
      h('footer', { className: 'dshw-modal-foot' },
        h('span', { className: 'dshw-note' }, t('notice.source')),
        h('div', { className: 'dshw-notice-actions' },
          hasAlert
            ? h('button', {
              type: 'button',
              className: 'dshw-notice-mute',
              style: surface ? { color: surface.ink } : undefined,
              // 直接在弹窗里关掉这一级，比让用户跑去设置页更顺手；关完照常确认。
              onClick: () => {
                store.setAlertNoticeLevel(highest.level, false);
                acknowledge();
              }
            }, t('notice.muteLevel', { level: alertLevelLabel(highest, lang) }))
            : null,
          h('button', {
            type: 'button',
            className: 'dshw-btn dshw-btn-primary',
            style: primaryStyle,
            onClick: acknowledge,
            ref: primaryRef
          }, t('notice.confirm'))
        )
      )
    )
  );
}

/** The rain sentence for the current window event. */
function rainTextFor(rain, t, units) {
  if (!rain || rain.kind === 'none') return '';
  const amount = formatPrecipitation(rain.amount, units);
  const chance = formatPercent(rain.maxChance);
  if (rain.kind === 'now') {
    return rain.endLabel && rain.hours > 1
      ? t('notice.rainNow', { end: rain.endLabel, amount })
      : t('notice.rainNowOpen', { amount });
  }
  if (rain.hours <= 1) return t('notice.rainShort', { start: rain.startLabel, chance });
  return t('notice.rainSoon', {
    start: rain.startLabel,
    end: rain.endLabel,
    amount,
    chance
  });
}
