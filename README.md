# dsh-weather-panel · DSH 天气面板

> 给 [DeepSeek Harness](https://github.com/deepseek-ai) Web UI 用的侧边栏天气插件：
> 按当前网络自动定位，显示主要气象参数、未来 3 天预报和未来 24 小时逐时变化。
> 纯浏览器端取数，**不需要 API Key**，跟随宿主主题与语言。

- 侧边栏多一个「天气」图标，点开就是整页面板；不替换任何宿主界面，与其它侧边栏/UI 插件并存
- 数据：Open-Meteo（CC BY 4.0）+ 多个 IP 定位源竞速 + BigDataCloud 逆地理编码
- 无 Host 网络权限、无账号、无后台请求；面板关掉就完全停止

---

## 功能

| 区块 | 内容 |
| --- | --- |
| 当前天气 | 温度、天气现象（WMO 码本地化）、体感、今日最高/最低 |
| 主要参数 | 湿度、海平面气压、风向+风速、阵风、降水、云量、紫外线（含等级）、降水概率、日出、日落、观测时刻 |
| 未来 3 天 | 每天的最高/最低、天气现象、降水概率、降水量、最大风速、紫外线最大值，以及日期与星期 |
| 未来 24 小时 | 逐时温度、天气图标、降水概率（从当前小时起） |
| 位置 | 自动（公网 IP）、系统定位（浏览器 Geolocation）、手动搜索城市；副标题始终标明位置来源 |
| 交互 | 刷新、°C/°F 与 km/h / mph 切换、关闭面板；单位选择会持久化 |

## 安装

要求：DeepSeek Harness **0.2.x** 的 Web UI（侧边栏面板体系），本机已安装 Node.js ≥ 20（只用于安装，插件本身跑在浏览器）。

1. 把本仓库放到任意目录，例如 `C:\path\to\dsh-weather-panel`。
2. 让 Agent 执行插件安装（`plugin_manager` 的 `install_bundle`，目标填**仓库目录的绝对路径**）：

   ```
   install_bundle  target: C:\path\to\dsh-weather-panel
   ```

   安装器会把它 link 进当前 profile 并启用 bundle；返回 `application: "applied"` 即为生效。
3. 刷新 Web 页面，左侧栏出现「天气」图标，点开即用。

卸载：在「插件」页里停用/移除 `dsh-weather-panel` 即可；本地仓库不会被改动。

## 数据来源与许可

| 用途 | 服务 | 说明 |
| --- | --- | --- |
| 天气 | [Open-Meteo](https://open-meteo.com/) | 免 Key；数据以 **CC BY 4.0** 提供，面板底部保留署名 |
| 网络定位 | [ipwho.is](https://ipwho.is/)、[ipinfo.io](https://ipinfo.io/)、[api.ip.sb](https://ip.sb/) | 三个源并发竞速，先给出可用结果的胜出；单源失败不影响面板 |
| 逆地理编码 | [BigDataCloud](https://www.bigdatacloud.com/) | 把坐标变成「青岛市 · 黄岛区」这样的中文地名 |
| 城市搜索 | Open-Meteo Geocoding | 中文查询会自动追加「市」变体并做重排 |

**隐私**：定位请求只把公网 IP 交给上述定位服务，天气请求只把坐标交给 Open-Meteo；没有任何数据回传 DSH 或第三方统计。位置与预报缓存只写在本机 `localStorage`。

## 兼容性与性能设计

这些不是口号，而是代码里逐条落地的约束：

**兼容**
- 只占两个**增量**席位：`main` 用自定义 key `dsh-weather-panel`，`sidebar.panellist` 用自定义 id（`order: 20`）。不复用、不覆盖宿主或其它插件的 id。
- 不读别的插件的 DOM/CSS，不向 `document.body` 追加节点，不替换 `root`。
- 样式全部写在面板自己渲染的 `<style>` 里，选择器统一 `dshw-` 前缀，组件卸载样式即消失。
- 颜色只用 `--dsw-alias-*` 主题令牌（各带浅色兜底），深浅色主题自动适配；天气插画自带配色，仅用于插画。
- 文案走 Client locale 服务（`ctx.locale`），中英双语，切语言即时生效；标题/描述由 `locale/*.json` 提供给插件管理器。
- 插件卸载/停用时如果正停在本面板，会先 `layout.selectPanel(null)` 再注销，避免留下空白页。

**性能**
- 一次请求拿齐当前+逐时+逐日（`current`/`hourly`/`daily` 合并），没有串行瀑布。
- 预报缓存 10 分钟、定位缓存 6 小时：重开面板先渲染缓存，再按需后台刷新。
- 所有请求走同一个 `AbortController`，新请求取消旧请求；每个请求有硬超时。
- 页面不可见（`document.hidden`）时不轮询；可见时每分钟醒来一次，只在数据过期时刷新。
- 面板无第三方运行时依赖，打包产物约 98 KiB（未压缩）。

## 目录结构

```
.
├── package.json          # bundle + dsh.client 声明、exports、脚本
├── cordis.patch.yml      # 插入一行 Host 插件（bundle 载体）
├── index.js              # Host 半侧：故意空实现，插件全部逻辑在浏览器端
├── client.js             # 构建产物（由 npm run build 生成，不要手改）
├── icon.svg              # 插件管理器里的图标
├── locale/{zh,en}.json   # meta.title / meta.description
├── src/
│   ├── lib/              # 纯逻辑，可在 Node 里直接 import 测试
│   │   ├── i18n.js       # 双语词典、插值、Host 翻译降级
│   │   ├── wmo.js        # WMO 4677 → 文案/图标组/严重度
│   │   ├── format.js     # 温度/风/气压/降水/方位/时间/星期
│   │   ├── cache.js      # TTL 缓存 + 安全 Storage（memory 降级）
│   │   ├── geo.js        # IP 定位竞速、逆地理、城市搜索与重排
│   │   └── weather.js    # Open-Meteo 请求构造与响应归一化
│   ├── ui/
│   │   ├── styles.js     # 面板样式（前缀 + 主题令牌）
│   │   ├── icons.js      # 天气插画与 UI 图标（内联 SVG）
│   │   └── panel.js      # 数据 hook、组件树、位置选择器
│   └── plugin.js         # 注册入口（slots / locale / 卸载清理）
├── scripts/build.mjs     # 零依赖打包：拼接 src → client.js
└── test/*.test.mjs       # node:test，43 个用例
```

## 开发

```bash
npm run build   # src/**  → client.js（单文件浏览器模块）
npm run lint    # node --check
npm test        # node:test，需要 Node ≥ 22
npm run check   # 三连
```

`client.js` 是产物但**需要提交**：本地目录安装是直接 link 仓库，Harness 只读这个入口文件。
`src/lib/*.js` 是标准 ESM，测试直接 import；`scripts/build.mjs` 在拼接时去掉 import/export 并包一层 `window.__ModuleLoader__`。

## 已知限制

- IP 定位只能到**城市级**，且可能落在运营商或代理出口（例如开着代理会显示境外城市）。面板会显示来源与 IP，需要时用手动搜索或系统定位覆盖。
- 不提供灾害预警：Open-Meteo 无预警字段，预警需要另一套数据源（可后续接 L3）。
- 系统定位依赖浏览器权限；桌面端可能被拒绝，会提示并保留当前数据。
- 默认单位摄氏度；`°F` 只影响显示，请求始终是公制。

## 自定义

| 键 | 位置 | 说明 |
| --- | --- | --- |
| `dsh-weather-panel:settings` | `localStorage` | 单位与手动位置（`{units, override}`） |
| `dsh-weather-panel:location:resolved` | `localStorage` | 缓存的网络定位（6 小时） |
| `dsh-weather-panel:forecast:<lat>,<lon>:latest` | `localStorage` | 缓存的预报（10 分钟） |

清掉这些键即可回到「全新安装」行为。

## 上传到 GitHub 前

`package.json` 里的 `repository / bugs / homepage` 用了占位用户名
`REPLACE_WITH_YOUR_GITHUB_USERNAME`，建好仓库后替换成你的账号即可；其余文件可直接提交。

```bash
git init -b main
git add .
git commit -m "feat: weather panel UI plugin for DeepSeek Harness"
git remote add origin git@github.com:<你的用户名>/dsh-weather-panel.git
git push -u origin main
```

## 许可

代码 MIT（见 `LICENSE`）。天气数据 CC BY 4.0 © Open-Meteo.com；逆地理编码数据 © BigDataCloud；
IP 定位数据 © 各自服务提供方。图标与插画为本项目原创。
