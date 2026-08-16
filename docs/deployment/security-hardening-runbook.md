# 安全硬化运维操作清单（阶段一收尾）

> 日期：2026-08-15 · 前置：本次代码变更（P0-3 / P0-4 仓库侧 / P0-5 仓库侧）已合并
> 本清单中的操作必须在服务器与 GitHub 上人工执行，仓库内无法完成。

## 1. 密钥轮换（P0-5，最高优先级）

现状（2026-08-15 晚实测复核，不含密钥明文）：
- ✅ `AI_NEWS_CRON_SECRET` 已轮换为 32 位强随机（原可猜测固定值已废弃）；
- ⚠️ `NEXTAUTH_SECRET` **仍是占位符**（"replace-with-…"，33 字符），必须轮换；轮换会使现有会话全部失效；
- ⚠️ 以下 6 个新密钥**尚未配置**：`OPERATION_LOG_INGEST_SECRET`（未配置时生产跳过被拒日志回写）、`ANONYMOUS_ACTOR_SECRET`、`NEWSLETTER_TOKEN_SECRET`、`AI_MODEL_SECRET_KEY`、`PUBLISH_SCHEDULED_CRON_SECRET`、`CRON_SECRET`；
- ⚠️ 本地/服务器 `.env` 仍含真实生产凭据（DB/GitHub/七牛/DashScope），泄露面不变。

执行步骤：

```bash
# 在服务器生成强随机密钥（示例：32 字节）
openssl rand -hex 32
```

1. **生成并更新**以下密钥（每项独立随机值，绝不互相复用）：
   - `NEXTAUTH_SECRET`（替换占位符；**注意：轮换会令现有会话全部失效**）
   - `OPERATION_LOG_INGEST_SECRET`（新引入；未配置时生产环境跳过被拒日志回写，并有一次性告警）
   - `ANONYMOUS_ACTOR_SECRET`
   - `NEWSLETTER_TOKEN_SECRET`
   - `PUBLISH_SCHEDULED_CRON_SECRET` / `CRON_SECRET`（定时发布接口；缺省回退到 `AI_NEWS_CRON_SECRET`）
   - `AI_MODEL_SECRET_KEY`（新引入；轮换前若已有 `enc:v1:` 加密的模型 API key，需先按 `ai-models-crypto.ts` 注释迁移）
2. **同步到三处**：服务器 `shared/.env`（部署时写入）、GitHub Secrets（`AI_NEWS_CRON_SECRET` 等）、本地 `.env`。
3. **轮换第三方凭据**（GitHub OAuth、七牛 AK/SK、DashScope API Key），旧的作废。
4. 验证：`pnpm ai-news:check` 通过；管理员后台 AI 模型测试连通正常。

## 2. 全站启用 HTTPS（P0-4 的运维部分）

现状（2026-08-15 核验）：
- `NEXTAUTH_URL` / `NEXT_PUBLIC_SITE_URL` 为 http；
- 图片主机 `project.roydust.top` 不提供 https（SSL 握手失败），http 可达；
- 因此仓库侧暂缓了 CSP `upgrade-insecure-requests` 与 `img-src` 收紧（见 `security-headers.ts` 注释）。

执行步骤：
1. 为 `roydust.top` 与 `project.roydust.top` 申请证书（Let's Encrypt / certbot），在 nginx/caddy 上终结 TLS；http → https 301 跳转。
2. 更新 `shared/.env`：`NEXTAUTH_URL=https://...`、`NEXT_PUBLIC_SITE_URL=https://...`、`SITE_URL=https://...`。会话 cookie 自动带 `Secure`（`auth-cookies.ts`）。
3. HSTS 已随本次代码在生产环境自动下发（浏览器此前只见过 http 时不会预加载，无风险）。
4. TLS 稳定运行后，回仓库完成剩余两项：
   - `security-headers.ts`：CSP 增加 `upgrade-insecure-requests`、`img-src` 收紧为 `'self' https: data: blob:`，并更新 `security-headers.test.ts` 中对应用例；
   - `next.config.ts`：`remotePatterns` 删除 http 条目。

