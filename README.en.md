<div align="center">
  <img src="https://raw.githubusercontent.com/python3603/dsh-weather-panel/main/docs/assets/hero.svg" alt="dsh-weather-panel — weather, alerts and typhoon tracks inside DeepSeek Harness" width="100%" />
</div>

<h1 align="center">dsh-weather-panel</h1>

<h3 align="center">“Even while you're working, don't forget the weather!”</h3>

<p align="center">
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-4f6ef7?style=flat-square"/></a>
  <a href="https://github.com/deepseek-ai"><img alt="DeepSeek Harness" src="https://img.shields.io/badge/DeepSeek%20Harness-0.2.x-38bdf8?style=flat-square"/></a>
  <img alt="No API key" src="https://img.shields.io/badge/API%20key-not%20required-10b981?style=flat-square"/>
  <img alt="Tests" src="https://img.shields.io/badge/tests-102%20passing-brightgreen?style=flat-square"/>
</p>

<div align="center">
  <img src="https://raw.githubusercontent.com/python3603/dsh-weather-panel/main/docs/assets/memes/jiaban.webp" alt="Working late" width="112" />
  <img src="https://raw.githubusercontent.com/python3603/dsh-weather-panel/main/docs/assets/memes/ok.webp" alt="OK" width="112" />
  <img src="https://raw.githubusercontent.com/python3603/dsh-weather-panel/main/docs/assets/memes/bixin.webp" alt="Heart" width="112" />
</div>

---

## Hi, I'm the little weather keeper

Deep in a coding session, it is easy to forget to look outside. This plugin puts a small weather
icon in the sidebar: open it and you get the current temperature, wind, humidity and the days ahead
for your city. **When DSH starts and today brings rain — or the China Meteorological Administration
has issued an alert — it pops up first and asks you to acknowledge it.** One click on “Got it” and
it stays quiet for the day.

> Everything below is the rigorous part: where the data comes from, how compatibility and
> performance are handled, and how to build it. The cute part ends here.

---

## Data flow

<div align="center">
  <img src="https://raw.githubusercontent.com/python3603/dsh-weather-panel/main/docs/assets/data-flow.svg" alt="Location, weather, alerts and typhoon data feed one panel" width="100%" />
</div>

In short: three IP-geolocation sources race in the browser (with an optional persisted device-location
switch) → BigDataCloud reverse-geocodes the coordinates → Open-Meteo returns current / hourly / daily
data for that point; in the same round the national CMA alert feed (matched by city, then province) and
the CMA typhoon list/track are fetched. Everything lands in one shared store used by both the panel and
the startup notice; caches are written to `localStorage`.

## Features

| Area | What you get |
| --- | --- |
| Current | Temperature, localized WMO condition, feels-like, today's high/low |
| Parameters | Humidity, MSL pressure, wind direction + speed, gusts, precipitation, cloud cover, UV (with band), rain chance, sunrise, sunset, observation time |
| Next 5 days | Daily high/low, condition, rain chance and amount, max wind, max UV |
| Next 24 hours | Hourly temperature, condition glyph, rain chance |
| Hourly chart | 24 bars of precipitation plus a dashed probability line with a **0 / 50 / 100 % scale** on the right; hover any hour for its values |
| Alerts | National CMA feed matched to your city, then your province; **expand the list inside the panel** (level, type icon, issue time, bulletin link) instead of jumping to a browser |
| Typhoon | Active (or latest) system: offline coastline basemap, observed and forecast tracks, intensity colours, wind radii, click a point for details, one-click “back to current” |
| Startup notice | Rain today or an active alert opens a modal that needs acknowledging; quiet for the day afterwards, but a new alert re-opens it |
| Location | **Network (public IP) or System (browser geolocation)**, persisted and switchable at any time, plus manual city search — source, IP and accuracy are always shown |
| Proxy hint | An exit IP outside mainland China suggests switching the city manually |
| Controls | Refresh, °C/°F and km/h / mph (persisted), close panel; refresh every 10 minutes (paused while hidden, caught up on return) |

