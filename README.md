# dsh-weather-panel · DSH 天气面板

> 给 [DeepSeek Harness](https://github.com/deepseek-ai) Web UI 用的侧边栏天气插件：
> 按当前网络自动定位，显示主要气象参数、未来 3 天与 24 小时预报、逐小时降水图，
> 并接入**中央气象台（中国气象局）**的全国预警与**台风路径**；开 DSH 时若有降水或
> 生效预警会弹窗提醒（需确认）。纯浏览器端取数，**不需要 API Key**。

- 侧边栏多一个「天气」图标，点开是整页面板（可切「天气 / 台风」页）；不替换任何宿主界面
- 三个增量席位：`main` 面板 + `sidebar.panellist` 图标 + `shell.overlay` 启动提醒，与其它插件并存
- 数据：Open-Meteo（CC BY 4.0）+ 多源 IP 定位 + 中央气象台预警/台风
- 无 Host 网络权限、无账号、无统计；关掉面板/插件即停止请求

---

## 功能

| 区块 | 内容 |
| --- | --- |
| 当前天气 | 温度、天气现象（WMO 码本地化）、体感、今日最高/最低 |
| 主要参数 | 湿度、海平面气压、风向+风速、阵风、降水、云量、紫外线（含等级）、降水概率、日出、日落、观测时刻 |
| 未来 3 天 | 每天最高/最低、天气现象、降水概率、降水量、最大风速、紫外线最大值 |
| 未来 24 小时 | 逐时温度、天气图标、降水概率 |
| 逐小时降水图 | 24 小时降水柱状图 + 降水概率虚线，悬停显示每个小时的具体数值 |
| 气象预警 | 中央气象台全国预警按「本市 → 本省」匹配，显示等级/类型/发布时间，附原文链接 |
| 台风路径 | 活跃台风或最近一次：轨迹、预报路径、强度配色、风圈、网格与参考城市，可点选轨迹点看当时气压/风速/移动 |
| 启动提醒 | 打开 DSH 后，若今日有降水或生效预警则弹窗（需点「知道了」确认）；当天已确认不再打扰，**出现新预警会再次提醒** |
| 代理提示 | 出口 IP 不在中国境内时，顶部提示「可能开了代理/VPN，请手动切换城市」 |
| 位置 | 自动（公网 IP）/ **高精度系统定位开关（持久，下次启动仍生效）** / 手动搜索城市，副标题始终标明来源、IP 与精度 |
| 交互 | 刷新、°C/°F 与 km/h / mph 切换（持久化）、关闭面板；数据每 **10 分钟**自动刷新（页面隐藏时暂停，切回立即补刷） |

## 安装

要求：DeepSeek Harness **0.2.x** 的 Web UI，本机 Node.js ≥ 22（只用于安装与构建，插件本身跑在浏览器）。

1. 把本仓库放到任意目录，例如 `C:\path\to\dsh-weather-panel`。
2. 让 Agent 执行插件安装（`plugin_manager` 的 `install_bundle`，目标填**仓库目录的绝对路径**）：

   ```
   install_bundle  target: C:\path\to\dsh-weather-panel
   ```

   返回 `application: "applied"` 即为生效。
3. 刷新 Web 页面，左侧栏出现「天气」图标。

卸载：在「插件」页停用/移除 `dsh-weather-panel`；本地仓库不会被改动。

## 数据来源与许可

| 用途 | 服务 | 说明 |
| --- | --- | --- |
| 天气/预报 | [Open-Meteo](https://open-meteo.com/) | 免 Key；数据 **CC BY 4.0**，面板底部保留署名 |
| 网络定位 | [ipwho.is](https://ipwho.is/)、[ipinfo.io](https://ipinfo.io/)、[api.ip.sb](https://ip.sb/) | 三源并发竞速，先可用者胜；单源失败不影响面板 |
| 逆地理编码 | [BigDataCloud](https://www.bigdatacloud.com/) | 坐标 → 「青岛市 · 黄岛区」 |
| 城市搜索 | Open-Meteo Geocoding | 中文查询自动追加「市」变体并重排 |
| **气象预警** | **中央气象台** `www.nmc.cn/rest/findAlarm` | 全国生效预警（实测 CORS `*`），按标题中的市/省名过滤 |
| **台风** | **中央气象台台风网** `typhoon.nmc.cn` | JSONP 接口，取回后自行剥壳解析；轨迹/预报/风圈/强度 |

**隐私**：定位只把公网 IP 交给上述定位服务；天气只把坐标交给 Open-Meteo；预警与台风请求不携带任何个人信息。缓存只写本机 `localStorage`。

## 兼容性与性能设计

**兼容**
- 只占**增量**席位，全部用自定义 id：`main` key `dsh-weather-panel`、`sidebar.panellist` id 同名、`shell.overlay` id `dsh-weather-panel-notice`。不复用、不覆盖宿主或其它插件的 id。
- `shell.overlay` 图层本身是 click-through 的，弹窗根节点显式 `pointer-events:auto`，只在自己范围内接管点击。
- 不读别的插件 DOM/CSS，不向 `document.body` 追加节点，不替换 root。
- 样式全在组件自己渲染的 `<style>` 里（`dshw-` 前缀），卸载即消失；颜色只用 `--dsw-alias-*` 令牌（带浅色兜底）。
- 文案走 Client locale 服务，中英双语即时切换；卸载时先 `selectPanel(null)` 再注销，不留空白页。

**性能**
- 共享 store：面板与启动提醒共用一份数据，页面打开只定位/取数一次，不会两个组件各拉一遍。
- 一次请求拿齐当前+逐时+逐日；预警翻页在「首页无匹配」时才继续（最多 3 页 298 条）。
- 缓存：预报/预警 10 分钟、定位 6 小时、台风 1 小时——重开面板与 10 分钟轮询通常零请求。
- 单个 `AbortController` 贯穿一次刷新，新刷新取消旧刷新；请求有硬超时。
- 页面隐藏时不轮询，切回时若已过期立即补刷。
- 无第三方运行时依赖，产物约 170 KiB（未压缩）。

## 目录结构

```
.
├── package.json          # bundle + dsh.client 声明、exports、脚本
├── cordis.patch.yml      # 插入一行 Host 插件（bundle 载体）
├── index.js              # Host 半侧：故意空实现，逻辑全在浏览器端
├── client.js             # 构建产物（npm run build 生成，勿手改）
├── icon.svg / locale/    # 插件管理器里的图标与标题描述
├── src/
│   ├── lib/              # 纯逻辑，Node 里可直接 import 测试
│   │   ├── i18n.js       # 双语词典、插值、Host 翻译降级
│   │   ├── wmo.js        # WMO 4677 → 文案/图标组/严重度
│   │   ├── format.js     # 温度/风/气压/降水/方位/时间/星期
│   │   ├── cache.js      # TTL 缓存 + 安全 Storage
│   │   ├── geo.js        # IP 定位竞速、逆地理、城市搜索
│   │   ├── weather.js    # Open-Meteo 请求构造与归一化
│   │   ├── alerts.js     # 中央气象台预警解析、地名匹配、签名
│   │   ├── typhoon.js    # 台风 JSONP 解析、轨迹/预报/边界/强度
│   │   ├── notice-core.js# 是否该弹窗的纯决策逻辑
│   │   └── store.js      # 共享状态、缓存、10 分钟刷新、React 绑定
│   ├── ui/
│   │   ├── styles.js     # 基础/面板/弹窗三段样式
│   │   ├── icons.js      # 天气插画与 UI 图标（内联 SVG）
│   │   ├── chart.js      # 逐小时降水柱状图
│   │   ├── typhoon-view.js # 台风轨迹图（经纬网 + 参考城市）
│   │   ├── notice.js     # 启动/新预警提醒弹窗
│   │   └── panel.js      # 面板组件与位置选择器
│   └── plugin.js         # 注册入口（三个席位 + store 生命周期）
├── scripts/build.mjs     # 零依赖打包：拼接 src → client.js
└── test/*.test.mjs       # node:test，65 个用例
```

## 开发

```bash
npm run build   # src/** → client.js（单文件浏览器模块）
npm run lint    # node --check
npm test        # node:test（Node ≥ 22）
npm run check   # 三连
```

`client.js` 是产物但**需要提交**：本地目录安装是直接 link 仓库，Harness 只读这个入口文件。
`src/lib/*.js` 是标准 ESM，测试直接 import；`scripts/build.mjs` 拼接时去掉 import/export 并包进 `window.__ModuleLoader__.load(...)`。

## 已知限制

- IP 定位只到**城市级**，且可能落在运营商或代理出口；面板会显示来源与 IP，并用顶部提示建议手动切换。
- 预警是**全国实时流**按标题匹配：先匹配本市，无匹配再列本省；因此「本市无、邻市有」这类边界情况可能显示为本省预警。
- 台风图不接第三方瓦片服务（避免额外依赖与额度问题），用经纬网 + 参考城市定位；需要底图可以后续加。
- 启动提醒只在页面打开/刷新时判断一次 + 每 10 分钟刷新时再判断；DSH 桌面端常驻不刷新页面时，靠 10 分钟轮询兜底新预警。
- 系统定位开关依赖浏览器权限：首次开启会请求授权，被拒绝或无定位能力时自动回退到网络定位，并在面板上给出提示（开关状态仍会保留，下次启动再试）。
- `°F` 只影响显示，请求始终是公制。

## 自定义

| 键 | 位置 | 说明 |
| --- | --- | --- |
| `dsh-weather-panel:settings` | `localStorage` | 单位与手动位置（`{units, override}`） |
| `dsh-weather-panel:location:resolved` | `localStorage` | 缓存的网络定位（6 小时） |
| `dsh-weather-panel:forecast:<lat>,<lon>:latest` | `localStorage` | 缓存的预报（10 分钟） |
| `dsh-weather-panel:alerts:<place>` | `localStorage` | 缓存的本地预警（10 分钟） |
| `dsh-weather-panel:typhoon:*` | `localStorage` | 台风列表/轨迹（1 小时） |
| `dsh-weather-panel:notice` | `localStorage` | 今日提醒的确认记录（`{date, signature}`） |

全部清掉即回到「全新安装」行为，下一次打开会重新弹提醒。

## 上传到 GitHub 前

`package.json` 里的 `repository / bugs / homepage` 用了占位用户名
`REPLACE_WITH_YOUR_GITHUB_USERNAME`，建好仓库后替换成你的账号即可；其余文件可直接提交。

```bash
git init -b main
git add .
git commit -m "feat: weather panel with CMA alerts and typhoon track"
git remote add origin git@github.com:<你的用户名>/dsh-weather-panel.git
git push -u origin main
```

## 许可

代码 MIT（见 `LICENSE`）。天气数据 CC BY 4.0 © Open-Meteo.com；预警与台风数据 © 中国气象局 / 中央气象台（仅作个人查看，请遵守其使用条款）；逆地理编码 © BigDataCloud；IP 定位 © 各自服务方。图标与插画为本项目原创。
