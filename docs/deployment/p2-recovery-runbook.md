# P2 发布与恢复手册

适用：2026-09-26 修复。验证结果见 [执行记录](../implementation/2026-09-26-p2-execution.md)。本文不代表已经在生产执行。

## 发布门禁

1. 生产 Deploy 工作流启用迁移前备份。候选镜像配置预检通过后，用与服务端 PostgreSQL 主版本相同的客户端导出 custom-format 备份并验证归档目录；备份写入 shared/backups（目录 700、文件 600），同时为旧镜像保留独立 tag。只有备份验证通过才停止旧应用及其进程内 Newsletter 发送者，然后迁移和启动新版本。备份失败不停止旧应用，临时连接信息自动清理。
2. 在可用 Docker 环境构建候选镜像，执行 `docker compose -f docker-compose.prod.yml config --quiet`。候选镜像的 `node scripts/check-web-readiness.cjs` 通过后，再执行 `pnpm prisma migrate deploy`。远程部署脚本已固定此顺序。
3. 应用 `20260926101000_newsletter_durable_recovery`。新增受众冻结时间、投递尝试/证据字段和核对审计表，不回填虚构的历史受众、尝试或接受时间。
4. 替换服务后只接受 `running healthy`。最多观察 12 次，间隔 5 秒。缺失、退出、unhealthy、状态不可读或持续 starting 均非零退出。
5. Deploy 在上传 release 前执行 scripts/deploy/smoke-web-health.sh：使用生产 Compose 健康检查和专用 PostgreSQL 容器，先确认 healthy，再停止专用数据库并断言 live=200、ready=503、Docker unhealthy，恢复后重新确认 ready=200、healthy。检查失败不会触及生产服务器；是否已通过以对应 Deploy 运行结果为准。

自动备份针对已有运行中的生产实例；首次部署没有旧容器时需先完成独立数据库备份，再按手动部署流程执行。备份不是自动回滚：迁移开始后失败，不自动恢复旧代码或数据库。共享 .env 与备份均不得上传为工作流产物。

健康接口不鉴权、不缓存、不写操作审计。ready 仅检查 Web 必需配置及共享 Prisma 的 `SELECT 1`，不代表 Worker 或供应商可用。数据库读预算 2 秒；底层探针未结束时，后续请求快速返回 503，不积累查询。Docker 探针间隔 10 秒、超时 3 秒、启动宽限 20 秒、连续 3 次失败判为不健康。

失败诊断只输出固定状态及白名单故障信号。输入限近 5 分钟、60 条、16 KiB，输出最多 20 个信号。读取限 5 秒，终止再留 1 秒；不输出原始日志、未知文本或秘密值。

没有自动回滚。切回旧镜像前确认数据库兼容，并停止新旧发送执行器。新增字段可以保留，但旧代码不理解新的 unknown/attempt 核对语义，不得用旧版本自动重试新状态活动。切回镜像不等于撤销数据库迁移。

## Newsletter 发送与恢复

首次发送将全部已验证、未退订收件人与 SENDING 一起提交，冻结完整受众。继续发送只处理快照内 pending，重试只处理明确 failed；后注册者不加入旧活动。每次尝试先检查当前订阅资格、持久化 attempt ID/开始时间，再调用上游。资格失效记为 skipped。

sent 表示适配器明确接受，不保证送达收件箱。log 为模拟接受，没有发送真实邮件；noop 不接受。超时、断连等不确定结果记为 unknown。上游接受后数据库写入失败保留 sending，不能作为明确失败重发。

1. 在运行环境停止旧发送进程，确认不会继续写入。页面确认框不会终止远端进程，也不构成租约。
2. 对 SENDING 活动点击“恢复状态”，或用管理员会话调用 `POST /api/admin/newsletter/campaigns/{id}/recover`，JSON 请求体包含 `senderStopped: true`。sending 转为 unknown，pending 保留。
3. 打开“收件记录”。继续待发送仅发 pending，重试失败仅发 failed，两者均不自动重发 unknown。
4. 核对接口为 `POST /api/admin/newsletter/campaigns/{id}/deliveries/{deliveryId}/reconcile`。提供当前 attemptId、reason、senderStopped:true 及下表字段。

