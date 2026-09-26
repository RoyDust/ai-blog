# Claude 修改审查记录

- 日期：2026-09-26。
- 状态：审查与纠错复核完成。规范轴无确认的阻塞项；方案轴确认的 1 项 P2 已修复并通过定向验证。未确认 P0 / P1；本次修复未再启动审查。
- 基线：`1fb15bdde90acecb546353ef156ae2d367864cef`；分支 `codex/p2-remediation`。
- 提供给审查者的范围：相对基线的工作区差异，以及清单中的未跟踪文件，共 136 个文件。包含既有 P1 / PR #22、P2 和独立的 `ai-review.ts` 改动，不能把所有差异归为本轮 P2 新增。文件清单不等于逐文件完整审查证明。
- 工具：实际运行 Claude Code CLI 2.1.283；初始化记录的模型标识为 `claude-opus-5-5[1m]`。规范和方案分别运行，并分别做定向纠错复核。
- 方案轴最初的检索会话反复追加读取，未形成最终报告，已停止。随后将 68 个源码文件、对应差异和完整方案整理为单次无工具复核输入，再对候选逐项做源码反证与 Claude 纠错。两次报告会话均正常退出；中止的检索会话不计为已完成报告。
- 权限：全部启用 safe mode，禁用 MCP 与会话持久化。检索阶段仅开放 `Read`、`Grep`、`Glob`；后续方案报告与纠错阶段的工具列表为空。Claude 未获 Shell、写文件或编辑权限。
- Claude 审查阶段只做静态审查，未修改业务代码或重跑测试。之后按用户要求修复唯一确认问题，结果见“修复与验证”；未提交、推送或部署。

## Standards：仓库规范与实现质量

纠错后没有确认的规范阻塞项。Claude 保留了两项非阻塞设计建议，均不作为缺陷或修复门禁：

1. 评估 Newsletter 投递尝试字段的组织方式。位置：`src/lib/newsletter-delivery-execution.ts:69`。字段集中初始化本身不是错误，当前平坦结构符合数据库模型。
2. 评估 `mutateTaxonomy` 是否需要在命名中提示提交后的缓存失效。位置：`src/lib/taxonomy-mutations.ts:9`、`:47`。函数注释已说明该职责，没有已证实的行为问题。

### 已撤回的首轮问题

| 首轮声称 | 源码核验 | 处理 |
| --- | --- | --- |
| P1：日志维护 cron 未登记内部密钥 | `middleware.ts:120` 已按精确路径登记 `/api/cron/log-retention`，使用 `CRON_SECRET` | Claude 复核撤回 |
| 健康接口必须在内部密钥表豁免 | `middleware.ts:209`、`:272` 的范围是 admin、cron 和 internal；健康接口不属于上述内部前缀 | Claude 复核撤回 |
| P2：探针响应超时就清空未结束查询标记，导致连接积累 | `src/lib/web-readiness.ts:13` 在底层 probe 实际结束时清除标记；`:17` 只清除计时器。`:8` 阻止追加探针 | Claude 复核撤回 |
| 独立事务辅助函数必须改成类、决定映射重复等 | 缺乏重复代码或违反仓库约定的证据 | 不计入缺陷 |

补充事实纠正：Claude 的更正报告仍提到了并不存在的 `NewsletterDeliveryStatus` Prisma enum。实际 `prisma/schema.prisma:271` 是 `String`；只有活动状态存在 `NewsletterCampaignStatus` enum。该句不作为任何结论的依据，也不因字段使用字符串而自动认定为缺陷。

## Spec：P2 方案一致性

依据 [P2 修复方案](../implementation/2026-09-26-remaining-p2-remediation-plan.md)，确认 1 项 P2。原方案报告的 17 项候选中，16 项经反证后被 Claude 撤回，第 6 项收窄后保留。不将原始报告中的计数当作已确认缺陷数。

### P2：AI 缓存刷新失败缺少任务关联（已修复）

- 审查时位置：`src/lib/ai-post-actions.ts:516-529`、`:568`、`:597`；调用方 `src/lib/ai-batch-jobs.ts:252-255`。
- 触发：AI 内容已成功提交，随后公共缓存失效失败或部分失败。
- 证据：新引入的 `revalidatePostAiChange` 不接收任务上下文。常规失败分支仅记录 `report.errors`；该数组有路径与错误，但没有 `taskId`。异常分支仅记录异常。批处理调用方又丢弃 `completePostAiTaskItem` 返回的 cache 报告，没有在外层补上任务关联。人工应用也复用同一无任务上下文的辅助函数。
- 影响：缓存失败记录不能直接对应到某个 AI 任务，按任务定位并调用维护重刷入口需要额外人工排查。文章与任务的原子提交没有因此失效，不能把这类缓存错误改成业务失败。
- 规格：方案 P2-02 的缓存条款（第 88 行）明确要求可捕获的失败单独记录 `taskId`、受影响路径和错误。
- 修复方向：将任务标识传入缓存处理或在调用方消费报告，结构化记录任务、文章、路径及错误；保留提交后刷新和业务成功语义，避免重复打印。补充故障注入用例，断言日志可关联任务且成功终态不被修改。
- 限定：`post-summary-jobs.ts:333-335` 已记录 `taskId`、`postId`、路径与错误；其 `jobId` 在存在任务时就是 `task.id`（`:138`）。旧摘要路径不属于该缺陷。管理员 cache-only 重刷路由已存在且有鉴权。

