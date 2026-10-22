/**
 * Host half of the `dsh-weather-panel` bundle.
 *
 * The plugin is deliberately Client-only: locating, fetching, caching and
 * rendering all happen in the browser module (`client.js`), so no API key,
 * no Host network permission and no extra IPC round trip is involved.
 * This module exists because a bundle row needs a resolvable Host entry;
 * it registers nothing and therefore cannot collide with other plugins.
 */
export function apply() {}
