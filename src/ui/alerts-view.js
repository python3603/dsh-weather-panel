/**
 * 预警栏目：独立的「预警」页签。
 *
 * 为什么单独开一栏而不是塞在天气页：预警是**异步到达**的信息（可能在你打开面板
 * 十分钟后才发布），等级差别又直接决定要不要中断你；把它独立出来，列表、详情和
 * 分级提醒设置才有地方放，天气页也不会被一串横幅挤走。
 *
 * 交互按需求分三层：
 *   1) 列表只给「哪一级、什么类型、哪里、何时」——不写正文；
 *   2) 点开某一条才展开正文摘要（结构化概述 + 该类型的防范要点）；
 *   3) 摘要末尾才是官方原文链接，不在点击第一下就跳走。
 */

function AlertLevelChip(props) {
  const { level, lang, grade } = props;
  const meta = alertLevelMeta(level);
  const label = meta ? (lang === 'en' ? meta.en : meta.zh) : (lang === 'en' ? 'Alert' : '预警');
  return h('span', { className: `dshw-level-chip dshw-level-${level || 'blue'}` },
    label,
    grade ? h('span', { className: 'dshw-level-grade' }, grade) : null
  );
}

function AlertRow(props) {
  const { alert, lang, t, open, onToggle } = props;
  const detail = buildAlertDetail(alert, lang);
  const scopeText = alert.scope === 'district'
    ? t('alerts.scopeDistrict')
    : (alert.scope === 'city' ? t('alerts.scopeCity') : t('alerts.scopeRegion'));
  return h('article', { className: `dshw-alert-item dshw-alert-item-${alert.level || 'blue'}${open ? ' dshw-alert-item-open' : ''}` },
    h('button', {
      type: 'button',
      className: 'dshw-alert-item-head',
      'aria-expanded': open ? 'true' : 'false',
      onClick: onToggle
    },
      h('span', { className: 'dshw-alert-item-icon', 'aria-hidden': 'true' }, alertTypeIcon(alert.type)),
      h('span', { className: 'dshw-alert-item-main' },
        h('span', { className: 'dshw-alert-item-title' }, alert.title),
        h('span', { className: 'dshw-alert-item-meta' },
          [alert.issuedText, scopeText].filter(Boolean).join(' · ')
        )
      ),
      h(AlertLevelChip, { level: alert.level, lang, grade: alertGradeLabel(alert.level, lang) }),
      h('span', { className: `dshw-caret${open ? ' dshw-caret-up' : ''}`, 'aria-hidden': 'true' })
    ),
    open
      ? h('div', { className: 'dshw-alert-detail' },
        h('p', { className: 'dshw-alert-detail-lead' }, detail.summary),
        h('div', { className: 'dshw-alert-detail-meta' },
          h('span', null, `${t('alerts.detailIssued')} ${detail.issuedText || '—'}`),
          h('span', null, `${t('alerts.detailPlace')} ${detail.place || '—'}`)
        ),
        detail.bullets.length > 0
          ? h('div', { className: 'dshw-alert-detail-guide' },
            h('h4', { className: 'dshw-alert-detail-heading' }, t('alerts.detailGuide')),
            h('ol', { className: 'dshw-alert-detail-list' },
              detail.bullets.map((item, index) => h('li', { key: `g-${index}` }, item))
            )
          )
          : null,
        h('div', { className: 'dshw-alert-detail-foot' },
          h('span', { className: 'dshw-note' }, t('alerts.detailSummaryNote')),
          h('a', {
            className: 'dshw-link',
            href: detail.url,
            target: '_blank',
            rel: 'noreferrer noopener'
          }, t('alerts.openOfficial'))
        )
      )
      : null
  );
}