## Screenshots

<div align="center">
  <img src="https://raw.githubusercontent.com/python3603/dsh-weather-panel/main/docs/screenshots/panel-weather.webp" alt="Weather tab: current conditions, eight parameters, five-day forecast and hourly precipitation" width="100%" />
  <br/>
  <sub>Weather tab — current conditions, eight parameters, five-day forecast, hourly chart and 24-hour strip (location label redacted in the shot)</sub>
</div>

<div align="center">
  <img src="https://raw.githubusercontent.com/python3603/dsh-weather-panel/main/docs/screenshots/panel-typhoon.webp" alt="Typhoon tab: observed track, forecast track, intensity colours and wind radii" width="100%" />
  <br/>
  <sub>Typhoon tab — observed track coloured by intensity, dashed forecast track, wind radii, reference cities and graticule</sub>
</div>

## Interface
- **Weather tab**: current-condition card (eight parameters), five forecast cards, the hourly chart and a 24-hour strip.
- **Typhoon tab**: appears whenever there is an active or most recent system. The chart is drawn with an
  equirectangular projection: graticule, eight reference cities, observed track coloured by intensity, a
  dashed forecast track with hollow points, wind radii at the latest fix (km converted to degrees, hence
  elliptical), and the bundled Natural Earth land mask as the basemap.
- **Radar tab**: the same product split as nmc.cn (nationwide plus seven regions); frames follow the official 6-minute cadence, with a slider and play control; images load straight from image.nmc.cn and an unpublished frame falls back to the previous one.
- **Startup notice**: summarizes today's rain and the active alerts. The confirm button uses the theme's
  text colour rather than white-on-brand, so it stays readable in light and dark themes.

## Install

Requires DeepSeek Harness **0.2.x** and Node.js ≥ 22 for install/build only.

1. Put the repository anywhere, e.g. `C:\path\to\dsh-weather-panel`.
2. Install it through the plugin manager (`plugin_manager` → `install_bundle`) with the
   **absolute path of the repository directory**:

   ```
   install_bundle  target: C:\path\to\dsh-weather-panel
   ```

   `application: "applied"` means it is live.
3. Reload the Web page: a “Weather” icon appears in the left rail.

<div align="center">
  <img src="https://raw.githubusercontent.com/python3603/dsh-weather-panel/main/docs/assets/memes/ok.webp" alt="Installed" width="92" />
</div>

## Data sources and licenses

