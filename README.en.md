# dsh-weather-panel

> A sidebar weather panel for the [DeepSeek Harness](https://github.com/deepseek-ai) Web UI:
> locates you from the current network, then shows the main meteorological parameters, a
> 3-day forecast and the next 24 hours. Everything runs in the browser — **no API key**.

- One extra icon in the sidebar rail, one full-page panel; no host UI is replaced, so it
  coexists with other sidebar and UI plugins.
- Data: Open-Meteo (CC BY 4.0), a race between several IP-geolocation providers, and
  BigDataCloud reverse geocoding.
- No Host network permission, no account, no background traffic: closing the panel stops it.

## Features

| Area | What you get |
| --- | --- |
| Current | Temperature, localized WMO condition, feels-like, today's high/low |
| Parameters | Humidity, MSL pressure, wind direction + speed, gusts, precipitation, cloud cover, UV (with band), precipitation chance, sunrise, sunset, observation time |
| Next 3 days | Daily high/low, condition, precipitation chance and sum, max wind, max UV |
| Next 24 hours | Hourly temperature, condition glyph, precipitation chance from the current hour |
| Location | Automatic (public IP), device location (browser Geolocation), or a manual city search — the source is always shown |
| Controls | Refresh, °C/°F and km/h / mph toggle (persisted), close panel |

## Install

Requires DeepSeek Harness **0.2.x** (Web UI with the sidebar panel system) and Node.js ≥ 20
for installation only — the plugin itself runs in the browser.

1. Put this repository anywhere, e.g. `C:\path\to\dsh-weather-panel`.
2. Install it through the plugin manager (`plugin_manager` → `install_bundle`) pointing at the
   **absolute path of the repository directory**:

   ```
   install_bundle  target: C:\path\to\dsh-weather-panel
   ```

   `application: "applied"` in the result means it is live.
3. Reload the Web page: a "Weather" icon appears in the left rail.

## Data sources and licenses

| Use | Service | Notes |
| --- | --- | --- |
| Weather | [Open-Meteo](https://open-meteo.com/) | Keyless; data under **CC BY 4.0** (attribution kept in the panel footer) |
| Network location | [ipwho.is](https://ipwho.is/), [ipinfo.io](https://ipinfo.io/), [api.ip.sb](https://ip.sb/) | Raced concurrently; the first usable answer wins, one failure cannot break the panel |
| Reverse geocoding | [BigDataCloud](https://www.bigdatacloud.com/) | Turns coordinates into a readable place name |
| City search | Open-Meteo Geocoding | Chinese queries also run a `市` variant and get re-ranked |

**Privacy:** location requests share only your public IP with those providers; weather requests
share only coordinates with Open-Meteo. Nothing is reported back to DSH or analytics. Cached
values stay in your own `localStorage`.

## Compatibility and performance

Compatibility
- Two **additive** seats only: a `main` panel under our own key and a `sidebar.panellist` entry
  under our own id (`order: 20`). No shipped id is reused or replaced.
- No other plugin's DOM/CSS is read, nothing is appended to `document.body`, the app root is
  never replaced.
- All styles live in a `<style>` element the panel renders itself, every selector prefixed
  `dshw-`, so they disappear with the panel.
- Colours use `--dsw-alias-*` theme tokens (each with a light fallback), so light/dark themes
  follow the host; weather artwork keeps its own palette because it is illustration.
- Text goes through the Client locale service, bilingual, switching live.
- On unload, if our panel is the active one the plugin calls `layout.selectPanel(null)` before
  unregistering, so the host is never left showing a missing page.

Performance
- One request covers current + hourly + daily; no request waterfall.
- Forecast cached 10 min, location 6 h: reopening the panel paints from cache and revalidates.
- One `AbortController` per load (a new load cancels the old one) and a hard timeout per request.
- No polling while the document is hidden; one wake-up per minute otherwise, refreshing only
  when data is stale.
- No third-party runtime dependencies; the bundle is ~98 KiB uncompressed.

## Repository layout

```
package.json         bundle + dsh.client declaration, exports, scripts
cordis.patch.yml     inserts one Host plugin row (the bundle carrier)
index.js             Host half: intentionally empty — all logic is in the browser module
client.js            built artifact (npm run build); do not edit by hand
src/lib/             pure logic, importable and testable in Node
src/ui/              styles, inline SVG artwork, panel components
src/plugin.js        registration entry (slots / locale / teardown)
scripts/build.mjs    zero-dependency bundler: src/** → client.js
test/                node:test suite (43 cases)
```

## Development

```bash
npm run build   # src/** → client.js (single browser module)
npm run lint    # node --check
npm test        # node:test, needs Node ≥ 22
npm run check   # all three
```

`client.js` is a build artifact but **must be committed**: a local directory install links the
checkout and the Harness reads that entry file directly.

## Known limits

- Public-IP geolocation is city level and can land on a carrier or proxy exit (a VPN may report
  another country). The panel shows the source and IP; override it with a manual city or device
  location.
- No disaster warnings: Open-Meteo has no alert feed; that needs a separate source.
- Device location depends on browser permission and can be denied on desktop; the panel then
  keeps the previous data and says so.
- `°F` only affects display; requests are always metric.

## Before publishing to GitHub

`package.json` uses the placeholder `REPLACE_WITH_YOUR_GITHUB_USERNAME` in
`repository / bugs / homepage`. Replace it with your account once the repository exists.

```bash
git init -b main
git add .
git commit -m "feat: weather panel UI plugin for DeepSeek Harness"
git remote add origin git@github.com:<your-account>/dsh-weather-panel.git
git push -u origin main
```

## License

Code MIT (see `LICENSE`). Weather data CC BY 4.0 © Open-Meteo.com; reverse-geocoding data
© BigDataCloud; IP location data © the respective providers. Icon and artwork are original.
