/**
 * Small controls shared by the settings view and the alerts tab.
 *
 * They live in their own module because both surfaces render level switches and
 * plain on/off switches; two copies of the same component in one bundle scope
 * would collide.
 */

function SettingsToggle(props) {
  const { on, label, onChange } = props;
  return h('button', {
    type: 'button',
    role: 'switch',
    'aria-checked': on ? 'true' : 'false',
    className: `dshw-alert-toggle${on ? ' dshw-alert-toggle-on' : ''}`,
    onClick: () => onChange(!on),
    title: label
  },
    h('span', { className: 'dshw-alert-toggle-track', 'aria-hidden': 'true' },
      h('span', { className: 'dshw-alert-toggle-knob' })
    ),
    h('span', { className: 'dshw-alert-toggle-label' }, label)
  );
}

function SettingsLevelToggle(props) {
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