| decision | 证据要求 | 结果 |
| --- | --- | --- |
| accepted | evidenceKind 为 provider_acceptance；evidenceReference 指向本次尝试的明确上游接受凭据 | sent；无接受时间证据时 sentAt 仍为空 |
| not_accepted | evidenceKind 为 provider_rejection；evidenceReference 指向明确未接受凭据 | failed，可显式重试 |
| abandon | 明确放弃原因，不填写上游证据字段 | skipped，不再发送 |

本地日志、Message-ID、超时和查无记录不证明是否接受。log/noop 不提供真实供应商回执查询。证据不足则保留未知，不能为解除状态而虚构凭据。

决定、attempt、原因、证据及操作人写入持久审计。相同请求重放返回原审计；改变决定/原因/证据，或 attempt 已变化，返回 409。audit.createdAt 是核对时间，不是接受时间。首次核对及重放均返回完整计数。

历史活动缺受众冻结信息、attempt ID 或开始时间时，在线恢复拒绝补猜。DRAFT 已有旧投递记录也不能按当前名单重建。先只读审计，再按 ID 人工处置。

## 日志保留维护

普通 API 只插入当前日志；调整设置不再同步清理。两个入口共用 runner：

- 管理员：`POST /api/admin/logs/retention`。
- 调度器：`POST /api/cron/log-retention`，请求头为 `Authorization: Bearer <CRON_SECRET>`，不接受其他内部密钥代替。

`.github/workflows/log-retention.yml` 每 15 分钟运行，也支持手动触发。GitHub production environment 需配置 PRODUCTION_BASE_URL 与服务端一致的 CRON_SECRET。本地工作流改动尚未发布。

每轮持有事务 advisory lock，沿用累计 pg_column_size 口径，从最旧超限记录最多删除 1000 条。返回 before/after、deletedCount、remainingExcessBytes、耗时及状态：

| status | 处理 |
| --- | --- |
| completed | 本轮结束时达到容量目标 |
| more_remaining | 仍超限；下一轮继续或手动再执行一批 |
| skipped_locked | 另一维护事务正在运行，稍后再试 |

统计是事务内观测值；后续请求及维护接口自身审计仍可增加容量。不增加无限循环，不在普通请求中等待清理。

## 提交后的缓存恢复

业务提交后，缓存失败不回退业务，不再次调用模型或重复变更。

- AI：管理员 `POST /api/admin/ai/tasks/{id}/revalidate`，从已应用项、输入快照和当前文章恢复旧/新路径。完整返回 200；不完整返回 207。检查 data.complete、data.errors 及 data.missingEvidence，不能把所有 2xx 视为完全恢复。不会修改文章、任务或通知。
- 分类/标签：变更结果的 cache.paths 为路径集合，cache.failedPaths 为失败部分。管理员向 `POST /api/admin/taxonomy/revalidate` 提交 paths 数组。仅接受公共目录及合法详情路径，每批 1–500 项；失败返回 503 并列出失败路径。

进程可能在提交后、刷新前退出，因此允许重复调用维护入口。历史 AI 快照不全时保留缺失提示，不推断不存在的旧路径。

## 历史审计与人工修复

脚本不加载 .env。先明确设置 DATABASE_URL，最好使用只读账户，再执行：

```bash
AUDIT_LIMIT=1000 node scripts/audit-p2-history.cjs > p2-history.json
```

不要提交连接串或审计产物。脚本使用 REPEATABLE READ READ ONLY 和 15 秒 SQL 超时，报告总数及有界样本。truncated:true 表示未列完；AUDIT_LIMIT 范围为 1–10000。

| 类别 | 修复边界 |
| --- | --- |
| 跨文章父评论 | 按 ID 核对，决定拆除 parent 关系或隐藏回复；验证两篇文章并刷新缓存 |
| 非法 slug | proposedSlug 仅为建议；先查冲突及外链，不批量覆盖合法占用者 |
| 成功但未应用 AI 输出 | 区分建议、自动应用缺口及意图不明；缺证据不自动应用旧输出，核对正文后重新生成 |
| Newsletter 历史缺证据 | 不用当前名单补造旧受众，不将未知当失败；按真实凭据核对或明确放弃 |

人工修复限定 ID，保存前后值及依据，使用事务并记录操作人，完成后重新审计。迁移不执行这些修复。生产审计及人工修复均未在本轮执行。
