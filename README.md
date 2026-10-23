<div align="center">
  <img src="https://raw.githubusercontent.com/python3603/dsh-weather-panel/main/docs/assets/hero.svg" alt="dsh-weather-panel — 天气、预警与台风，装进 DeepSeek Harness" width="100%" />
</div>

<h1 align="center">dsh-weather-panel · 天气面板</h1>

<h3 align="center">「工作时也不能忘记天气情况哦！」</h3>

<p align="center">
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-4f6ef7?style=flat-square"/></a>
  <a href="https://www.npmjs.com/package/dsh-weather-panel"><img alt="npm" src="https://img.shields.io/npm/v/dsh-weather-panel?style=flat-square&color=cb3837&logo=npm&logoColor=white"/></a>
  <a href="https://github.com/deepseek-ai"><img alt="DeepSeek Harness" src="https://img.shields.io/badge/DeepSeek%20Harness-0.2.x-38bdf8?style=flat-square"/></a>
  <img alt="No API key" src="https://img.shields.io/badge/API%20key-not%20required-10b981?style=flat-square"/>
  <img alt="Tests" src="https://img.shields.io/badge/tests-118%20passing-brightgreen?style=flat-square"/>
  <img alt="Platform" src="https://img.shields.io/badge/surface-Web%20UI-8b5cf6?style=flat-square"/>
</p>

<div align="center">
  <img src="https://raw.githubusercontent.com/python3603/dsh-weather-panel/main/docs/assets/memes/jiaban.webp" alt="加班中的鲸鱼娘" width="118" />
  <img src="https://raw.githubusercontent.com/python3603/dsh-weather-panel/main/docs/assets/memes/ok.webp" alt="OK" width="118" />
  <img src="https://raw.githubusercontent.com/python3603/dsh-weather-panel/main/docs/assets/memes/bixin.webp" alt="比心" width="118" />
</div>

---

## 呜啾～ 这里是主人的天气小管家

主人又在对着屏幕敲代码了吧。窗外是晴是雨、要不要带伞、有没有台风——这些小事就交给我盯着好啦。

侧边栏多一个小小的天气图标，点开来就能看到当前城市的气温、风、湿度和未来几天的变化；**开 DSH 的时候如果今天会下雨、或者中央气象台发了预警，我会先跳出来提醒主人的**，主人点一下「知道了」就好啦。呜啾～

> 下面开始是严谨部分：数据来自哪里、怎么保证兼容、性能如何、怎样自己构建。可爱到此为止，技术描述不再卖萌。

---

## 一张图看懂数据流

<div align="center">
  <img src="https://raw.githubusercontent.com/python3603/dsh-weather-panel/main/docs/assets/data-flow.svg" alt="定位、天气、预警与台风数据汇入同一个天气面板" width="100%" />
</div>

**数据链路（严谨版）**：浏览器端并发定位（三个 IP 源竞速，可选系统高精度定位）→ BigDataCloud 逆地理得到城市名 → 以该坐标向 Open-Meteo 请求当前 / 逐时 / 逐日数据；同一轮并行拉取中央气象台全国预警（按市 → 省匹配标题）与台风列表/轨迹；全部结果进入一个共享 store，供面板与启动提醒共用，缓存写入 `localStorage`。

## 功能

