/**
 * Client entry: what this plugin registers, and how it cleans up.
 *
 * Two additive seats only, both standard list/keyed registrations:
 * - `main` keyed by our own panel id — the page shown when the sidebar icon is
 *   picked. A fresh key adds a page beside the host's; it replaces nothing.
 * - `sidebar.panellist` with our own id — one more icon in the rail, sized by
 *   the host's own `size` prop.
 *
 * Reusing the host's ids, replacing slots, or touching another plugin's DOM
 * would be the incompatible way to do the same thing, so none of that happens.
 */

function apply(ctx) {
  const namespace = WEATHER_LOCALE_NAMESPACE;

  ctx.effect(() => ctx.locale.register(namespace, WEATHER_DICT), 'dsh-weather-panel: dictionaries');
  const rawTranslate = ctx.locale.bind(namespace);

  let layout = null;
  ctx.inject(['layout'], scoped => {
    layout = scoped && scoped.layout ? scoped.layout : null;
  });

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

  ctx.effect(() => {
    const disposePanel = ctx.slots.inject('main', () => ctx.slots.register({
      name: 'main',
      key: PANEL_ID,
      locale: namespace,
      inject: () => ({ t: rawTranslate, locale: ctx.locale, closePanel })
    }, WeatherPanel));

    const disposeEntry = ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
      name: 'sidebar.panellist',
      id: PANEL_ID,
      order: 20,
      label: navLabel,
      locale: namespace
    }, PanelNavIcon));

    return () => {
      closePanel();
      safely(disposeEntry);
      safely(disposePanel);
    };
  }, 'dsh-weather-panel: main panel and sidebar entry');
}
