# P0-3 整改任务：cron / internal 接口防护面加固（后端安全）

> 状态：**已批准并实施**（决策：D1 方案 A / D3 统一 503 / D4 加失败限流 / 含 T7+T8）· 日期：2026-08-15
> 来源：`docs/2026-08-15-frontend-backend-architecture-analysis.md` P0-3
> 性质：后端安全改造；**不改动** cron 业务逻辑与正常调用的响应契约（仅错误语义标准化）
>
> 实施记录（2026-08-15 同日）：
> - T1/T2：`lib/internal-secrets.ts` 新增 `resolveInternalSecret` / `requireInternalSecret` / `isValidInternalSecret`；两个 cron 调用点统一走 `requireInternalSecret`；ingest 因专用 dev fallback 与缺配一次告警保留 `isValidOperationLogIngestSecret` 适配器，底层统一走 `safeSecretEquals`；缺配语义统一 503（`Internal service secret is not configured`）
> - T3：middleware matcher 扩展至 `/api/cron/:path*`、`/api/internal/:path*`；`INTERNAL_PATH_SECRETS` 注册表 fail-closed；401/503/429 统一 JSON + `x-request-id`；cron 拒绝写回操作日志、internal 拒绝不写回（防自环）
> - T4：缺配告警落在 lib 层（`api-operation-log-ingest-secret.ts` fail-loud 一次，与并行工作的契约测试对齐）
> - T5：`checkInternalFailureRateLimit`（10 次/分/IP、仅失败计费、内存限流器免 DB 依赖）
> - T6：新增 `internal-api-protection-coverage.test.ts` 契约扫描 + middleware 网关与 ingest 路由测试；middleware 测试总数 23
> - T7/T8：deploy.yml 注释、runbook 第 4 节、AGENTS.md/CLAUDE.md 同步
> - 最终验证（2026-08-17）：全量 260 个测试文件 / 1014 项用例、lint、`tsc --noEmit`、Prisma validate/status 与生产构建均通过；数据库 28 个迁移在位，构建生成 278 个静态页面

---

## 1. 背景与目标

分析报告 P0-3 原始问题点：

1. `middleware.ts` matcher 只覆盖 `/admin/:path*` 与 `/api/admin/:path*`，`/api/cron/*` 与 `/api/internal/*` 不在统一拦截面内，保护全靠各 handler 自检；
2. cron secret 校验为非常量时间比较（`token !== configuredSecret`）；
3. 内部日志摄取密钥未配置时**回退到 AUTH_SECRET**，会话签名密钥与内部接口密钥复用；
4. dev 硬编码回退密钥、生产缺密钥语义不统一。

### 1.1 已完成（2026-08-15 并行工作已落地，本任务不再重复）

| 项 | 状态 | 证据 |
|---|---|---|
| 常量时间比较工具 | ✅ 已落地 | `src/lib/internal-secrets.ts`（SHA-256 摘要 + `timingSafeEqual`、`readBearerToken`、`warnOnWeakSecret`）+ 单测 |
| 两个 cron 路由迁移 | ✅ 已落地 | `api/cron/ai-news/route.ts:7,18-23`、`api/cron/publish-scheduled/route.ts:5,23-28` |
| ingest 不再回退 AUTH_SECRET | ✅ 已落地 | `api-operation-log-ingest-secret.ts`：生产缺配返回 null、middleware 跳过回写；+ 单测 |
| 环境变量文档 | ✅ 已落地 | `.env.example` 第 12-23 行（AI_NEWS_CRON_SECRET / PUBLISH_SCHEDULED_CRON_SECRET / CRON_SECRET / OPERATION_LOG_INGEST_SECRET 等） |
| 运维清单 | ✅ 已有初稿 | `docs/deployment/security-hardening-runbook.md`（密钥轮换 / HTTPS / P0-2 验证） |

### 1.2 剩余缺口（本任务范围）