| 区块 | 内容 |
| --- | --- |
| 当前天气 | 温度、天气现象（WMO 码本地化）、体感、今日最高/最低 |
| 主要参数 | 湿度、海平面气压、风向+风速、阵风、降水、云量、紫外线（含等级）、降水概率、日出、日落、观测时刻 |
| 未来 5 天 | 每天最高/最低、天气现象、降水概率、降水量、最大风速、紫外线最大值 |
| 未来 24 小时 | 逐时温度、天气图标、降水概率 |
| 逐小时降水图 | 24 小时降水柱状图 + 降水概率虚线，右侧带 **0 / 50 / 100% 概率刻度**，悬停显示每个小时的具体数值 |
| 气象预警 | 中央气象台全国预警按「本市 → 本省」匹配；**可在面板内展开查看全部预警**（等级、类型图标、发布时间、原文链接），不必跳浏览器 |
| 台风路径 | 活跃台风或最近一次：离线海岸线底图、轨迹、预报路径、强度配色、**带等级标注的风圈（7 / 10 / 12 级）**；可点选轨迹点看当时气压/风速/移动，一键「回到当前时刻」；**中央气象台无活跃台风时显示「近期无活跃台风」并可查看最近一次** |
| 启动提醒 | 打开 DSH 后，若今日有降水或生效预警则弹窗（需确认）；当天已确认不再打扰，出现新预警会再次提醒 |
| 位置 | **网络定位（公网 IP）/ 系统定位（浏览器高精度，持久生效）二选一**，随时切回；也可手动搜索城市；副标题标明来源、IP 与精度 |
| 代理提示 | 出口 IP 不在中国大陆时，顶部提示「可能开了代理/VPN，请手动切换城市」 |
| 雷达 | **官方雷达拼图**：全国 + 华北/东北/华东/华中/华南/西南/西北，与 nmc.cn 相同的产品划分；时次滑杆 + 播放动画，图片直连 `image.nmc.cn` |
| 历史气温 | 天气页底部：**近 7 天 / 近 30 天**（默认 7 天）日最高、最低与平均气温折线，带温度带与极值标注（不是 K 线） |
| 卫星云图 | **国家卫星气象中心官方产品（6 个）**：FY-4B 中国区域（伪彩 / 真彩 72h 回看）、FY-4B 全圆盘（自然色 / 长波红外）、FY-2G 中国区可见光、全球红外 15 分钟；按官方 XML 清单逐帧，滑杆、上一帧/下一帧、点击放大 |
| 交互 | 刷新、°C/°F 与 km/h / mph 切换（持久化）、关闭面板；数据每 10 分钟自动刷新（页面隐藏时暂停，切回补刷） |

## 实际界面

<div align="center">
  <img src="https://raw.githubusercontent.com/python3603/dsh-weather-panel/main/docs/screenshots/panel-weather.webp" alt="天气页：当前天气、8 项气象参数、未来 5 天与逐小时降水" width="100%" />
  <br/>
  <sub>天气页 · 当前天气 + 8 项气象参数 + 未来 5 天 + 逐小时降水与 24 小时条带（图中位置标签已打码）</sub>
</div>

<div align="center">
  <img src="https://raw.githubusercontent.com/python3603/dsh-weather-panel/main/docs/screenshots/panel-typhoon.webp" alt="台风页：实况轨迹、预报路径、强度配色与风圈" width="100%" />
  <br/>
  <sub>台风页 · 实况轨迹（按强度着色）+ 预报路径 + 风圈 + 参考城市与经纬网</sub>
</div>

## 界面说明
- **天气页**：当前天气大卡（含 8 项参数）+ 未来 5 天卡片 + 逐小时降水图与 24 小时条带。
- **台风页**：有活跃或最近一次台风时自动出现页签。图表用等距圆柱投影绘制：经纬网、8 个参考城市、实况轨迹（按强度着色）、预报路径（虚线 + 空心点）、最新位置的风圈（按 km 换算为经纬度半径，呈椭圆），并复用内置的 Natural Earth 陆地轮廓作为底图。
- **雷达页**：产品划分与 nmc.cn 一致（全国 + 七大分区）；时次按官方 6 分钟规则生成，滑杆逐帧查看、可播放动画；产品图直连 image.nmc.cn，未发布的时次自动回退到上一帧。
- **启动提醒**：弹窗汇总今日降水与生效预警；确认按钮使用主题文字色（不使用「品牌色填充 + 白字」），浅色与深色主题下均保持可读。

## 安装

要求：DeepSeek Harness **0.2.x** 的 Web UI，本机 Node.js ≥ 22（只用于安装与构建，插件本身跑在浏览器）。

1. 把仓库放到任意目录，例如 `C:\path\to\dsh-weather-panel`。
2. 让 Agent 执行插件安装（`plugin_manager` 的 `install_bundle`，目标填**仓库目录的绝对路径**）：

   ```
   install_bundle  target: C:\path\to\dsh-weather-panel
   ```

   返回 `application: "applied"` 即为生效。