## 3. P0-2 迁移状态与软删重建验证

- 迁移 `202608150001_soft_delete_partial_unique_indexes` **已于 2026-08-15 经用户授权直接应用到生产**（`prisma migrate deploy`，与 deploy-remote.sh 使用同一命令），并完成数据库级验证：8 个 `*_active_unique` 部分唯一索引在位、8 个旧全局唯一索引移除、真实库 P2002 探针（事务回滚）确认约束生效。
- 后续部署时 `migrate deploy` 幂等重放，已应用项自动跳过，无需额外操作。
- 功能验证（后台手动）：软删一篇文章后用原 slug 重建；软删分类/标签后用原名重建；两个 active 同名仍被拒且提示友好文案。

## 4. cron / internal 防护验证（P0-3 收尾）

本次代码变更后，`/api/cron/*` 与 `/api/internal/*` 由 middleware 密钥网关 + handler 自检双重防护。上线后按以下清单验证：

- [ ] `curl -i https://<站点>/api/cron/ai-news`（无 Authorization）→ 401 `{ "error": "Unauthorized" }`
- [ ] `curl -i -H "Authorization: Bearer <正确密钥>" https://<站点>/api/cron/ai-news?date=<今天>` → 202（每日工作流用同一密钥冒烟）
- [ ] 连续 10 次错误密钥 → 第 11 次返回 429（失败限流生效）
- [ ] 服务器日志无 `[security] OPERATION_LOG_INGEST_SECRET is not configured` 警告（若出现：`shared/.env` 补配后重启）
- [ ] 被拒的 cron 尝试出现在后台「操作日志」（operation=`middleware.cronApiDenied`）
- [ ] `daily-ai-news.yml` 与 `publish-scheduled.yml` 各执行一次 `workflow_dispatch` 冒烟通过

## 5. 验证清单

- [ ] 上述密钥全部轮换且三处同步
- [ ] 站点 https 可访问，http 301 跳转，浏览器显示安全锁
- [ ] 响应头含 `Strict-Transport-Security`
- [ ] 管理员登录/会话在轮换 NEXTAUTH_SECRET 后重新登录正常
- [ ] 被拒的管理端请求仍能在操作日志中查到（需已配置 `OPERATION_LOG_INGEST_SECRET`）
- [ ] 软删除重建验证（见第 3 节）
- [ ] cron/internal 防护验证（见第 4 节）

## 6. 生产库操作纪律（2026-08-15 复盘新增）

背景：P0-2 迁移于 2026-08-15 绕过部署管线、由本地会话直连生产库执行 `migrate deploy` 与验证查询（结果正确、用户明确授权）。为让该做法可审计、可复用，约定如下：

1. **写操作（migrate/数据变更）**：优先走部署管线（deploy-remote.sh 的 `migrate deploy` 步骤）。确需直连执行时，必须：① 获得用户/负责人明确授权并在操作记录中留痕（时间、命令、原因、验证方式）；② 仅使用 `migrate deploy`（禁止 `migrate dev`——会直连生产做 shadow DB 与漂移检测，可能生成破坏部分唯一索引的漂移迁移）；③ 完成后立即用只读查询验证并记录证据。
2. **验证探针**：任何"验证性写入"必须包在事务内并在成功路径强制抛错回滚（参考 2026-08-15 P2002 探针模式），严禁依赖"失败不落数据"的假设而不加事务保护。
3. **只读检查**：pg_indexes / 行数 / migrate status 等只读查询可直接执行，但不得在日志中输出连接串与凭据。
4. **本地 .env 指向生产**：这是开发便利与风险的折中；任何数据库相关命令（seed 脚本、prisma 命令）执行前必须确认 `DATABASE_URL` 目标，防止 seed 误入生产。
