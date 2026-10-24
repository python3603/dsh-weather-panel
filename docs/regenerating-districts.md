# 重新生成区县索引（districts-data.js）

`src/lib/districts-data.js` 是构建期产物，已提交进仓库；运行时不联网、不依赖第三方服务。
它来自 **GeoNames** 的中国行政区数据（CC BY 4.0）。

## 数据来源与许可

- 地址：<https://download.geonames.org/export/dump/CN.zip>
- 许可：**CC BY 4.0**（ GeoNames 数据），使用时需保留署名。
- 只取 `feature class = A` 且 `feature code ∈ {ADM1, ADM2, ADM3}` 的行：
  - ADM1 → 省级（31 条）
  - ADM2 → 地级（360 条）
  - ADM3 → 区县级（2895 条）

## 处理规则

1. 中文名从 `alternatenames` 里取：优先带行政区后缀且长度 ≤ 12 的短名（「上海市」而不是「沪」）。
2. 坐标取 GeoNames 的行政中心点，`toFixed(2)`（约 1 km 精度，选城市足够）。
3. 区县挂到地级市：按 `admin1 + admin2` 匹配 ADM2；匹配不到时退回省级（直辖市即这种情况）。
4. **先扫一遍省级再处理地级/区县**：文件按 geonameid 排序，ADM2 可能排在它的 ADM1 之前，
   单遍处理会让部分区县丢父级（早期版本就踩过，表现为副标题只剩市名）。

## 生成命令

```sh
# 1) 下载并解压 GeoNames 中国区数据（约 30 MB 压缩 / 126 MB 文本）
curl -O https://download.geonames.org/export/dump/CN.zip
unzip CN.zip CN.txt

# 2) 生成索引（覆盖 src/lib/districts-data.js）
node scripts/gen-districts.mjs ./CN.txt

# 3) 构建并跑测试
npm run build && npm test
```

生成后直接覆盖 `src/lib/districts-data.js`，然后 `npm run build && npm test`。
包体积会随条目数变化：目前 2895 条区县 + 360 条地级 + 31 条省级 ≈ **100 KiB**。

## 别名的维护

GeoNames 是快照，个别区县后来更名或撤并（例如两江新区成立后，部分区域从渝北区析出）。
`src/lib/districts.js` 里的 `DISTRICT_ALIASES` 保存这类常用别名，新增时补一条即可：

```js
export const DISTRICT_ALIASES = {
  两江新区: '渝北区',
  // …
};
```
