# P2 发布与恢复手册

适用：2026-09-26 修复及 2026-11-22 部署流水线加固（Unit B3）。验证结果见 [执行记录](../implementation/2026-09-26-p2-execution.md)。本文提供标准生产发布与故障恢复规程。

## 发布门禁与软链时序

1. **检出提交与目录一致性（`RESOLVED_SHA`）及 Shell 安全传参**：`deploy.yml` 在 `actions/checkout`（支持 `inputs.ref` 任意分支、Tag 或历史 SHA）后立即执行 `RESOLVED_SHA=$(git rev-parse HEAD)`，所有远端目录 `releases/${RESOLVED_SHA}`、`RELEASE_SHA` 与部署摘要统一使用真实检出提交；`inputs.ref`、`DEPLOY_HOST`、`DEPLOY_PORT`、`DEPLOY_USER`、`DEPLOY_PATH` 均经 step `env:` 注入并校验/转义，严禁在 Bash 源码字符串中直接内插 `${{ ... }}`。
2. **每版本 `0600` `.env` 快照隔离、`$` 字面安全序列化与历史提交回滚兜底**：
   - 流水线写入 `app.env` 追加 `AI_NEWS_CRON_SECRET` / `CRON_SECRET` 前强制补齐末尾换行，并对无单引号密钥使用单引号字面量序列化（`KEY='...'`），确保 `dotenv.parse`、`read-dotenv.cjs` 与 Docker Compose `env_file` 对含 `$` 字符的密钥均保持 100% 字面一致、不触发变量展开。
   - `app.env`（权限 `0600`）直接上传至候选版本目录 `${DEPLOY_PATH}/releases/${RESOLVED_SHA}/.env`，**不在健康检查前覆盖 `${DEPLOY_PATH}/shared/.env`**，避免新版本部署失败污染上一健康版本的环境文件。
   - 构建阶段优先调用 `scripts/deploy/read-dotenv.cjs`；若 `inputs.ref` 回滚至 `#60` 之前的历史提交（缺少 `read-dotenv.cjs`），自动回退至内联 `node -e` NUL 分隔 `dotenv.parse` 读取，禁止执行 `source app.env` 或 `source .env`。远端宿主机需预装 `node`（Node.js 20+），SSH 连接使用预置 `DEPLOY_KNOWN_HOSTS` 严格校验主机指纹。
3. **迁移前目标库备份（含跨库切换双备份）与停旧容器边界**：候选镜像（Next.js `output: "standalone"` + 非特权 `USER node`）通过 `node scripts/check-web-readiness.cjs`（生产环境强制非回环 `NEXTAUTH_URL` / `NEXT_PUBLIC_SITE_URL` 使用 `https://`）预检后，执行 `scripts/deploy/backup-production.sh`：
   - **存在运行中旧容器**：同时核对旧容器运行环境与候选版本 `.env` 的目标 `DATABASE_URL`。若指向同一数据库，导出 `shared/backups/pre-${RELEASE_SHA}-${stamp}.dump`；若候选版本切换到了新的目标 `DATABASE_URL`，在停容器与执行迁移前**同时预检、导出并通过 `pg_restore --list` 校验运行库（`pre-running-${RELEASE_SHA}-${stamp}.dump`）与候选目标库（`pre-${RELEASE_SHA}-${stamp}.dump`）两份备份**，为旧镜像打上 `my-next-app:pre-${RELEASE_SHA}-${stamp}` 标签，**随后主动执行 `docker stop --time 30` 停止旧容器及其进程内 Newsletter 发送者**。任一备份失败均不会停止旧容器，临时凭据自动清理。
   - **首次部署或前次部署中断导致旧容器已停止**：优先从当前候选版本 `.env`（回退 `shared/.env`）安全解析目标 `DATABASE_URL` 完成数据库版本预检、`pg_dump` 与 `pg_restore --list` 校验（若 `shared/.env` 存在且指向不同数据库，同样一并备份）；若存在已停止的旧 `app` 容器，同样为其镜像保留 `my-next-app:pre-${RELEASE_SHA}-${stamp}` 标签。