function AlertLevelToggle(props) {
  const { level, lang, on, onChange, label } = props;
  const meta = alertLevelMeta(level);
  return h('button', {
    type: 'button',
    role: 'switch',
    'aria-checked': on ? 'true' : 'false',
    className: `dshw-alert-toggle${on ? ' dshw-alert-toggle-on' : ''}`,
    style: { '--dshw-toggle-accent': meta ? meta.color : '#6b7280' },
    onClick: () => onChange(!on),
    title: label
  },
    h('span', { className: 'dshw-alert-toggle-track', 'aria-hidden': 'true' },
      h('span', { className: 'dshw-alert-toggle-knob' })
    ),
    h('span', { className: 'dshw-alert-toggle-label' }, lang === 'en' ? (meta ? meta.en : level) : (meta ? meta.zh : level))
  );
}

function AlertsView(props) {
  const {
    t, lang, alerts, scanned, settings, location, checkedAt,
    onNoticeLevel, onStrongLevel, onPreview, onRefresh, busy
  } = props;
  const [openId, setOpenId] = React.useState('');
  const [previewLevel, setPreviewLevel] = React.useState('yellow');
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  const list = Array.isArray(alerts) ? alerts : [];
  const noticeMap = (settings && settings.alertNotice) || DEFAULT_ALERT_NOTICE;
  const strongMap = (settings && settings.alertStrong) || DEFAULT_ALERT_STRONG;
  const placeLabel = location && location.label ? location.label : '';
  // 本区/本市 + 省级 = 真正对我的预警；同市其他区县另列一组，只作参考、不弹窗。
  const primary = list.filter(alert => alert.scope !== 'other');
  const secondary = list.filter(alert => alert.scope === 'other');
  const highest = primary.length > 0 ? primary[0] : null;
  const levelName = level => (lang === 'en' ? level.en : level.zh);
  const noticeNames = ALERT_LEVELS.filter(level => noticeMap[level.key] === true).map(levelName);
  const strongNames = ALERT_LEVELS.filter(level => strongMap[level.key] === true).map(levelName);

  const settingsCard = h('section', { className: 'dshw-card dshw-alert-settings' },
    h('div', { className: 'dshw-alerts-head' },
      h('h2', { className: 'dshw-section-title' }, t('alerts.settingsTitle')),
      h('button', {
        type: 'button',
        className: 'dshw-alerts-toggle',
        'aria-expanded': settingsOpen ? 'true' : 'false',
        onClick: () => setSettingsOpen(value => !value)
      },
        settingsOpen ? t('alerts.collapse') : t('alerts.expandSettings'),
        h('span', { className: `dshw-caret${settingsOpen ? ' dshw-caret-up' : ''}`, 'aria-hidden': 'true' })
      )
    ),
    h('p', { className: 'dshw-note dshw-alert-policy' },
      `${t('alerts.currentNotice')}：${noticeNames.join(' · ') || t('alerts.noneEnabled')}`
      + (strongNames.length > 0 ? ` ｜ ${t('alerts.currentStrong')}：${strongNames.join(' · ')}` : '')
    ),
    h('p', { className: 'dshw-note' }, t('alerts.settingsHint')),
    settingsOpen
      ? h('div', { className: 'dshw-alert-settings-body' },
        ALERT_LEVELS.map(level => h('div', { className: 'dshw-alert-setting-row', key: level.key },
          h('span', { className: 'dshw-alert-setting-name' },
            h('i', { className: 'dshw-level-dot', style: { background: level.color }, 'aria-hidden': 'true' }),
            (lang === 'en' ? level.en : level.zh),
            h('span', { className: 'dshw-note' }, lang === 'en'
              ? `${level.gradeEn} · ${level.severityEn}`
              : `${level.grade} · ${level.severity}`)
          ),
          h('div', { className: 'dshw-alert-setting-toggles' },
            h(AlertLevelToggle, {
              level: level.key,
              lang,
              on: noticeMap[level.key] === true,
              label: t('alerts.noticeToggle'),
              onChange: value => onNoticeLevel(level.key, value)
            }),
            h(AlertLevelToggle, {
              level: level.key,
              lang,
              on: strongMap[level.key] === true,
              label: t('alerts.strongToggle'),
              onChange: value => onStrongLevel(level.key, value)
            })
          )
        )),
        h('div', { className: 'dshw-alert-preview' },
          h('div', { className: 'dshw-alert-preview-head' },
            h('span', { className: 'dshw-note' }, t('alerts.previewHint')),
            h('div', { className: 'dshw-alert-preview-actions' },
              h('div', { className: 'dshw-segmented dshw-segmented-compact', role: 'group', 'aria-label': t('alerts.previewLevel') },
                ALERT_LEVELS.map(level => h('button', {
                  type: 'button',
                  key: `pv-${level.key}`,
                  className: `dshw-seg${previewLevel === level.key ? ' dshw-seg-active' : ''}`,
                  'aria-pressed': previewLevel === level.key ? 'true' : 'false',
                  onClick: () => setPreviewLevel(level.key)
                }, lang === 'en' ? level.en : level.zh))
              ),
              h('button', {
                type: 'button',
                className: 'dshw-btn',
                onClick: () => onPreview(previewLevel)
              }, t('alerts.preview'))
            )
          ),
          h('p', { className: 'dshw-note' }, t('alerts.previewPlace', { place: placeLabel || t('alerts.previewPlaceFallback') }))
        )
      )
      : null
  );

  return h('div', { className: 'dshw-alerts-view' },
    h('section', { className: 'dshw-card dshw-alerts-summary' },
      h('div', { className: 'dshw-alerts-head' },
        h('h2', { className: 'dshw-section-title' }, t('alerts.title')),
        h('div', { className: 'dshw-alerts-head-right' },
          highest
            ? h(AlertLevelChip, { level: highest.level, lang, grade: alertGradeLabel(highest.level, lang) })
            : h('span', { className: 'dshw-alert-clear' }, t('alerts.clear')),
          h('button', {
            type: 'button',
            className: 'dshw-btn dshw-btn-icon',
            onClick: onRefresh,
            disabled: Boolean(busy),
            title: t('action.refresh'),
            'aria-label': t('action.refresh')
          }, h(RefreshGlyph))
        )
      ),
      h('p', { className: 'dshw-note' },
        placeLabel ? t('alerts.summaryPlace', { place: placeLabel, n: primary.length }) : t('alerts.summary', { n: primary.length })
      ),
      h('p', { className: 'dshw-note' },
        `${t('alerts.scanned', { n: scanned || 0 })}${checkedAt ? ` · ${t('alerts.checked', { time: formatClockFromDate(new Date(checkedAt)) })}` : ''}`
      )
    ),

    primary.length > 0
      ? h('div', { className: 'dshw-alert-list dshw-alert-list-full' },
        primary.map(alert => h(AlertRow, {
          key: alert.id,
          alert,
          lang,
          t,
          open: openId === alert.id,
          onToggle: () => setOpenId(openId === alert.id ? '' : alert.id)
        }))
      )
      : h('section', { className: 'dshw-card dshw-alert-empty' },
        h('p', { className: 'dshw-alert-empty-title' }, t('alerts.empty')),
        h('p', { className: 'dshw-note' }, t('alerts.emptyHint', { place: placeLabel || t('alerts.previewPlaceFallback') })),
        h('a', {
          className: 'dshw-link',
          href: 'https://www.nmc.cn/publish/alarm.html',
          target: '_blank',
          rel: 'noreferrer noopener'
        }, t('alerts.openAll'))
      ),

    secondary.length > 0
      ? h('section', { className: 'dshw-card dshw-alert-others' },
        h('div', { className: 'dshw-alerts-head' },
          h('h2', { className: 'dshw-section-title' }, t('alerts.otherTitle')),
          h('span', { className: 'dshw-note' }, t('alerts.otherCount', { n: secondary.length }))
        ),
        h('p', { className: 'dshw-note' }, t('alerts.otherHint')),
        h('div', { className: 'dshw-alert-list dshw-alert-list-full' },
          secondary.slice(0, 8).map(alert => h(AlertRow, {
            key: alert.id,
            alert,
            lang,
            t,
            open: openId === alert.id,
            onToggle: () => setOpenId(openId === alert.id ? '' : alert.id)
          }))
        ),
        secondary.length > 8 ? h('p', { className: 'dshw-note' }, t('alerts.otherMore', { n: secondary.length - 8 })) : null
      )
      : null,

    settingsCard
  );
}
