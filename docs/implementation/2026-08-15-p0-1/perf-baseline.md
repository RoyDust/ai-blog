# P0-1 性能基线（整改前）

> 测量时间：2026-08-15 · 环境：本机生产构建（`pnpm build` + `pnpm start`，端口 3000）+ Playwright Chromium 无缓存上下文
> 脚本：`scripts/perf-measure.mjs`（每页 3 次取中位数）· 原始数据：`perf-baseline.json`

## 一、构建产物（baseline）

| 指标 | 数值 |
|---|---|
| buildId | 见 `build-baseline.json` |
| chunks 大小 | **4,343,613 B（65 个 chunk）** |
| media 大小 | 46,892,358 B（字体等） |
| server 大小 | 139,945,289 B |
| static 合计 | 51,235,971 B |
| 静态页生成 | 276/276 |

## 二、运行时指标（中位数，3 次）

| 页面 | TTFB | DOMContentLoaded | Load | FCP | 请求数 | 传输字节 | JS 传输 |
|---|---|---|---|---|---|---|---|
| `/`（首页） | 7ms | 32ms | 320ms | 272ms | 110 | 24,013,788 | 314,457 |
| `/posts`（列表） | 500ms | 533ms | 790ms | 720ms | 95 | 24,027,414 | 313,886 |
| `/about` | 6ms | 34ms | 295ms | 272ms | 68 | 23,692,624 | 306,464 |
| `/posts/[slug]`（文章详情） | 6ms | 32ms | 328ms | 252ms | 58 | 23,958,239 | 306,499 |

> 传输字节 ~24MB 由 CJK 字体（Noto Serif SC 700/900）主导，属 P2-7 范围，非本次整改对象。

## 三、交互场景与 API

| 场景 | 指标 |
|---|---|
| `/posts` 无限滚动（8 次滚动） | 共 4 次 API 请求（popular + page2/3/4），场景墙钟 ~8.6s |
| `GET /api/posts?limit=1` | **326ms**（中位数，3 次） |

## 四、代码债指标（整改对象）

| 指标 | 基线值 |
|---|---|
| 全仓 fetch 调用点 | 125 处（仅 admin 组件 51 处） |
| 手写轮询（setInterval） | 4 处 |
| 手写表单（useState、无客户端校验） | 22 / 24 个 |
| 手写竞态防护（requestIdRef 等） | ≥2 处 |
| `admin/posts/page.tsx` 行数 | 1297 行 |
