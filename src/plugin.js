/**
 * Client entry: what this plugin registers and how it cleans up.
 *
 * Three additive seats, all with our own ids — nothing shipped is replaced and
 * no other plugin's DOM is touched:
 * - `main` keyed by our own panel id (the weather page),
 * - `sidebar.panellist` with our own id (the rail icon),
 * - `shell.overlay` with our own id (the startup notice).
 *
 * Data lives in one store shared by the panel and the notice, so the notice can
 * check alerts at page boot while the panel is still closed.
 */

function apply(ctx) {
  const namespace = WEATHER_LOCALE_NAMESPACE;

  ctx.effect(() => ctx.locale.register(namespace, WEATHER_DICT), 'dsh-weather-panel: dictionaries');
  const rawTranslate = ctx.locale.bind(namespace);

  let layout = null;
  ctx.inject(['layout'], scoped => {
    layout = scoped && scoped.layout ? scoped.layout : null;
  });

  const language = () => {
    try {
      const snapshot = typeof ctx.locale.getSnapshot === 'function' ? ctx.locale.getSnapshot() : null;
      return snapshot && String(snapshot.active || '').toLowerCase().startsWith('en') ? 'en' : 'zh';
    } catch (error) {
      return 'zh';
    }
  };

  const translate = makeTranslate(rawTranslate, language());
  const store = createWeatherStore();

  /** Sidebar label; the host re-reads this thunk, so it follows the language. */
  const navLabel = () => {
    try {
      const text = rawTranslate('nav.label');
      return text === 'nav.label' ? lookupMessage('zh', 'nav.label') : text;
    } catch (error) {
      return lookupMessage('zh', 'nav.label');
    }
  };

  /** Leave our own panel before the page disappears from under the user. */
  const closePanel = () => {
    try {
      const controller = layout;
      if (!controller) return;
      const snapshot = controller.panelInfo && typeof controller.panelInfo.getSnapshot === 'function'
        ? controller.panelInfo.getSnapshot()
        : null;
      if (snapshot && snapshot.activePanelId === PANEL_ID && typeof controller.selectPanel === 'function') {
        controller.selectPanel(null);
      }
    } catch (error) {
      /* older Host without the panel controller: nothing to do */
    }
  };

  const safely = disposer => {
    if (typeof disposer === 'function') {
      try {
        disposer();
      } catch (error) {
        /* a double dispose must not break plugin unload */
      }
    }
  };

  // The data store starts immediately: the notice has to know about today's
  // rain and alerts even if the user never opens the panel.
  ctx.effect(() => {
    store.start({ lang: language(), translate });
    return () => store.dispose();
  }, 'dsh-weather-panel: data store and ten-minute refresh');

  ctx.effect(() => {
    const disposePanel = ctx.slots.inject('main', () => ctx.slots.register({
      name: 'main',
      key: PANEL_ID,
      locale: namespace,
      inject: () => ({ t: rawTranslate, locale: ctx.locale, closePanel, store })
    }, WeatherPanel));

    const disposeEntry = ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
      name: 'sidebar.panellist',
      id: PANEL_ID,
      order: 20,
      label: navLabel,
      locale: namespace
    }, PanelNavIcon));

    const disposeNotice = ctx.slots.inject('shell.overlay', () => ctx.slots.register({
      name: 'shell.overlay',
      id: `${PANEL_ID}-notice`,
      order: 30,
      locale: namespace,
      inject: () => ({ t: rawTranslate, locale: ctx.locale, store })
    }, WeatherNotice));

    return () => {
      closePanel();
      safely(disposeNotice);
      safely(disposeEntry);
      safely(disposePanel);
    };
  }, 'dsh-weather-panel: panel, sidebar entry and startup notice');
}