4. **严格迁移门禁（无 `db push` 兜底）**：`deploy-remote.sh` 要求 `prisma/migrations/*/` 非空并执行 `pnpm prisma migrate deploy`；若缺失迁移目录则直接打印 `Missing Prisma migrations in prisma/migrations` 并以非零状态退出，严禁回退执行 `prisma db push`。
5. **健康通过后更新 `shared/.env`、`last-healthy-release` 与 `current` 软链**：远端激活直接在 `${DEPLOY_PATH}/releases/${RESOLVED_SHA}` 目录内执行 `deploy-remote.sh`。替换服务后最多观察 12 次（间隔 5 秒），仅在容器达到 `running healthy`（Docker 健康探针请求 `http://127.0.0.1:3000/api/health/ready` 返回 `200`）后才依次更新 `${DEPLOY_PATH}/shared/.env`（`install -m 600`，若旧 `current/.env` 为历史遗留软链则先物化独立快照）、写入 `${DEPLOY_PATH}/shared/last-healthy-release`（记录 `RELEASE_SHA`、`IMAGE_ID`、`LAST_BACKUP_DIR`）并将 `${DEPLOY_PATH}/current` 原子切换至新版本目录。若迁移或健康检查失败，上一版本的 `.env`、`shared/.env`、`shared/last-healthy-release` 与 `current` 软链均保持原状。
6. **上传前断库冒烟与产物保留策略**：
   - 上传 release 前，`scripts/deploy/smoke-web-health.sh` 在隔离 PostgreSQL 容器上验证 `live=200 -> ready=200 (healthy) -> 停库 live=200 & ready=503 (unhealthy) -> 恢复 ready=200 (healthy)`。
   - 部署健康通过后自动执行保留清理（`scripts/deploy/prune-artifacts.cjs`）：仅保留最近 **5** 个 `releases/*` 目录（绝不删除当前 `current` 指向目录与当前运行版本）、最近 **5** 个 `shared/backups/*.dump` 备份文件及最近 **5** 个 `my-next-app:pre-*` 镜像标签；容器启用 `init: true` 与 `json-file` 日志轮转（`10m x 5`）。

健康接口不鉴权、不缓存、不写操作审计。`ready` 仅检查 Web 必需配置及共享 Prisma 的 `SELECT 1`（读预算 2 秒；Docker 探针间隔 10 秒、超时 3 秒、启动宽限 20 秒、连续 3 次失败判为 `unhealthy`）。失败诊断仅输出固定状态与最多 20 条白名单故障信号，不输出原始日志或敏感配置值。

## 迁移或健康探针失败后的停服恢复流程

由于 `backup-production.sh` 在备份校验通过后已主动停止旧容器，一旦后续 `prisma migrate deploy` 失败或新容器健康检查未通过（如 `running unhealthy`），**线上处于已停服状态且不会自动回滚**（但 `${DEPLOY_PATH}/current` 仍指向停服前的上一个健康 release 目录）。请按以下三步人工闭环恢复：

### 第一步：停止异常新容器并核对数据库 Schema 兼容性

1. 若新容器已拉起但处于 `unhealthy` / `restarting`，先停止该容器以确保无残余进程内发送者写入：
   ```bash
   cd "${DEPLOY_PATH}/releases/${FAILED_RELEASE_SHA}"
   docker compose -f docker-compose.prod.yml stop app
   ```
2. 检查 `_prisma_migrations` 最近记录，确认当前数据库 Schema 是否与上一版代码（`${DEPLOY_PATH}/current`）兼容：
   ```sql
   SELECT migration_name, started_at, finished_at, rolled_back_at
   FROM "_prisma_migrations"
   ORDER BY started_at DESC
   LIMIT 5;
   ```
   - **情形 A（迁移未改动结构或仅含向后兼容的新增表/可空列）**：上一版镜像可直接兼容当前数据库，无需导入 `.dump` 覆盖线上数据（避免抹掉近期评论、审计日志或 Newsletter 投递核对记录）。若某条迁移在未提交破坏性 DDL 前失败卡住，按 Prisma 规程核实后标记 `pnpm prisma migrate resolve --rolled-back <migration_name>`。
   - **情形 B（迁移已产生不兼容结构变更且确需回退库）**：先将 `shared/backups/pre-${FAILED_RELEASE_SHA}-<ts>.dump` 导入独立临时库核验完整性与业务影响，确认无误后再执行恢复。切回旧镜像本身不会撤销已提交的数据库迁移。
   - 注意：旧版本代码不理解新版本新增的 `unknown` / `attempt` 核对语义时，恢复后不得用旧版本自动重试处于新状态的活动。

