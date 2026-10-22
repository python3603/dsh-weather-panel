# dsh-weather-panel

> A sidebar weather panel for the [DeepSeek Harness](https://github.com/deepseek-ai) Web UI:
> locates you from the current network, shows current conditions, a 3-day and a 24-hour
> forecast, an hourly precipitation chart, **China Meteorological Administration (CMA) weather
> alerts** and **typhoon tracks**, and pops a confirm-once notice at startup when it rains or
> an alert is active. Everything runs in the browser — **no API key**.

- One extra rail icon, one full-page panel with Weather / Typhoon tabs; no host UI replaced.
- Three additive seats: `main` panel, `sidebar.panellist` icon, `shell.overlay` startup notice.
- Data: Open-Meteo (CC BY 4.0) + raced IP geolocation + CMA alerts and typhoons.
- No host network permission, no account, no telemetry.

## Features

| Area | What you get |
| --- | --- |
| Current | Temperature, localized WMO condition, feels-like, today's high/low |
| Parameters | Humidity, MSL pressure, wind direction + speed, gusts, precipitation, cloud cover, UV (with band), rain chance, sunrise, sunset, observation time |
| Next 5 days | Daily high/low, condition, rain chance and amount, max wind, max UV |
| Next 24 hours | Hourly temperature, condition glyph, rain chance |
| Hourly chart | 24 bar chart of precipitation plus a dashed probability line; hover any hour for its exact values |
| Alerts | National CMA feed matched to your city, then your province; level/type/issue time with a link to the original bulletin |
| Typhoon | Active (or latest) system: **offline coastline basemap** (Natural Earth, land only, no borders), observed and forecast tracks, intensity colours, wind radii, click a point for pressure/wind/motion, plus a link to the official map |
| Startup notice | When DSH opens and today has rain or an active alert, a modal asks for acknowledgement; acknowledged means quiet for the day, but **a new alert re-opens it** |
| Proxy hint | When the exit IP is outside mainland China, a banner suggests switching cities manually |
| Location | Automatic (public IP), **a persisted high-accuracy device-location switch**, or manual city search — source, IP and accuracy are always shown |
| Controls | Refresh, °C/°F and km/h / mph toggle (persisted), close panel; data refreshes every **10 minutes** (paused while the page is hidden and caught up on return) |

## Install

Requires DeepSeek Harness **0.2.x** (Web UI) and Node.js ≥ 22 for install/build only.

1. Put this repository anywhere, e.g. `C:\path\to\dsh-weather-panel`.
2. Install it through the plugin manager (`plugin_manager` → `install_bundle`) with the
   **absolute path of the repository directory**:

   ```
   install_bundle  target: C:\path\to\dsh-weather-panel
   ```

   `application: "applied"` means it is live.
3. Reload the Web page: a "Weather" icon appears in the left rail.

## Data sources and licenses

| Use | Service | Notes |
| --- | --- | --- |
| Weather | [Open-Meteo](https://open-meteo.com/) | Keyless; **CC BY 4.0** |
| Network location | [ipwho.is](https://ipwho.is/), [ipinfo.io](https://ipinfo.io/), [api.ip.sb](https://ip.sb/) | Raced concurrently; one failure cannot break the panel |
| Reverse geocoding | [BigDataCloud](https://www.bigdatacloud.com/) | Coordinates → readable place name |
| City search | Open-Meteo Geocoding | Chinese queries also run a `市` variant and get re-ranked |
| **Alerts** | **CMA** `www.nmc.cn/rest/findAlarm` | National active-alert feed (CORS `*`), filtered by province/city name |
| **Typhoons** | **CMA typhoon service** `typhoon.nmc.cn` | JSONP; we strip the wrapper and parse it ourselves |

**Privacy:** location requests share only your public IP; weather requests share only coordinates;
alert and typhoon requests carry nothing personal. Caches stay in your own `localStorage`.

## Compatibility and performance

Compatibility
- Additive seats only, all with our own ids — nothing shipped is reused or replaced.
- `shell.overlay` is click-through by design; the notice root re-enables `pointer-events` so it
  never blocks the app outside the dialog.
- No other plugin's DOM/CSS is read; nothing is appended to `document.body`; the root is untouched.
- Styles live in `<style>` elements rendered by the components that need them, all `dshw-`
  prefixed, using only `--dsw-alias-*` tokens with light fallbacks.
- Text goes through the Client locale service; unload calls `selectPanel(null)` before
  unregistering, so the host never shows a missing page.

Performance
- One shared store: the panel and the startup notice read the same data, so opening the app costs
  one round of requests, not two.
- One request covers current + hourly + daily; alert pagination continues only when page 1 has no
  match (3 pages, 298 entries max).
- Caches: forecast/alerts 10 min, location 6 h, typhoon 1 h — reopening and the 10-minute poll are
  usually free.
- One `AbortController` per refresh (a new refresh cancels the old one) with hard per-request timeouts.
- No polling while the document is hidden; a visible page catches up immediately.
- No third-party runtime dependencies; the bundle is ~213 KiB uncompressed (about 36 KiB of that is the offline coastline).

## Repository layout

```
package.json          bundle + dsh.client declaration, exports, scripts
cordis.patch.yml      inserts one Host plugin row (the bundle carrier)
index.js              Host half: intentionally empty
client.js             built artifact (npm run build)
src/lib/              pure logic: i18n, wmo, format, cache, geo, weather,
                      alerts, typhoon, notice-core, store
src/ui/               styles, icons, chart, typhoon-view, notice, panel
src/plugin.js         registration entry (three seats + store lifecycle)
scripts/build.mjs     zero-dependency bundler
scripts/build-basemap.mjs  generates the offline coastline from Natural Earth
test/                 node:test suite (75 cases)
```

## Development

```bash
npm run build   # src/** → client.js
npm run lint    # node --check
npm test        # node:test, needs Node ≥ 22
npm run check   # all three
```

`client.js` is a build artifact but **must be committed** — a local directory install links the
checkout and the Harness reads that entry file directly.

## Known limits

- Public-IP geolocation is city level and can land on a carrier or proxy exit; the panel shows the
  source and IP and offers a manual override.
- Alerts come from a national feed matched by title: city first, then province. A neighboring
  city's alert can therefore appear as a province-level hit.
- The typhoon basemap is an offline coastline (Natural Earth 1:50m, public domain, land only, no
  borders): no key, no CORS, no quota, and it works offline. It carries no place names or borders,
  and at 1:50m a coastline is generalised by about 1–2 km. A graticule and reference cities keep it
  readable without third-party map tiles.
- The notice is evaluated at page load/refresh and again every 10 minutes, which also covers a
  desktop window that stays open.
- The device-location switch depends on browser permission: turning it on asks once, and a denial or missing geolocation falls back to the network location with a visible note (the switch itself stays on for the next start).
- `°F` only affects display; requests are always metric.

## Before publishing to GitHub

Replace `REPLACE_WITH_YOUR_GITHUB_USERNAME` in `package.json` once the repository exists.

```bash
git init -b main
git add .
git commit -m "feat: weather panel with CMA alerts and typhoon track"
git remote add origin git@github.com:<your-account>/dsh-weather-panel.git
git push -u origin main
```

## License

Code MIT (see `LICENSE`). Weather data CC BY 4.0 © Open-Meteo.com; alert and typhoon data
© China Meteorological Administration (personal viewing; respect their terms); reverse geocoding
© BigDataCloud; IP data © the respective providers. Icon and artwork are original.