### 修复与验证

- `revalidatePostAiChange` 统一接收自动完成和人工应用传入的 `taskId`、`itemId`，补充 `postId`，结构化记录受影响路径及错误。异常分支保留预先计算的路径和原始异常，避免日志缺少恢复线索。
- 刷新仍发生在事务提交后；缓存失败不改写成功终态。批处理不重复打印，重复调用不重写文章、重复通知或再次刷新缓存。旧摘要逻辑未修改。
- `ai-post-completion.test.ts` 新增 4 项故障回归，覆盖自动/人工应用的部分失败与异常，以及成功终态、通知数量和重复调用行为。修复前 4 项均因缺失日志上下文失败；修复后通过。
- 本次定向 Vitest：`ai-post-completion`、`ai-post-actions`、`ai-batch-jobs`、`ai-task-cache-recovery`、`ai-tasks`、`cache` 共 6 个文件、34 项通过。`pnpm exec tsc --noEmit` 通过；改动的 4 个 TypeScript 文件定向 ESLint 通过，0 错误、0 warning。
- 缓存 mock 改为保留真实路径构造函数，包含 `tests/integration/ai-task-atomicity.test.ts` 的兼容更新。本次未重新运行 PostgreSQL、全量测试、构建或 E2E；既有验证记录不计为本次重跑。

### 方案候选的逐项处置

| 原编号 | 处置与依据 |
| --- | --- |
| 1 | 撤回。部署预检在 `deploy-remote.sh:65`，早于迁移调用 `:77` 和服务启动 `:79`。 |
| 2 | 撤回。`web-readiness.ts:8-13` 将每进程遗留查询限制为一个；方案未要求特定取消 API。 |
| 3 | 撤回。两个健康路由直接导出 handler，不经过审计包装器；middleware matcher 也不包含健康路径。 |
| 4 | 撤回。`deploy-remote.sh:150` 的 inspect 只读取状态字段；诊断输出为固定白名单文本。没有泄露 Config 的代码证据。 |
| 5 | 撤回。`ai-post-actions.ts:538-550` 锁定任务、任务项和文章，并在锁内复核归属、动作与快照。 |
| 6 | 部分保留。仅保留上述 AI 内容缓存日志关联缺口；撤回对旧摘要日志的错误指控。 |
| 7 | 撤回。`src/app/api/admin/ai/tasks/[id]/revalidate/route.ts` 存在，具备管理员鉴权、语义错误和操作日志包装。 |
| 8 | 撤回。`newsletter-delivery-execution.ts:178` 将 evidenceKind 写入同事务的核对记录；方案不要求再冗余写入 delivery。 |
| 9 | 撤回。冻结使用事务内 INSERT SELECT；`:63-65` 在每次投递尝试前再次检查订阅资格。 |
| 10 | 撤回。人工确认旧发送者停止是方案明确接受的运维前置条件；本项明确不引入租约和跨实例抢占。 |
| 11 | 撤回。核对时 `:176` 保留已有 sentAt，没有写入 new Date；核对时间由审计 createdAt 单独记录。 |
| 12 | 撤回。`:143-152` 在事务前拒绝空或非字符串 attemptId，`:173` 还要求真实尝试时间。 |
| 13 | 撤回。`comments.ts:21` 在同一事务内先锁定父评论，再校验和插入；后续 findFirst 无需重复加锁。 |
| 14 | 撤回。摘要 posts 与批次 tasks 是可选的不同快照字段；`AiTaskActivitySync.tsx:52-53` 分别轮询两个接口。 |
| 15 | 撤回。`:21` 的签名直接包含任务 status，不仅依赖 version 时间戳。 |
| 16 | 撤回。`middleware.ts:120` 精确登记路径，cron handler 第 9 行再次调用 requireInternalSecret，已双重校验。 |
| 17 | 撤回。`taxonomy-mutations.ts:41` 明确加入受影响 guide 路径，再调用共享失效函数。方案不要求所有路径组装都写在 cache.ts。 |

原报告中关于测试、历史审计脚本及 E2E 物理清理不存在的说法也已更正：`scripts/deploy/deploy-remote.test.cjs`、`scripts/audit-p2-history.cjs`、`e2e/post-fixtures.ts` 均存在。未提供给某次审查输入，不等于仓库中不存在。

## 验证边界与证据

- 既有测试结果见 [P2 执行记录](../implementation/2026-09-26-p2-execution.md)，不作为本次 Claude 重跑测试的证据。
- Docker 镜像构建及镜像内故障冒烟仍是已记录的发布前门禁；本轮静态审查不能关闭该项。
- 审查报告首次归档前核对 136 个快照文件的 SHA256，均未变化；该阶段仅增加本记录并更新文档索引。之后的代码和测试改动限定为上述日志关联修复及其回归覆盖。
- 提示词、差异、文件清单、SHA256 清单、原始 JSONL、会话中止说明及两轴更正报告保存在本机目录 `C:/Users/Administrator/AppData/Local/Temp/inkforge-claude-review-1790420939434`。原始报告包含已撤回声称，应以本记录中的处置为准。
