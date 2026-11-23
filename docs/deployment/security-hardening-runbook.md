# 安全硬化运维操作清单（阶段一收尾）

> 日期：2026-08-15 · 前置：本次代码变更（P0-3 / P0-4 仓库侧 / P0-5 仓库侧）已合并
> 本清单中的操作必须在服务器与 GitHub 上人工执行，仓库内无法完成。

## 1. 密钥轮换（P0-5，最高优先级）

现状（2026-08-15 晚实测复核，不含密钥明文）：
- ✅ `AI_NEWS_CRON_SECRET` 已轮换为 32 位强随机（原可猜测固定值已废弃）；
- ✅ `NEXTAUTH_SECRET`：生产实测 `/api/health/ready` → `configuration: passed`（该检查要求 `AUTH_SECRET` 与 `NEXTAUTH_SECRET` 均非空且非占位符），即服务器已非占位符；本地 `.env` 的占位符已于 2026-10-13 改为与 `AUTH_SECRET` 同值；
- ✅ `CRON_SECRET` 已于 2026-10-13 配置为 32 字节强随机（GitHub production environment + 服务器 `shared/.env`，由 `deploy.yml` append 注入，见 `p2-recovery-runbook.md` 日志保留维护）；
- ⚠️ 以下 5 个新密钥**尚未配置**：`OPERATION_LOG_INGEST_SECRET`（未配置时生产跳过被拒日志回写）、`ANONYMOUS_ACTOR_SECRET`、`NEWSLETTER_TOKEN_SECRET`、`AI_MODEL_SECRET_KEY`、`PUBLISH_SCHEDULED_CRON_SECRET`；
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

现状（2026-11-23 线上实测更新）：
- ✅ 主站与应用已迁至腾讯云 `159.75.167.23`，由宿主机 Caddy 自动签发 Let's Encrypt TLS 证书并终结 HTTPS（支持 HTTP/3 `h3=":443"`、`gzip` 压缩、`Strict-Transport-Security: max-age=31536000; includeSubDomains`；`http://roydust.top` 与 `https://roydust.top` 均重定向至 `https://www.roydust.top`）；
- ✅ 生产环境 `NEXTAUTH_URL`、`NEXT_PUBLIC_SITE_URL`、`PRODUCTION_BASE_URL` 及数据库 `system_settings`（`blog.site.siteUrl`）均已切换为 `https://www.roydust.top`，会话 Cookie 自动启用 `Secure` 前缀，3 个 GitHub Actions 定时任务全部经 HTTPS 正常运行；
- ✅ 迁移过渡期的 `ALLOW_INSECURE_HTTP_SITE_URL` 豁免开关已从代码与 GitHub `production` 环境变量中彻底移除，生产门禁强制要求非回环 `https://` 地址；
- ⚠️ 七牛云自定义图片域名 `project.roydust.top` 尚未在七牛云控制台绑定匹配的 SSL 证书（当前生产库仍有 263 篇文章与 201 条封面资源引用 `http://project.roydust.top`），因此仓库侧仍需保留 CSP `img-src 'self' http: https: data: blob:` 且暂不开启 `upgrade-insecure-requests`，避免浏览器强制升级 HTTPS 后因证书不匹配裂图。

剩余收尾步骤（待七牛云 `project.roydust.top` 绑定 SSL 证书后执行）：
1. 在七牛云 CDN / 对象存储控制台为 `project.roydust.top` 申请并绑定免费 SSL 证书，验证 `curl -I https://project.roydust.top` 握手正常；
2. 将生产环境 `QINIU_DOMAIN` 更新为 `https://project.roydust.top`，并将数据库 `posts`（`coverImage` / `content`）与 `cover_assets`（`url`）中的 `http://project.roydust.top` 批量替换为 `https://project.roydust.top`；
3. 回仓库完成最后两项收敛：
   - `security-headers.ts`：CSP 增加 `upgrade-insecure-requests`、`img-src` 收紧为 `'self' https: data: blob:`，并同步更新 `security-headers.test.ts`；
   - `next.config.ts`：`remotePatterns` 删除 `http://project.roydust.top` 条目。

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
5. **本地 E2E 不得直连生产库**（2026-10-13 复盘新增）：`pnpm test:e2e` 本地跑时用的是 `.env` 的 `DATABASE_URL`，而 `e2e/helpers.ts` 的建文/建分类/建标签虽然 `finally` 里软删，被中断的运行会留下 `e2e-post-*` / `e2e-cat-*` / `e2e-tag-*` 垃圾。实测生产库曾累积 25 篇 `e2e-post-*`（其中 4 篇 `scheduledAt` 已过期，会让 `publish-scheduled` 每轮空转）、6 个 `e2e-cat-*`、2 个 `e2e-tag-*`，已于 2026-10-13 全部软删除。本地跑 E2E 前先把 `DATABASE_URL` 指向一次性库（CI 用的是服务容器 `inkforge_test`，不污染生产），或只在 CI 跑 E2E。
