/**
 * Startup weather notice.
 *
 * Requirement: when DSH opens and today has precipitation or an active alert,
 * show a modal that the user must acknowledge; show it again when a new alert
 * arrives later.
 *
 * This lives in the `shell.overlay` slot (frame-wide floating layer) rather than
 * inside the panel, because the panel only mounts when the user opens it — the
 * notice must be able to appear without anyone opening the panel. The overlay is
 * additive (`order`) and renders nothing at all on a quiet day.
 *
 * Level policy (settings → 预警): each level can be switched off entirely, and
 * each level can be marked "emphatic", which paints the modal in the alert's own
 * colour, enlarges the icon and adds a pulsing warning band — the point is that
 * a red signal must not look like a drizzle note.
 *
 * Dedupe: the acknowledgement stores `{date, signature}`; `signature` is the
 * sorted alert-id list plus a rain flag, so any *new* alert changes it and the
 * notice reappears, while the same state never nags twice in a day.
 */

/* `summarizeToday`, `noticeSignature` and `shouldNotify` live in
 * `src/lib/notice-core.js` so their branches are unit-tested; this file is the
 * presentation and the acknowledgement handling. */

function alertLevelLabel(alert, lang) {
  if (!alert) return '';
  return lang === 'en' ? (alert.levelEn || '') : (alert.levelZh || '');
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
  const primaryRef = React.useRef(null);

  const summary = summarizeToday(state.forecast);
  const units = state.settings && state.settings.units === 'imperial' ? 'imperial' : 'metric';
  const allAlerts = Array.isArray(state.alerts) ? state.alerts : [];
  const levelNotice = (state.settings && state.settings.alertNotice) || DEFAULT_ALERT_NOTICE;
  const levelStrong = (state.settings && state.settings.alertStrong) || DEFAULT_ALERT_STRONG;
  // The notice only speaks about levels the user asked to be told about; the
  // alerts tab still lists everything that is in force.
  // 同市其他区县的预警只在「预警」栏里作参考，不参与弹窗。
  const relevantAlerts = allAlerts.filter(alert => alert.scope !== 'other');
  // 「预览」是你主动点出来的，即使该等级的提醒开关是关的也要照常弹一次。
  const previewAlerts = relevantAlerts.filter(alert => alert.preview);
  const alerts = previewAlerts.length > 0
    ? previewAlerts
    : filterAlertsByLevels(relevantAlerts, levelNotice);
  const hasAlert = alerts.length > 0;
  const strongAlerts = alerts.filter(alert => levelStrong[alert.level] === true);
  const strong = strongAlerts.length > 0;
  const signature = noticeSignature(summary, alerts);
  const date = todayKey();
  const stored = readNoticeState();
  const visible = shouldNotify({
    summary,
    alerts,
    stored,
    handled,
    date,
    hasForecast: Boolean(state.forecast),
    // Demo/preview mode ignores the acknowledgements so the dialog can be
    // inspected again on every reload; the real path never sets this.
    force: Boolean(readDemoAlertKind())
  });

  React.useEffect(() => {
    if (!visible) return undefined;
    const onKeyDown = event => {
      if (event.key === 'Escape') acknowledge();
    };
    document.addEventListener('keydown', onKeyDown);
    if (primaryRef.current && typeof primaryRef.current.focus === 'function') primaryRef.current.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [visible, signature]);

  function acknowledge() {
    writeNoticeState({ date, signature, confirmedAt: Date.now() });
    setHandled(signature);
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
  const rainText = summary && summary.willRain
    ? t('notice.rainBody', {
      amount: formatPrecipitation(summary.amount, units),
      chance: formatPercent(summary.chance)
    })
    : '';

  return h('div', { className: 'dshw-modal-root' },
    h('style', { 'data-dsh-weather-panel-style': 'notice' }, WEATHER_MODAL_CSS),
    h('div', { className: 'dshw-modal-backdrop', onClick: acknowledge }),
    h('div', {
      className: `dshw-modal${strong ? ' dshw-modal-strong' : ''}`,
      style: accent ? { '--dshw-alert-accent': accent } : undefined,
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
          h(WeatherGlyph, { code: hasAlert ? 95 : 61, isDay: false, size: strong ? 48 : 40 })
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
        summary && summary.willRain
          ? h('section', { className: 'dshw-notice-block' },
            h('h3', { className: 'dshw-notice-heading' }, t('notice.rainTitle')),
            h('p', { className: 'dshw-notice-text' }, rainText)
          )
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
            onClick: acknowledge,
            ref: primaryRef
          }, t('notice.confirm'))
        )
      )
    )
  );
}
