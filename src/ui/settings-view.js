/**
 * Dedicated reminder settings page (a panel tab, not an overlay).
 *
 * The first attempt rendered an overlay reusing the notice's modal classes; but
 * that CSS is only injected when the notice itself is visible, so the sheet
 * appeared as an unstyled block in the document flow. It is a normal tab page
 * now, built from the panel's own card primitives, so it needs no modal styling
 * and changes nothing about the other views.
 *
 * Contents: notice frequency, quiet hours, the daily digest, the per-level
 * alert switches, and a preview button.
 */

function SettingsView(props) {
  const {
    t, lang, settings, onBack, onFrequency, onQuietHours, onDailyReminder,
    onNoticeLevel, onStrongLevel, onPreview
  } = props;
  const [previewLevel, setPreviewLevel] = React.useState('yellow');

  const safe = settings || {};
  const frequency = normalizeNoticeFrequency(safe.noticeFrequency);
  const preset = NOTICE_FREQUENCIES.find(item => item.key === frequency) || NOTICE_FREQUENCIES[2];
  const quiet = safe.quietHours || { enabled: false, start: '23:00', end: '07:00' };
  const daily = safe.dailyReminder || { enabled: false, time: '08:00' };
  const noticeMap = safe.alertNotice || DEFAULT_ALERT_NOTICE;
  const strongMap = safe.alertStrong || DEFAULT_ALERT_STRONG;
  const label = item => (lang === 'en' ? item.en : item.zh);

  return h('div', { className: 'dshw-settings-view' },
    h('div', { className: 'dshw-settings-head' },
      h('button', {
        type: 'button',
        className: 'dshw-btn',
        onClick: onBack
      }, `← ${t('settings.back')}`),
      h('h2', { className: 'dshw-section-title' }, t('settings.title'))
    ),
    h('p', { className: 'dshw-note' }, t('settings.subtitle')),

    h('section', { className: 'dshw-card dshw-settings-card' },
      h('h3', { className: 'dshw-settings-title' }, t('settings.frequency')),
      h('div', { className: 'dshw-segmented dshw-segmented-wrap', role: 'group', 'aria-label': t('settings.frequency') },
        NOTICE_FREQUENCIES.map(item => h('button', {
          key: item.key,
          type: 'button',
          className: `dshw-seg${item.key === frequency ? ' dshw-seg-active' : ''}`,
          'aria-pressed': item.key === frequency ? 'true' : 'false',
          onClick: () => onFrequency(item.key)
        }, label(item)))
      ),
      h('p', { className: 'dshw-note' }, t('settings.frequencyHint', { freq: label(preset) }))
    ),

    h('section', { className: 'dshw-card dshw-settings-card' },
      h('h3', { className: 'dshw-settings-title' }, t('alerts.quietTitle')),
      h('div', { className: 'dshw-settings-row' },
        h(SettingsToggle, {
          on: quiet.enabled,
          label: t('alerts.quietEnable'),
          onChange: value => onQuietHours({ enabled: value })
        }),
        h('label', { className: 'dshw-time-field' },
          h('span', null, t('alerts.quietFrom')),
          h('input', {
            type: 'time',
            value: quiet.start,
            onChange: event => onQuietHours({ start: event.target.value }),
            'aria-label': t('alerts.quietFrom')
          })
        ),
        h('label', { className: 'dshw-time-field' },
          h('span', null, t('alerts.quietTo')),
          h('input', {
            type: 'time',
            value: quiet.end,
            onChange: event => onQuietHours({ end: event.target.value }),
            'aria-label': t('alerts.quietTo')
          })
        )
      ),
      h('p', { className: 'dshw-note' }, t('alerts.quietHint'))
    ),

    h('section', { className: 'dshw-card dshw-settings-card' },
      h('h3', { className: 'dshw-settings-title' }, t('alerts.dailyTitle')),
      h('div', { className: 'dshw-settings-row' },
        h(SettingsToggle, {
          on: daily.enabled,
          label: t('alerts.dailyEnable'),
          onChange: value => onDailyReminder({ enabled: value })
        }),
        h('label', { className: 'dshw-time-field' },
          h('span', null, t('alerts.dailyTime')),
          h('input', {
            type: 'time',
            value: daily.time,
            onChange: event => onDailyReminder({ time: event.target.value }),
            'aria-label': t('alerts.dailyTime')
          })
        )
      ),
      h('p', { className: 'dshw-note' }, t('alerts.dailyHint'))
    ),

    h('section', { className: 'dshw-card dshw-settings-card' },
      h('h3', { className: 'dshw-settings-title' }, t('settings.levels')),
      h('p', { className: 'dshw-note' }, t('settings.levelsHint')),
      ALERT_LEVELS.map(level => h('div', { className: 'dshw-settings-level', key: level.key },
        h('span', { className: 'dshw-settings-level-name' },
          h('i', { className: 'dshw-level-dot', style: { background: level.color }, 'aria-hidden': 'true' }),
          lang === 'en' ? level.en : level.zh,
          h('span', { className: 'dshw-note' }, lang === 'en'
            ? `${level.gradeEn} · ${level.severityEn}`
            : `${level.grade} · ${level.severity}`)
        ),
        h('div', { className: 'dshw-alert-setting-toggles' },
          h(SettingsLevelToggle, {
            level: level.key,
            lang,
            on: noticeMap[level.key] === true,
            label: t('alerts.noticeToggle'),
            onChange: value => onNoticeLevel(level.key, value)
          }),
          h(SettingsLevelToggle, {
            level: level.key,
            lang,
            on: strongMap[level.key] === true,
            label: t('alerts.strongToggle'),
            onChange: value => onStrongLevel(level.key, value)
          })
        )
      ))
    ),

    h('section', { className: 'dshw-card dshw-settings-card' },
      h('h3', { className: 'dshw-settings-title' }, t('settings.preview')),
      h('p', { className: 'dshw-note' }, t('alerts.previewHint')),
      h('div', { className: 'dshw-settings-row' },
        h('div', { className: 'dshw-segmented dshw-segmented-compact', role: 'group', 'aria-label': t('alerts.previewLevel') },
          ALERT_LEVELS.map(level => h('button', {
            key: `pv-${level.key}`,
            type: 'button',
            className: `dshw-seg${previewLevel === level.key ? ' dshw-seg-active' : ''}`,
            'aria-pressed': previewLevel === level.key ? 'true' : 'false',
            onClick: () => setPreviewLevel(level.key)
          }, lang === 'en' ? level.en : level.zh))
        ),
        h('button', {
          type: 'button',
          className: 'dshw-btn dshw-btn-primary',
          onClick: () => onPreview(previewLevel)
        }, t('alerts.preview'))
      )
    ),

    h('p', { className: 'dshw-note' }, t('settings.note'))
  );
}
