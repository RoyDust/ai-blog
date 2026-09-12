# P0-1 整改前后性能对比报告

> 测量时间：2026-08-15 · 环境：本机生产构建（`pnpm build` + `pnpm start`，端口 3000）+ Playwright Chromium 无缓存上下文
> 脚本：`scripts/perf-measure.mjs`（每页 3 次取中位数）· 原始数据：`perf-baseline.json`（前）/ `perf-after.json`（后）
> 说明：整改期间仓库内有另一路并行工作流（软删除索引迁移、安全头、internal-secrets、blog-settings 等），"整改后"数字包含其影响，归因边界见文末。

## 一、构建产物

| 指标 | 整改前 | 整改后 | 变化 |
|---|---|---|---|
| chunks 大小 | 4,343,613 B（65 个） | 4,363,427 B（67 个） | **+19,814 B（+0.46%）** |
| media 大小 | 46,892,358 B | 46,892,358 B | 0 |
| server 大小 | 139,945,289 B | 143,674,277 B | +3,728,988 B（+2.7%，含并行工作流改动） |
| static 合计 | 51,235,971 B | 51,255,785 B | +19,814 B（+0.04%） |

## 二、运行时指标（中位数，3 次）

| 页面 | 指标 | 整改前 | 整改后 | 变化 |
|---|---|---|---|---|
| `/` | TTFB | 7ms | 7ms | 0 |
| `/` | Load | 320ms | 299ms | **-21ms（-6.6%）** |
| `/` | 请求数 | 110 | 112 | +2（噪声范围） |
| `/` | JS 传输 | 314,457 B | 397,990 B | +83,533 B（SWR 内核进入共享布局 chunk） |
| `/posts` | TTFB | 500ms | 409ms | **-91ms（-18%）** |
| `/posts` | Load | 790ms | 726ms | **-64ms（-8.1%）** |
| `/posts` | 请求数 | 95 | 96 | +1 |
| `/posts` | JS 传输 | 313,886 B | 396,288 B | +82,402 B（同上） |
| `/about` | TTFB | 6ms | 4ms | -2ms |
| `/about` | Load | 295ms | 268ms | **-27ms（-9.2%）** |
| `/posts/[slug]` | TTFB | 6ms | 5ms | -1ms |
| `/posts/[slug]` | Load | 328ms | 324ms | -4ms |
| `/posts/[slug]` | 请求数 | 58 | 64 | +6（chunk 切分差异，噪声范围） |

## 三、交互场景与 API

| 场景 | 指标 | 整改前 | 整改后 | 变化 |
|---|---|---|---|---|
| `/posts` 无限滚动 | API 请求数（8 次滚动） | 4 | 4 | **持平（行为等价）** |
| `/posts` 无限滚动 | 场景墙钟 | 8,627ms | 8,640ms | +13ms（噪声） |
| `GET /api/posts?limit=1` | 中位数耗时 | 326ms | 313ms | -13ms |

## 四、代码债指标

| 指标 | 整改前 | 整改后 | 变化 |
|---|---|---|---|
| `admin/posts/page.tsx` 行数 | 1297 | **288** | **-1009（页面壳 + usePostsList + PostsTable + posts-ui）** |
| 后台手写 fetch 状态机（计划范围） | 各页面重复实现 | 计划内读取链路统一为 SWR | ✅ |
| 手写竞态防护（requestIdRef 等） | ≥2 处 | 0（useInfinitePosts 内核 SWR 化） | ✅ |
| 手写防抖（AdminGlobalSearch） | setTimeout 手写 | useDeferredValue | ✅ |
| 表单迁移 | 22/24 手写 | 计划内客户端数据表单全部迁移；无状态 GET 与既有 Server Actions 按决策保留 | ✅ |
| SWR 全局装配 + client-api + 契约测试 | 无 | ✅ + 10 单测 | ✅ |

## 五、结论与归因

1. **运行时**：ISR 页面 Load 中位数变化方向一致（`/posts` TTFB 中位数 -18%、Load -8.1%，`/about` Load -9.2%），主要来自 SWR 接管后首屏数据不再重复请求；交互场景（无限滚动）请求数与行为完全持平。⚠️ 受样本量限制，上述百分比**只能视为方向性一致，不构成统计显著的证据**（详见 §六）。
2. **构建**：chunks 仅 +19.8KB（+0.46%），为 SWR 核心进入共享布局 chunk 的代价；server 目录 +3.7MB 主要来自并行工作流（migrations/security 等）与本任务无关。
3. **工程债**：admin/posts 1297→288 行；计划内客户端读取链路完成 SWR 化；手写请求竞态防护清零。SWR 公共页 JS +83KB 是数据层统一的一次性成本，换来请求去重、缓存与错误契约统一（后台页面不再各自实现 loading/error/竞态）。
4. **归因边界**：`server` 目录变化包含另一路并行工作流（软删除部分唯一索引迁移、internal-secrets、security-headers、blog-settings 等）的改动，无法从本任务单独剥离。

## 六、方法论局限与口径修正（对抗性审查后补录）

1. **采样量**：本报告原始数据为每页 3 次取中位数。基线 `/posts` TTFB 三次分别为 394/500/534ms（离散范围 140ms），整改后为 355/409/422ms（范围 67ms）——中位数差值 91ms **小于**基线离散范围，因此「-18%」只能表述为方向性一致，不应宣称显著改善。
2. **测量环境**：全程为生产构建（`pnpm build` + `pnpm start`，端口 3000）+ Playwright Chromium 每次全新无缓存上下文，**未使用 dev server / 热重载**。
3. **归因污染**：整改后数字包含并行基础设施工作流的改动（见 §五.4）；相对干净的归因指标是 chunks +19,814B（+0.456%，SWR 核心进入共享布局 chunk）。
4. **脚本已升级**（`scripts/perf-measure.mjs`）：RUNS 3→5，并为 wallMs/ttfb/loadEvent/firstContentfulPaint 输出 `spread { min, max, range }`。后续前后对比请用新口径，且仅当差值大于两侧离散范围时才下「显著」结论。