### 第二步：核对 `shared/last-healthy-release` 并重打保留的 `my-next-app:pre-*` 镜像标签

先查看最近一次健康发布的记录（`RELEASE_SHA`、`IMAGE_ID`、`LAST_BACKUP_DIR`），并从最近保留的 5 个迁移前镜像标签中选取本次部署前保留的镜像校验其完整 `sha256` 摘要：

```bash
cat "${DEPLOY_PATH}/shared/last-healthy-release"
PREV_TAG=$(docker image ls --format '{{.Repository}}:{{.Tag}}' 'my-next-app:pre-*' | head -n 1)
echo "Recovering with image tag: ${PREV_TAG}"
PREV_IMAGE_ID=$(docker image inspect "${PREV_TAG}" --format '{{.Id}}')
echo "Verified image ID: ${PREV_IMAGE_ID}"
docker tag "${PREV_TAG}" my-next-app:latest
```

### 第三步：在上一健康版本目录重跑 `deploy-remote.sh` 并验证 `/api/health/ready`

因失败部署未切换 `current` 软链，直接进入 `${DEPLOY_PATH}/current`（若需指定特定历史版本可进入 `${DEPLOY_PATH}/releases/<prev_sha>` 并传入 `RELEASE_DIR`），跳过重复备份并锁定 `PREBUILT_IMAGE_ID` 拉起服务：

```bash
cd "${DEPLOY_PATH}/current"
BACKUP_BEFORE_DEPLOY=0 \
  DEPLOY_PATH="${DEPLOY_PATH}" \
  PREBUILT_IMAGE_ID="${PREV_IMAGE_ID}" \
  bash scripts/deploy/deploy-remote.sh

curl -fsS http://127.0.0.1:3000/api/health/ready
```

**恢复验收条件**：`deploy-remote.sh` 输出 `Deployment succeeded: app is healthy`（Docker 容器状态为 `running healthy`），且 `http://127.0.0.1:3000/api/health/ready` 返回 HTTP `200`（`{"status":"ready",...}`）。

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

`.github/workflows/log-retention.yml` 每 15 分钟运行，也支持手动触发。GitHub production environment 需配置 PRODUCTION_BASE_URL 与服务端一致的 CRON_SECRET。

> 2026-10-13 已配置并验证：GitHub production environment 设 `CRON_SECRET`（32 字节强随机）与 `PRODUCTION_BASE_URL`；`deploy.yml` 在写 `app.env` 时与 `AI_NEWS_CRON_SECRET` 一样 append `CRON_SECRET`（不再要求手改 `APP_ENV_FILE`）；本地 `.env` 同步同值。实测：错密钥 → 401，正确密钥 → 200 且正常删批。此前服务端缺配时该接口 fail-closed 503，workflow 每轮在 guard 处 `exit 1`。

每轮在交互式事务内持有事务 advisory lock，沿用累计 pg_column_size 口径从最旧超限记录最多删除 1000 条 `api_operation_logs`；事务提交后在事务外分批清理过期 `rate_limit_entries`（每批 `LIMIT 5000`，单轮最多 20 批），避免 `rate_limit_entries` 积压触发 30 秒交互式事务超时并连带回滚日志保留结果。`.github/workflows/log-retention.yml`（及 `publish-scheduled.yml`）显式校验 HTTP `200` 与 JSON `payload.success === true`，防止域名 `301`/`302` 重定向静默变绿。返回 before/after、deletedCount、expiredRateLimitDeletedCount、remainingExcessBytes、耗时及状态：

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