| 缺口 | 现状证据 |
|---|---|
| G1 三个调用点校验逻辑不一致 | ai-news 只认 `AI_NEWS_CRON_SECRET`（route.ts:13）；publish-scheduled 三链回退（route.ts:9-15）；ingest 仍用 `===` 非常量时间（api-operation-log-ingest-secret.ts:14） |
| G2 middleware 无兜底 | matcher 仍为 `['/admin/:path*', '/api/admin/:path*']`（middleware.ts:120）；未来新增 cron/internal 路由忘加鉴权无任何拦截 |
| G3 生产缺密钥语义不统一 | cron 抛裸 `Error` → 500 且泄露配置名（ai-news route.ts:15）；ingest 缺配时 middleware **静默**跳过回写（middleware.ts:20-22），被拒管理请求日志悄悄丢失 |
| G4 无失败限流 | `/api/cron/*`、`/api/internal/*` 无任何限流，可被 Bearer 密钥爆破（每次尝试都走到比较逻辑） |
| G5 无契约测试约束 | 没有测试锁住"所有 cron/internal 路由必须自检"约定（对照 `api-operation-log-coverage.test.ts` 已有该模式） |
| G6 部署/运维未显式管理 | `deploy.yml` 未显式注入 `OPERATION_LOG_INGEST_SECRET`；runbook 无 cron/internal 防护验证项 |

**目标形态**：所有内部接口统一走 `requireInternalSecret` 单一实现；middleware 用同一密钥注册表兜底；生产缺密钥 fail-fast + 可观测告警；失败限流防爆破；契约测试锁住约定；运维清单可执行。

---

## 2. 现状盘点（证据）

内部接口全量仅 3 个（已核验）：

| 路由 | 密钥来源（当前） | 提取方式 | 缺配行为 | 比较方式 |
|---|---|---|---|---|
| `/api/cron/ai-news` | `AI_NEWS_CRON_SECRET` | `Authorization: Bearer` | 抛 Error → 500（泄露配置名） | ✅ 常量时间（已迁移） |
| `/api/cron/publish-scheduled` | `PUBLISH_SCHEDULED_CRON_SECRET` → `CRON_SECRET` → `AI_NEWS_CRON_SECRET` | `Authorization: Bearer` | 抛 Error → 500 | ✅ 常量时间（已迁移） |
| `/api/internal/operation-logs` | `OPERATION_LOG_INGEST_SECRET`（dev 回退固定值） | `x-operation-log-ingest-secret` 头 | 生产缺配 → `===` 恒 false → 403 | ❌ 仍为 `===` |

调用方约束：
- GitHub Actions `daily-ai-news.yml`：Bearer `AI_NEWS_CRON_SECRET`，POST + 45 次轮询（约 6 次/分峰值）；
- GitHub Actions `publish-scheduled.yml`：Bearer `secrets.CRON_SECRET || secrets.AI_NEWS_CRON_SECRET`，每 15 分钟 1 次；
- middleware 自身回写（`recordDeniedAdminApi`）携带 `x-operation-log-ingest-secret`。
- 测试环境：`NODE_ENV=test` 下 `createApiOperationLog` 需 `API_OPERATION_LOG_TEST_ENABLE=1`（api-operation-logs.ts:331）。

---

## 3. 关键设计决策（请审查，见第 8 节问题）

### D1：middleware 是否扩展为内部接口统一网关

- **方案 A（推荐）**：matcher 增加 `'/api/cron/:path*'`、`'/api/internal/:path*'`，middleware 内置"精确路径 → 期望密钥"注册表，密钥不匹配统一 401；缺配（生产）cron 直接 503。handler 层校验**保留**（纵深防御，两处任一在都安全）。新增 cron/internal 路由忘记登记或只与既有路径同前缀时，middleware 立即兜底拒绝。
  - 注意点：middleware 自身回写 ingest 时携带正确密钥，网关天然放行；**对 `/api/internal` 的拒绝不写回日志**（防自环）；cron 拒绝可安全写回。