| Use | Service | Notes |
| --- | --- | --- |
| Weather | [Open-Meteo](https://open-meteo.com/) | Keyless; **CC BY 4.0** |
| Network location | [ipwho.is](https://ipwho.is/), [ipinfo.io](https://ipinfo.io/), [api.ip.sb](https://ip.sb/) | Raced concurrently; one failure cannot break the panel |
| Reverse geocoding | [BigDataCloud](https://www.bigdatacloud.com/) | Coordinates → readable place name |
| City search | Open-Meteo Geocoding | Chinese queries also run a `市` variant and get re-ranked |
| Alerts | CMA `www.nmc.cn/rest/findAlarm` | National active-alert feed (CORS `*`) |
| Typhoons | CMA typhoon service `typhoon.nmc.cn` | JSONP; stripped and parsed in the browser |
| Basemap | [Natural Earth](https://www.naturalearthdata.com/) 1:50m land | Public domain; clipped and simplified at build time (~36 KiB) |

**Privacy**: location requests share only your public IP, weather requests only coordinates, and
alert/typhoon requests carry nothing personal. Caches stay in your own `localStorage`.

**Stickers in this README** come from the author's own meme library, are used for this repository page
only, and are not covered by the code license.

## Compatibility and performance

Compatibility
- Additive seats only, all with our own ids: `main`, `sidebar.panellist`, `shell.overlay`.
- `shell.overlay` is click-through by design; the notice root re-enables `pointer-events`.
- No other plugin's DOM/CSS is read; nothing is appended to `document.body`.
- Styles live in `<style>` elements rendered by the components, `dshw-` prefixed, using only
  `--dsw-alias-*` tokens — and never “white text on the brand colour”, which breaks on pale themes.
- Text goes through the Client locale service; unload closes our panel before unregistering.

Performance
- One shared store: the panel and the notice cost one round of requests, not two.
- One request covers current + hourly + daily; alert pagination only continues when page 1 misses.
- Caches: forecast/alerts 10 min, location 6 h, typhoon 1 h.
- One `AbortController` per refresh with hard timeouts; no polling while the tab is hidden.
- The projection and the 36 KiB land path are memoized per typhoon.
- No third-party runtime dependencies; ~229 KiB uncompressed.

## Repository layout

```
package.json            bundle + dsh.client declaration, exports, scripts
cordis.patch.yml        inserts one Host plugin row
index.js                Host half: intentionally empty
client.js               built artifact (npm run build)
docs/assets/            README artwork (original SVG) and stickers
docs/screenshots/       real UI screenshots (location label redacted)
src/lib/                pure logic: i18n, links, wmo, format, cache, geo, radar,
                        weather, alerts, typhoon, notice-core, store
src/ui/                 styles, icons, chart, basemap-data, typhoon-view,
                        radar-view,
                        notice, panel
src/plugin.js           registration entry (three seats + store lifecycle)
scripts/build.mjs       zero-dependency bundler
scripts/build-basemap.mjs  regenerates the offline coastline
test/                   node:test suite (87 cases, render smoke tests included)
```

## Development

```bash
npm run build     # src/** → client.js
npm run basemap   # regenerate the offline coastline (downloads Natural Earth)
npm run lint      # node --check
npm test          # node:test, needs Node ≥ 22
npm run check     # all of it
```

`client.js` is a build artifact but **must be committed** — a local directory install links the
checkout and the Harness reads that entry file directly.

The suite includes **render smoke tests**: it boots the real bundle in a `vm` and walks the component
tree with a small hook-aware React shim (weather tab, open location picker, typhoon tab, past-fix
selection, notice, sidebar icon), so a reference error in any branch fails the build instead of
blanking the user's panel.

## Testing the startup notice

Panel → “Change location” → “Preview the notice” fires the dialog immediately with a demo red typhoon
warning. It never touches real data, and acknowledging it clears the demo switch. From the console you
can also use:

```js
localStorage.setItem('dsh-weather-panel:demo-alert', 'typhoon-red'); location.reload();
localStorage.removeItem('dsh-weather-panel:demo-alert');
localStorage.removeItem('dsh-weather-panel:notice'); location.reload();   // full reset
```

## Known limits

- Public-IP geolocation is city level and can land on a carrier or proxy exit.
- Alerts come from a national feed matched by title: city first, then province.
- The typhoon basemap is an offline land mask (no place names, no borders); at 1:50m a coastline is
  generalised by about 1–2 km.
- The notice is evaluated at page load and every 10 minutes afterwards.
- Device location depends on browser permission; a denial falls back to the network with a hint.
- Radar frames are generated from the official 6-minute cadence: the nmc.cn frame list serves no CORS headers, so a missing frame is detected by the image request failing and the view falls back to the previous one (the newest frame usually lags by 1-2).
- `°F` only affects display; requests are always metric.

## Feedback

Bugs, ideas, or unreadable text — please open an issue:
**<https://github.com/python3603/dsh-weather-panel/issues>**
The panel footer also links there.

<div align="center">
  <img src="https://raw.githubusercontent.com/python3603/dsh-weather-panel/main/docs/assets/memes/wenhao.webp" alt="Questions?" width="92" />
</div>

## License

Code MIT (see [LICENSE](LICENSE)). Weather data CC BY 4.0 © Open-Meteo.com; alert and typhoon data
© China Meteorological Administration (personal viewing; respect their terms); basemap data
© Natural Earth (public domain); reverse geocoding © BigDataCloud. Icon and SVG artwork are original;
the README stickers come from the author's meme library.