3. 刷新 Web 页面，左侧栏出现「天气」图标。

卸载：在「插件」页停用/移除 `dsh-weather-panel`；本地仓库不会被改动。

<div align="center">
  <img src="https://raw.githubusercontent.com/python3603/dsh-weather-panel/main/docs/assets/memes/ok.webp" alt="装好了" width="96" />
</div>

## 数据来源与许可

| 用途 | 服务 | 说明 |
| --- | --- | --- |
| 天气/预报 | [Open-Meteo](https://open-meteo.com/) | 免 Key；数据 **CC BY 4.0**，面板底部保留署名 |
| 网络定位 | [ipwho.is](https://ipwho.is/)、[ipinfo.io](https://ipinfo.io/)、[api.ip.sb](https://ip.sb/) | 三源并发竞速，先可用者胜；单源失败不影响面板 |
| 逆地理编码 | [BigDataCloud](https://www.bigdatacloud.com/) | 坐标 → 「北京市 · 朝阳区」 |
| 城市搜索 | Open-Meteo Geocoding | 中文查询自动追加「市」变体并重排 |
| 气象预警 | **中央气象台** `www.nmc.cn/rest/findAlarm` | 全国生效预警（实测 CORS `*`），按标题中的市/省名过滤 |
| 台风 | **中央气象台台风网** `typhoon.nmc.cn` | JSONP 接口，取回后自行剥壳解析；轨迹/预报/风圈/强度 |
| 底图 | [Natural Earth](https://www.naturalearthdata.com/) 1:50m 陆地 | 公有领域；构建期裁剪西北太平洋并抽稀，打进 bundle，约 36 KiB |
| 雷达 | **中央气象台雷达拼图** `image.nmc.cn` | 官方产品图（PNG），按官方 6 分钟时次规则取帧；图片加载不需要 CORS |
| 卫星云图 | **国家卫星气象中心** `img.nsmc.org.cn` | 产品清单 XML（实测 CORS `*`）逐帧列出官方 JPG；覆盖 FY-4B / FY-2G / 静止卫星全球拼图 |

| 历史气温 | Open-Meteo `past_days` | 逐日最高 / 最低 / 平均；`forecast_days=0` 只回完整日（截至昨天） |

**隐私**：定位只把公网 IP 交给上述定位服务；天气只把坐标交给 Open-Meteo；预警与台风请求不携带任何个人信息。缓存只写本机 `localStorage`。

**README 中的表情包**：来自本项目作者自用的表情包图库，仅用于本仓库页面展示，不随代码授权（请勿另作商用）。

## 兼容性与性能设计

**兼容**
- 只占**增量**席位，全部用自定义 id：`main`（页面）、`sidebar.panellist`（图标）、`shell.overlay`（启动提醒）。不复用、不覆盖宿主或其它插件的 id。
- `shell.overlay` 图层本身是 click-through 的，弹窗根节点显式 `pointer-events:auto`，只在自己范围内接管点击。
- 不读其它插件的 DOM/CSS，不向 `document.body` 追加节点，不替换 root。
- 样式全部写在组件自行渲染的 `<style>` 元素中（`dshw-` 前缀），卸载即消失；颜色只使用 `--dsw-alias-*` 主题令牌并带兜底值，且避免「品牌色填充 + 白字」这类在浅色主题下失效的组合。
- 文案通过 Client locale 服务注册，中英双语即时切换；插件卸载时先 `selectPanel(null)` 再注销，不留空白页。

**性能**
- 共享 store：面板与启动提醒共用同一份数据，页面打开只定位/取数一次。
- 单次请求覆盖当前 + 逐时 + 逐日；预警翻页仅在首页无匹配时继续（最多 3 页）。
- 缓存 TTL：预报/预警 10 分钟、定位 6 小时、台风 1 小时；重开面板与轮询通常零请求。
- 每个刷新周期使用独立 `AbortController`，新刷新取消旧刷新；所有请求有硬超时。
- 页面隐藏时不轮询，切回时若数据已过期立即补刷。
- 台风投影与约 36 KiB 的陆地 path 以 `useMemo` 按台风缓存，点选轨迹点不触发重算。
- 无第三方运行时依赖，产物约 229 KiB（未压缩，其中约 36 KiB 为离线底图）。

## 目录结构

```
.
├── package.json          # bundle + dsh.client 声明、exports、脚本
├── cordis.patch.yml      # 插入一行 Host 插件（bundle 载体）
├── index.js              # Host 半侧：故意空实现，逻辑全在浏览器端
├── client.js             # 构建产物（npm run build 生成，勿手改）
├── icon.svg / locale/    # 插件管理器里的图标与标题描述
├── docs/assets/          # README 插图与表情包（原创 SVG / 自用图库）
├── docs/screenshots/     # 真实界面截图（位置标签已打码）
├── src/
│   ├── lib/              # 纯逻辑，Node 里可直接 import 测试
│   │   ├── i18n.js       # 双语词典、插值、Host 翻译降级
│   │   ├── links.js      # 仓库/Issue 链接（换仓库只改这里）
│   │   ├── wmo.js        # WMO 4677 → 文案/图标组/严重度
│   │   ├── format.js     # 温度/风/气压/降水/方位/时间/星期
│   │   ├── cache.js      # TTL 缓存 + 安全 Storage
│   │   ├── geo.js        # IP 定位竞速、逆地理、城市搜索
│   │   ├── weather.js    # Open-Meteo 请求构造与归一化
│   │   ├── alerts.js     # 中央气象台预警解析、地名匹配、签名
│   │   ├── typhoon.js    # 台风 JSONP 解析、轨迹/预报/边界/强度/风圈等级
│   │   ├── radar.js      # 雷达产品与时次规则、官方图片 URL
│   │   ├── satellite.js  # NSMC / 向日葵九号 / NASA GIBS 的取图规则
│   │   ├── history.js    # 历史气温取数与归一化
│   │   ├── notice-core.js# 是否该弹窗的纯决策逻辑
│   │   └── store.js      # 共享状态、缓存、10 分钟刷新、React 绑定
│   ├── ui/
│   │   ├── styles.js     # 基础/面板/弹窗三段样式
│   │   ├── icons.js      # 天气插画与 UI 图标（内联 SVG）
│   │   ├── chart.js      # 逐小时降水柱状图
│   │   ├── basemap-data.js # 生成产物：西北太平洋陆地轮廓（约 36 KiB）
│   │   ├── typhoon-view.js # 台风轨迹图（经纬网 + 参考城市 + 风圈等级）
│   │   ├── radar-view.js # 雷达拼图（区域 / 时次 / 播放）
│   │   ├── satellite-view.js # 卫星云图（三家源）
│   │   ├── history-chart.js  # 历史气温折线
│   │   ├── media-zoom.js     # 共用的大图查看层
│   │   ├── notice.js     # 启动/新预警提醒弹窗
│   │   └── panel.js      # 面板组件与位置选择器
│   └── plugin.js         # 注册入口（三个席位 + store 生命周期）
├── scripts/build.mjs     # 零依赖打包：拼接 src → client.js
├── scripts/build-basemap.mjs # 生成离线海岸线（Natural Earth 裁剪+抽稀）
└── test/                 # node:test：87 个用例（含渲染冒烟测试）
```

## 开发

```bash
npm run build     # src/** → client.js（单文件浏览器模块）
npm run basemap   # 重新生成离线海岸线（需要联网下载 Natural Earth）
npm run lint      # node --check
npm test          # node:test，需要 Node ≥ 22
npm run check     # 三连
```

`client.js` 是产物但**需要提交**：本地目录安装直接 link 仓库，Harness 只读这个入口文件。`src/lib/*.js` 是标准 ESM，测试直接 import；`scripts/build.mjs` 拼接时去掉 import/export 并包进 `window.__ModuleLoader__.load(...)`。

**测试包含渲染冒烟测试**：在 `vm` 里启动真实 bundle，用极简 React shim 真正执行组件树（天气页 / 打开位置选择器 / 台风页 / 选中历史点 / 提醒弹窗 / 侧边栏图标），任何分支里的引用错误都会在 CI 阶段暴露，而不是让用户看到空白页。

## 测试提醒弹窗

面板 →「更换位置」→ 点「预览提醒弹窗」，用一条演示用的台风红色预警触发启动提醒（不写入真实数据）：

- 演示数据只写 `dsh-weather-panel:demo-alert`，不参与真实预警匹配，也不进缓存；
- 弹窗里点「知道了」会自动清掉演示开关；
- 演示模式忽略「今日已确认」去重，便于反复查看样式；
- 也可在浏览器控制台（Electron 中 Ctrl+Shift+I）手动切换：

  ```js
  localStorage.setItem('dsh-weather-panel:demo-alert', 'typhoon-red'); location.reload();  // 台风红色
  localStorage.setItem('dsh-weather-panel:demo-alert', 'rain-orange'); location.reload();  // 暴雨橙色
  localStorage.removeItem('dsh-weather-panel:demo-alert');
  localStorage.removeItem('dsh-weather-panel:notice'); location.reload();                  // 完全复位
  ```

## 已知限制

- IP 定位只到城市级，且可能落在运营商或代理出口；面板会显示来源与 IP，并用顶部提示建议手动切换。
- 预警来自全国实时流并按标题匹配：先本市，无匹配再本省；「本市无、邻市有」这类边界情况可能显示为本省预警。
- 台风底图为离线陆地轮廓（Natural Earth 1:50m，公有领域，仅陆地、不画国界）：无需 Key、不受 CORS/额度限制、可离线使用；代价是没有地名与行政区划，海岸线在 1:50m 粒度下约有 1–2 km 概化误差。
- 启动提醒在页面打开/刷新时判断，并每 10 分钟轮询以兜底新预警。
- 系统定位依赖浏览器权限：首次开启会请求授权，被拒绝时回退网络定位并给出提示（开关状态保留）。
- 雷达图按官方 6 分钟时次生成候选帧：nmc.cn 的帧清单页面没有 CORS 头，浏览器读不到，因此缺帧时靠图片 onerror 回退（最新时次通常滞后 1-2 帧）。全国可回看 24 小时、分区约 2 小时，与官网一致。
- 卫星云图只接国内官方源（国家卫星气象中心）：清单 XML 与产品图都直连 `img.nsmc.org.cn`（实测 CORS 允许读取清单），影像按官方节奏更新（FY-4B 每 15 分钟、FY-2 每 30 分钟）。
- 历史气温取的是 Open-Meteo 的逐日统计，`forecast_days=0` 不返回今天，所以曲线截止到**昨天**（完整日）。
- `°F` 只影响显示，请求始终使用公制。

<div align="center">
  <img src="https://raw.githubusercontent.com/python3603/dsh-weather-panel/main/docs/assets/memes/tangping.webp" alt="先躺一会儿" width="96" />
</div>

## 反馈

发现 bug、想要新功能，或者觉得某处文字看不清，都欢迎提 issue：

**<https://github.com/python3603/dsh-weather-panel/issues>**

面板底部同样有「反馈 / 提 issue」入口。

<div align="center">
  <img src="https://raw.githubusercontent.com/python3603/dsh-weather-panel/main/docs/assets/memes/wenhao.webp" alt="有问题吗？" width="96" />
</div>

## 许可

代码 MIT（见 [LICENSE](LICENSE)）。天气数据 CC BY 4.0 © Open-Meteo.com；预警与台风数据 © 中国气象局 / 中央气象台（仅作个人查看，请遵守其使用条款）；底图数据 © Natural Earth（公有领域）；逆地理编码 © BigDataCloud；IP 定位 © 各自服务方。图标与插图（SVG）为本项目原创；README 表情包来自作者自用图库，仅用于本仓库展示。

<div align="center">
  <sub>愿主人出门时，天正好是晴的。 ☀️ 🐋</sub>
</div>