- **方案 B**：不扩展 middleware，仅靠"handler 自检 + 契约测试强制每个路由必须调用 helper"。改动最小、零运行时风险，但"忘记自检的新路由"只能靠测试兜住，运行时无第二道防线。

### D2：统一 helper API（`lib/internal-secrets.ts` 扩展）

```ts
// 按顺序取第一个非空值；全空返回 null
resolveInternalSecret(envKeys: string[]): string | null

// 通用守卫：解析密钥 → 弱密钥告警 → 提取（Bearer 或自定义头）→ 常量时间比较
// 缺配：生产/开发一律抛 ApiError(503, "Internal service secret is not configured")
// 不匹配：抛 UnauthorizedError
requireInternalSecret(request: Request, opts: {
  secretName: string;               // 告警与日志用
  envKeys: string[];                // 回退链
  header?: string;                  // 缺省 Authorization Bearer；ingest 传 "x-operation-log-ingest-secret"
}): void

// 供 ingest 等"布尔判定"场景
isValidInternalSecret(provided: string | null, envKeys: string[]): boolean
```

> 实施差异：operation-log ingest 需要封装专用 dev fallback、生产缺配一次告警和会话密钥隔离，因此 route 保留 `isValidOperationLogIngestSecret` 适配器；适配器使用同一 `safeSecretEquals` 常量时间比较，401/503 语义与通用 helper 一致。契约测试将该适配器作为显式允许的统一入口，不是无校验白名单。

### D3：生产缺密钥语义（fail-fast + 可观测）

- cron：缺配 → **503 + 固定文案**（不再泄露环境变量名），与"密钥错误 401"明确区分；
- ingest：handler 在缺配（生产）→ **503**；middleware 跳过回写时 `console.warn`（进程内去重一次），运维可发现"被拒管理请求日志在静默丢失"；
- dev：保持 `development-operation-log-ingest` 回退（测试与本地开发依赖）。

### D4：失败限流（防 Bearer 爆破）

- `rate-limit.ts` 新增 scope `internal`：**10 次/分/IP，仅在密钥不匹配时计费**，超限 429、否则 401；
- 只在失败路径计费 → 合法 GitHub Actions 流程（POST+轮询约 6 次/分）完全不受影响。

### D5：ingest 比较改常量时间

- `isValidOperationLogIngestSecret` 内部改用 `safeSecretEquals`（摘要后 `timingSafeEqual`），语义不变。

---

## 4. 任务清单

> 依赖顺序：T1 → T2 → T3 → T4/T5（可与 T3 并行）→ T6 → T7 → T8。合计约 3.5~4.5 人日。

### T1：扩展 `lib/internal-secrets.ts`（0.5d）

- 变更：新增 `resolveInternalSecret` / `requireInternalSecret` / `isValidInternalSecret`（见 D2）。
- 测试：`src/lib/__tests__/internal-secrets.test.ts` 增补——回退链取值、缺配 503、Bearer/自定义头提取、错误密钥 401、弱密钥告警调用。
- 验收：`pnpm vitest run src/lib/__tests__/internal-secrets.test.ts` 全绿。

### T2：三个调用点收敛到 helper（0.5d）

- 变更：
  - `api/cron/ai-news/route.ts`：`requireCronSecret` → `requireInternalSecret(request, { secretName: "AI_NEWS_CRON_SECRET", envKeys: ["AI_NEWS_CRON_SECRET"] })`；
  - `api/cron/publish-scheduled/route.ts`：`envKeys: ["PUBLISH_SCHEDULED_CRON_SECRET", "CRON_SECRET", "AI_NEWS_CRON_SECRET"]`；
  - `api/internal/operation-logs/route.ts`：使用专用 `isValidOperationLogIngestSecret` 适配器 + 缺配 503（与错误密钥 401 区分）；适配器底层使用 `safeSecretEquals`；
  - `api-operation-log-ingest-secret.ts`：比较改 `safeSecretEquals`（D5）。
- 测试更新（现有契约随语义变化同步改）：
  - `cron/ai-news/__tests__/route.test.ts:185-195`（缺配 500 → 503 + 新文案）；
  - `cron/publish-scheduled/__tests__/route.test.ts` 对应用例；
  - `api-operation-log-ingest-secret.test.ts` 增补常量时间/503/401 区分用例。
- 验收：`pnpm vitest run src/app/api/cron src/app/api/internal src/lib/__tests__/api-operation-log-ingest-secret.test.ts` 全绿。

### T3：middleware 内部接口网关（1d）

- 变更（`middleware.ts`）：
  - matcher → `['/admin/:path*', '/api/admin/:path*', '/api/cron/:path*', '/api/internal/:path*']`；
  - 新增精确路径 `INTERNAL_PATH_SECRETS` 注册表：`/api/cron/ai-news` → `AI_NEWS_CRON_SECRET`；`/api/cron/publish-scheduled` → 三链回退；`/api/internal/operation-logs` → `OPERATION_LOG_INGEST_SECRET`（dev 回退）；相似前缀不继承密钥；
  - 网关逻辑：解析期望密钥 → 缺配且生产：cron 503 / internal 放行给 handler；提取提供值 → `safeSecretEquals` → 不匹配先过 D4 失败限流再 401（统一 JSON + `x-request-id`）；
  - cron 拒绝经 `event.waitUntil` 写回操作日志；**internal 拒绝不写回**（防自环）；middleware 自身回写携带正确密钥，天然放行；
- 测试：`src/__tests__/middleware.test.ts` 新增——错密钥 401 / 正确密钥放行 / 生产缺配 cron 503 / internal 拒绝不产生回写 fetch / cron 拒绝产生回写（spy `fetch`）。
- 验收：middleware 单测全绿；`pnpm dev` 下手动 curl 冒烟（正确/错误/缺失三种）。

### T4：生产缺密钥可观测（0.5d）

- 变更：`middleware.ts` `recordDeniedAdminApi` 在 ingest 密钥缺失（生产）时 `console.warn`（模块级去重一次）；
- runbook 补条目（见 T7）。
- 验收：缺配时服务启动/首次触发出现一条 `[security]` 级别警告。

### T5：内部接口失败限流（0.5d）

- 变更：`rate-limit.ts` 新增 `internalFailureLimiter`（10/min）与 `checkInternalFailureRateLimit(request)`；middleware 网关在密钥不匹配时调用，超限 429。
- 测试：`rate-limit.test.ts` 新增 scope 用例；middleware 测试用 `vi.useFakeTimers` 验证 429 阈值。
- 验收：连续错密钥 10 次后第 11 次返回 429，正确密钥始终放行。

### T6：契约测试（0.5d）

- 新增 `src/app/api/__tests__/internal-api-protection-coverage.test.ts`：源码扫描 `api/cron/**/route.ts` 与 `api/internal/**/route.ts`，断言每个文件引用 `requireInternalSecret` / `isValidInternalSecret`，或 operation-log ingest 的专用 `isValidOperationLogIngestSecret` 适配器；
- `middleware.test.ts` 断言 matcher 包含 `/api/cron/:path*` 与 `/api/internal/:path*`。
- 验收：删除任一 handler 的校验调用即测试失败（红绿验证）。

### T7：CI / 部署与 runbook 对齐（0.25d）

- `deploy.yml`：APP_ENV_FILE 注释文档明确须含 `OPERATION_LOG_INGEST_SECRET`；`AI_NEWS_CRON_SECRET` append 保持；
- `daily-ai-news.yml` / `publish-scheduled.yml`：与 helper 回退链对齐（无需代码变更，仅核对注释）；
- `security-hardening-runbook.md` 增补第 5 节「cron/internal 防护验证」：无密钥 401、连续失败 429、缺配 503、被拒 cron 尝试在操作日志可见、两个定时工作流 `workflow_dispatch` 冒烟通过。
- 验收：按 runbook 第 5 节可逐项勾选。

### T8：文档同步（0.25d）

- `AGENTS.md` 与 `CLAUDE.md`「API 路由约定」增补：cron/internal 路由**必须**经 `requireInternalSecret`（`lib/internal-secrets.ts`）校验；middleware 对 `/api/cron`、`/api/internal` 有同一密钥网关兜底；密钥命名与回退链表；生产缺配 fail-fast。
- `lib/internal-secrets.ts` 模块注释更新为"唯一内部密钥校验入口"。

---

## 5. 契约测试定义（核心断言）

1. 每个 `api/cron/**`、`api/internal/**` 的 `route.ts` 都调用内部密钥校验（源码扫描，白名单例外显式登记）；
2. middleware matcher 覆盖 `/api/cron/:path*`、`/api/internal/:path*`；
3. 密钥错误 → 401（统一 JSON），缺配（生产）→ 503，连续失败超限 → 429；
4. 常量时间比较由 `safeSecretEquals` 唯一实现，路由层禁止出现 `===` 直比（扫描 `route.ts` 中与 secret 相关的 `!==`/`===` 亦可纳入，作为低优先级附加断言）。

---

## 6. 验收标准（Definition of Done）

- [x] 三个内部路由全部经统一内部密钥入口（`requireInternalSecret` / `isValidInternalSecret` / operation-log 专用适配器），代码中无遗留手写密钥比较；
- [x] middleware 网关本地契约生效：错误密钥 401、缺配 503、爆破 429、正确密钥放行；
- [ ] GitHub Actions 两个工作流完成线上 `workflow_dispatch` 冒烟（需外部环境执行）；
- [x] 被拒 cron 的日志回写与 internal 防自环行为已有回归覆盖；
- [x] 新增/遗漏校验或未精确登记的内部路由会被契约测试拦截；
- [x] `pnpm lint`、`pnpm test`、`pnpm build` 本地全绿；
- [ ] 外部 CI 通过（需提交后实际运行）；
- [x] `.env.example`、runbook、AGENTS.md/CLAUDE.md 同步完成；
- [ ] 生产 `shared/.env` 与 GitHub Secrets 配齐 `OPERATION_LOG_INGEST_SECRET`（随 runbook 人工执行）。

> 仓库侧保护面与本地验证已完成；未勾选项均依赖外部 CI/生产 Secrets/线上工作流，不以本地结果代替。

---

## 7. 风险与回滚

| 风险 | 缓解 |
|---|---|
| middleware 引入 `node:crypto` 依赖 | Next 16 middleware 为 Node runtime，支持；CI build + middleware 单测兜底 |
| GitHub Actions 被网关误挡 | 网关只在"密钥错误"时拒绝；上线后先 `workflow_dispatch` 冒烟再信任定时 |
| 日志回写自环 | internal 拒绝不写回；middleware 回写携带正确密钥 |
| 既有测试因 500→503 语义变化失败 | T2 内同步更新用例（契约测试文化：语义变化显式改测试） |
| 回滚 | matcher 一行还原即可退回纯 handler 自检；handler 校验保留，任何时刻都至少有一道防线 |

---

## 8. 待审查决策点

1. **D1 网关形态**：方案 A（middleware 扩展 + 注册表，推荐）还是方案 B（仅 handler + 契约测试）？
2. **D3 缺配语义**：cron 缺配统一 503 固定文案（推荐）还是维持 500？
3. **D4 失败限流**：是否加 10 次/分/IP 的失败限流（推荐加）？
4. **任务范围**：是否包含 T7（CI/runbook）与 T8（AGENTS/CLAUDE 文档同步）（推荐包含）？
