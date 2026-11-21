# 前后端架构审查与修复计划

- 日期：2026-11-21
- 代码基线：`main` @ `9e6b9f1`（已按序合入 PR `#40` 字体分片、PR `#36` 改进计划阶段一、PR `#42` 方向 A 全站 UI 重构）
- 范围：前后端安全边界、API 与业务正确性、AI 流水线、缓存与软删除一致性、部署与网关基础设施、App Router 与交互体验
- 协同原则：与现有开放 Issue（`#2`、`#5`、`#6`、`#7`、`#8`、`#9`、`#10`、`#11`、`#12`、`#14`、`#15`、`#16`、`#17`、`#29`、`#35`）及 [对照开源项目改进分析](./improvement-analysis-vs-github-projects.md) 保持单一事实源——已有 Issue 拥有的架构决策（如 `#11` 独立 Worker、`#10` 状态列 CHECK 约束、`#6` 配置窄 getter）本文直接引用并补充前置止血项，不重复造轮子。

---

## 0. 基线同步与已合入修复确认

在制定本计划前，已按依赖顺序将以下 3 个在途 PR 合入 `main` 并通过 CI（`validate` + `e2e`）：

| PR | 合入方式 | 已解决的原架构问题 |
| --- | --- | --- |
| [#40](https://github.com/RoyDust/ai-blog/pull/40) | Squash (`30808d0`) | 移除 `src/app/fonts.ts` 四格式重复 preload 与 `.otf` 覆盖 `.woff2` 问题，改为 111 片 `unicode-range` woff2 按需加载 |
| [#36](https://github.com/RoyDust/ai-blog/pull/36) | Rebase (`229ac50..c28d9ad`) | API 错误响应收口与契约测试（`#30`）、点赞原子化与登录 `userId` / 去 IP 匿名身份（`#31`）、PV 写路径去 `getServerSession` 与拆事务（`#32`）、CI 新增 `pnpm typecheck` 与修复 `seed-categories/tags.cjs` 及 `dependabot`（`#33`）、清理 5 个冗余依赖与 `sitemap.ts` ISR 及搜索 `keepPreviousData`（`#34`） |
| [#42](https://github.com/RoyDust/ai-blog/pull/42) | Squash (`9e6b9f1`) | 落地方向 A「编辑排版」前后台体系、固定 `--hue: 224` 消除首屏色相跳变、移除 `HuePicker` 移动端死锁、收藏页改 `useSyncExternalStore` 消除水合不一致、收敛 `.admin-theme` 变量别名、精简 `/admin/posts` 顶部指标条缓解笔记本视口挤压、替换 3 处原生 `window.confirm` |

下文列出的 **18 个修复单元（分 A/B/C/D 四批）** 均已在 `9e6b9f1` 基线上逐文件复核确认仍待修复。

---

## 1. 修复批次总表

建议每个编号独立提交或独立窄 PR，业务改动与回归测试同步交付。

| 批次 | 编号 | 模块 | 问题摘要 | 严重度 | 工作量 | 关联 Issue |
| --- | --- | --- | --- | --- | --- | --- |
| **A：安全与越权止血** | A1 | 安全 / AI | 出站 SSRF 防护缺失（含阿里云 ECS `100.100.100.200`）及 AI 封面下载直传七牛公网外带链路 | P0 | M | `#14` 延伸 |
| **A：安全与越权止血** | A2 | API / 权限 | 遗留 `/api/posts` 普通用户抢注 slug、覆盖线上已发布文章、`browserId` 泄露与孤儿路由 `/posts/[slug]/edit` | P0 | S | 新增 |
| **A：安全与越权止血** | A3 | API / 评论 | `/api/comments` 的 `PATCH/DELETE` 缺入参校验（漏传 `id` 命中全表首行）、绕过审核且未失效缓存 | P0 | S | 新增 |
| **A：安全与越权止血** | A4 | 安全 / 上传 | 七牛上传 Token 缺扩展名白名单（允许 `.html/.svg` 与路径穿越）、缺 `fsizeLimit` 与 `mimeLimit` | P0 | S | 新增 |
| **A：安全与越权止血** | A5 | 可观测 / 审计 | `ApiOperationLog` 漏写 `ipHash`（全表 `NULL` 且用无盐 SHA-256），受控 4xx/5xx 丢失 `errorName/errorMessage` | P0 | S | `#2` 补充 |
| **B：闭环与基础设施** | B1 | Newsletter | 邮件退订链接点击必报 `405`、验证接口 `GET` 扫描预抓误激活、`.env.example` 配置错位与真实发信器缺口 | P1 | M | 新增 |
| **B：闭环与基础设施** | B2 | 网关 / 安全 | 生产 Nginx 明文 HTTP 裸奔（Cron 密钥每 15 分钟公网明文传输）及 60s 默认读超时导致长耗时 AI/群发必报 `504` | P1 | M | 运维手册 |
| **B：闭环与基础设施** | B3 | CI/CD / 部署 | `deploy.yml` 回滚时 `inputs.ref` 与 `github.sha` 错位、`current` 软链提前切换、Bash `source .env`、危险 `prisma db push` 兜底与容器/磁盘治理 | P1 | M | `#7/#16` 协同 |
| **B：闭环与基础设施** | B4 | 数据库 / 性能 | PostgreSQL 连接池默认 `max=1` 易引发健康探针假死；日志保留清理未超限时仍做 3 次全表扫描；`rate_limit_entries` 过期行未清理 | P1 | S | `#2/#29` |
| **C：AI、缓存与数据层** | C1 | AI 流水线 | Worker 落地前止血：`resumeAiBatchTasks` 漏筛活跃状态、全跳过误报成功、AI 日报缺互斥锁与 `runId` 轮询、冗余 6000-token 生成、`ExternalContentClient` 在测源与 HN/GitHub 抓取中被绕过 | P1 | M | `#8/#14/#15` 前置 |
| **C：AI、缓存与数据层** | C2 | 缓存 / 软删 | `/posts`、`/categories/[slug]`、`/tags/[slug]` 因 `await searchParams` 退化为动态直查库；无库构建冻结 `/about` 等兜底文案；`TopicGuide` / `Series` 软删与缓存失效缺口 | P1 | M | `#29` 阶段二 |
| **C：AI、缓存与数据层** | C3 | 权限 / 隐私 | 后台 RSC 页面与外部 `AiApiClient` 未实时校验管理员角色；公开页脚直接暴露管理员登录账号邮箱 | P1 | S | `#12` 延伸 |
| **C：AI、缓存与数据层** | C4 | 查询 / 测试 | 搜索与管理列表 `include` 整篇 `Post.content` 大字段；无 `DATABASE_URL` 时 6 个单测本地失败；`seed-mock-posts.cjs` 未适配部分唯一索引 | P1 | S | `#5/#33` 延伸 |
| **D：前端与体验收口** | D1 | 后台外壳 | 管理端 `< 1024px` 侧边栏隐藏但顶栏无移动端抽屉，平板/手机无法切换菜单或退出登录 | P2 | S | `#42` 补遗 |
| **D：前端与体验收口** | D2 | 前台路由 | 普通用户点击「个人资料」`/profile` 跳 `/admin` 触发权限报错；注册页必选的 `/terms`、`/privacy` 页面 `404` | P2 | S | 新增 |
| **D：前端与体验收口** | D3 | 文章阅读 | 详情页 TOC `extractHeadings` 把代码块 `# 注释` 当标题且行内代码锚点失配；Markdown 外链缺 `rel="noopener noreferrer"` | P2 | S | 新增 |
| **D：前端与体验收口** | D4 | 路由与分页 | `/admin/categories` 与 `/admin/tags` 未 `await searchParams` 导致重定向丢参；前台分类/标签详情页切片后无翻页控件 | P2 | S | 新增 |
| **D：前端与体验收口** | D5 | 交互与包体积 | 中文 Slug 触发 `viewTransitionName` 冲突；`NotificationBell` 偶发错误后卡死；`MarkdownEditor` 分屏打字卡顿；首屏 `LoginDialog` 动态拆包与 5 处七牛上传样板收敛 | P2 | M | `#29` 阶段二/三 |

---

## 2. 逐项修复方案与验收标准

### 批次 A：安全与数据破坏性入口止血（P0）

#### A1：出站 SSRF 防护网关与 AI 封面图校验
- **涉及位置**：
  - `src/lib/ai-cover-image.ts:105-123, 251-252`
  - `src/lib/external-content-client.ts:86-127, 176-187`
  - `src/lib/ai-models.ts:392-396`、`src/lib/ai-completion-client.ts:61-97`
  - `src/lib/ai-news/source-admin.ts:210-222, 304-310`
- **根因**：
  1. `imageToBuffer()` 对生图模型返回的 `url` 执行无防护 `fetch(image.value)`（自动跟随重定向、无协议/IP 限制、无 `Content-Type` 校验），再经 `uploadBufferToQiniu` 上传至公开七牛存储并返回 CDN URL，形成完整回显型 SSRF 外带链路。
  2. `validateExternalUrl()` 仅校验 `http(s):` 与无账密，未阻断回环地址（`127.0.0.0/8`、`::1`）、RFC1918 私网、链路本地（`169.254.0.0/16`）以及**阿里云 ECS 元数据网段 `100.64.0.0/10`（含 `100.100.100.200`）**，外部 RSS 源一次 `302` 即可穿透。
- **修复方案**：
  1. 新建 `src/lib/ssrf-guard.ts`：校验 URL 协议并利用 `undici` `Agent` 的 `connect`/`lookup` 钩子在 DNS 解析结果层面拦截 `0.0.0.0/8`、`127.0.0.0/8`、`10.0.0.0/8`、`172.16.0.0/12`、`192.168.0.0/16`、`169.254.0.0/16`、`100.64.0.0/10` 及对应 IPv6（`::1`、`fc00::/7`、`fe80::/10`、`::ffff:*`），防 DNS Rebinding（仅在显式开发环境开关下允许本地 Mock 上游）。
  2. 将 `ExternalContentClient`、`OpenAICompatibleCompletionClient`、`fetchAiModelJson`、`imageToBuffer` 统一收口至该安全 dispatcher，重定向统一设为 `manual` 并逐跳复验。
  3. `imageToBuffer` 强校验响应 `Content-Type` 属于允许的栅格图片类型，并核对 PNG/JPEG/WebP/GIF/AVIF 文件头魔数后再上传七牛；上游错误信息统一经 `scrubUpstreamDiagnostic` 脱敏。
- **验收标准**：单测覆盖直连与 `302` 跳转至 `127.0.0.1`、`169.254.169.254`、`100.100.100.200`、`[::1]` 及 `text/plain` 伪装图片响应，全部阻断且不触发七牛上传。

#### A2：下线遗留 `/api/posts` 写入口、收敛字段泄露与孤儿编辑页
- **涉及位置**：
  - `src/app/api/posts/route.ts:35-86`
  - `src/app/api/posts/[slug]/route.ts:31-230`
  - `src/app/posts/[slug]/edit/page.tsx:1-194`
- **根因**：
  1. 普通注册用户（`Role.USER`）可通过 `POST /api/posts` 无限制创建草稿并全局抢注 `slug`（阻塞 AI 日报等固定 slug）。
  2. `PATCH /api/posts/[slug]` 第 125 行在省略 `published` 字段时保留原值 `true`，使普通作者可绕过审核直接篡改已被管理员发布的线上文章并刷新公共缓存。
  3. `GET /api/posts/[slug]` 使用 `include` 返回了所有评论者的匿名标识 `browserId`、`authorId` 及内部 AI 状态列。
  4. `src/app/posts/[slug]/edit/page.tsx` 无外壳、不受 `middleware.ts` 保护，且保存逻辑会丢失分类/标签/系列/SEO 字段。
- **修复方案**：
  1. 移除 `POST /api/posts`、`PATCH /api/posts/[slug]`、`DELETE /api/posts/[slug]`（所有文章写操作统一走已受 `middleware.ts` + `requireAdminSession()` 保护的 `/api/admin/posts/**`）；同时在 `validation.ts` 为文章正文补充合理体积上限（如 512 KiB）。
  2. `GET /api/posts/[slug]` 改为显式 `select`（对齐 `src/app/(public)/posts/[slug]/page.tsx` 的安全字段集），严禁输出 `browserId`、`authorId`、`summaryError`、`summaryJobId` 等内部字段。
  3. 将 `src/app/posts/[slug]/edit/page.tsx` 替换为薄 Server Component：校验管理员会话并按 `slug` 查出文章 `id` 后 `redirect('/admin/posts/' + post.id + '/edit')`（非管理员走登录提示，不存在走 `notFound()`）。
- **验收标准**：普通登录态请求旧写接口返回 `405`；`GET /api/posts/[slug]` 响应不含 `browserId`；访问 `/posts/<slug>/edit` 正确重定向至后台工作台。

#### A3：收口 `/api/comments` 的无校验 `PATCH / DELETE` 入口
- **涉及位置**：`src/app/api/comments/route.ts:19-113`
- **根因**：`PATCH` 直接 `const { id, content } = await request.json()`，当管理员请求漏传 `id` 时 Prisma 忽略 `id: undefined` 并篡改全表首条未删评论；无长度校验、无限流、编辑后保持 `APPROVED` 不重审、改删后不失效公共文章缓存；而 `POST` 从不写入 `authorId`，普通用户本就无法调用 `PATCH/DELETE`。
- **修复方案**：
  1. 前台评论管理统一归口至 `/api/admin/comments`，移除 `/api/comments` 上的 `PATCH` 与 `DELETE`（仅保留带限流与入参校验的公开 `POST`）。
  2. 若未来确需开放登录读者自删/自改评论，须先在 `POST` 绑定会话 `authorId`，并通过 `validation.ts` 强校验非空字符串 `id` 与 `content`（≤ 5000 字），编辑后重置 `status = 'PENDING'` 并调用 `revalidatePublicContent({ slug })`。
- **验收标准**：契约与路由单测确认 `/api/comments` 不再暴露无校验的 `PATCH/DELETE` 写面。

#### A4：七牛上传凭证安全策略加固与代码去重
- **涉及位置**：`src/app/api/admin/uploads/qiniu-token/route.ts:19-81`、`src/lib/qiniu-server.ts:20-33`
- **根因**：`sanitizeFilename` 未清洗扩展名 `ext`（允许签发 `.html`/`.svg` 凭证造成同源存储型 XSS，或通过 `a.b/../../x` 注入路径斜杠），且 `putPolicy` 缺少 `fsizeLimit` 与 `mimeLimit`；Token 签名逻辑在两文件中重复实现。
- **修复方案**：
  1. 在 `src/lib/qiniu-server.ts` 统一封装 `createQiniuUploadToken` 与文件名生成，强制匹配扩展名白名单 `/^\.(jpe?g|png|webp|avif|gif)$/`（拒绝 `.svg`、`.html` 及任何含 `/`、`\`、`..` 的输入），并校验请求的 `contentType` 与扩展名一致。
  2. 在客户端直传 `putPolicy` 中加入 `fsizeLimit: 10 * 1024 * 1024`（10 MiB）与 `mimeLimit: "image/jpeg;image/png;image/webp;image/avif;image/gif"`。
- **验收标准**：上传 `.svg`、`.html`、路径穿越文件名或非法 MIME 返回 `400 ValidationError`；解码返回 token 的 `putPolicy` 断言包含 `fsizeLimit` 与 `mimeLimit`。

#### A5：操作审计日志完整性修复（`ipHash` 与受控错误原因）
- **涉及位置**：
  - `src/lib/api-operation-logs.ts:276-284, 325-348`
  - `src/lib/api-operation-log-route.ts:142-191`
  - `src/lib/api-errors.ts:189-225`
  - `middleware.ts:11-14`、`src/app/api/analytics/visit/route.ts:22-30`
- **根因**：
  1. `createApiOperationLog` 在 `model.create({ data })` 中遗漏了 `ipHash: input.ipHash ?? null`，导致线上 `api_operation_logs.ipHash` 全部为 `NULL`；且 `hashIp` 使用无盐 `SHA-256`，IPv4 地址可被彩虹表秒级逆向。
  2. Route Handler 捕获异常并返回 `toErrorResponse(error)` 后，外层 `withApiOperationLogging` 的 `caughtError` 为 `null`，导致所有受控 4xx/5xx 日志缺失 `errorName` 和 `errorMessage`。
  3. 客户端 IP 提取顺序在 `rate-limit.ts`（`x-real-ip` 优先）与其余模块（`x-forwarded-for[0]` 优先）之间不一致。
- **修复方案**：
  1. 在 `createApiOperationLog` 补齐 `ipHash: input.ipHash ?? null`；将 `hashIp`（含 `visit/route.ts`）统一改为带服务端密钥的 `HMAC-SHA256`；抽离单一 `getClientIp(headers)` 辅助函数并以 Nginx 覆写的 `x-real-ip` 优先。
  2. 在 `toErrorResponse` 内将 `{ errorName, errorMessage }`（500 未知异常记录脱敏摘要）写入 `api-operation-log-context`，由 `withApiOperationLogging` 在 `finally` 中读取落库；同时把 11 个向 `toErrorResponse(error, error.message)` 透传原始异常消息的路由改为固定安全兜底文案，并在 `toErrorResponse` 补齐 Prisma `P2025 -> 404` 与 JSON `SyntaxError -> 400`。
- **验收标准**：路由返回 400/401/404/429/500 时，审计日志表准确记录非空 `ipHash`、`errorName` 与脱敏 `errorMessage`，响应体不泄露原始 SQL/堆栈。

---

### 批次 B：核心业务闭环、网关与部署可靠性（P1 上半）

#### B1：Newsletter 退订/验证链路修复与发信器对齐
- **涉及位置**：
  - `src/lib/newsletter-renderer.ts:36, 56`
  - `src/app/api/newsletter/unsubscribe/route.ts:8-39`
  - `src/app/api/newsletter/verify/route.ts:7-35`
  - `src/app/api/newsletter/subscribe/route.ts:46-54`
  - `src/lib/newsletter-mailer.ts:51-81`、`.env.example:78-79`
- **修复方案**：
  1. 新增公开页面 `src/app/(public)/newsletter/unsubscribe/page.tsx` 与 `verify/page.tsx`，邮件正文链接改为指向前端确认页，由用户点击按钮发起 `POST`（彻底解决邮件点击退订 `405` 及企业邮箱网关预抓 `GET` 误激活问题）。
  2. `POST /api/newsletter/unsubscribe` 同时支持从 URL query / `application/x-www-form-urlencoded` 读取 `token`，并在邮件头附带 `List-Unsubscribe` 与 `List-Unsubscribe-Post: List-Unsubscribe=One-Click`（RFC 8058）。
  3. 为 `/api/newsletter/verify` 增加 `checkInteractionRateLimit` 与验证 token 过期时间（如 48h）；`/api/newsletter/subscribe` 对已订阅与新订阅返回统一模糊提示防邮箱枚举。
  4. 修正 `.env.example` 中无效的 `NEWSLETTER_PROVIDER="console"`（对齐 `"log"`），并在接入真实 SMTP / Resend 适配器前在后台界面明确提示当前为模拟/未启用发信状态；隐藏或接入 `scheduledAt` 定时发送。
- **验收标准**：模拟邮件客户端 `GET` 打开退订与验证链接渲染确认页且不直接改库；点击确认或 One-Click `POST` 成功退订/激活。

#### B2：生产 HTTPS 切换与 Nginx 长连接超时分流
- **涉及位置**：`deploy/nginx.my-next-app.conf:1-15`、`.github/workflows/daily-ai-news.yml`、`.github/workflows/log-retention.yml`、`.github/workflows/publish-scheduled.yml`
- **修复方案**：
  1. 在 Nginx 终结 TLS（`listen 443 ssl http2;`，80 端口 `301` 跳转），开启 `__Secure-` Cookie；移除三个定时 workflow 中的 `http://47.98.167.32` 明文回退，校验 `PRODUCTION_BASE_URL` 必须以 `https://` 开头并传 `curl --proto '=https' --tlsv1.2 --max-time 30`。
  2. 将 `POST /api/admin/ai-news/run` 与 `POST /api/admin/newsletter/campaigns/[id]/send`（及 `/retry`）改为立即返回 `202 Accepted` + 状态轮询，不再在单次 HTTP 请求内同步串行跑完全程。
  3. Nginx 补齐 `map $http_upgrade $connection_upgrade`（修复普通请求 keepalive）、`server_tokens off;`、`client_max_body_size 10m;`，并为同步 AI 交互端点（`/api/admin/ai/`、`/api/admin/covers/generate`、`/api/admin/posts/`、`/api/ai/drafts`）单独设置 `proxy_read_timeout 180s;`。
- **验收标准**：Nginx 配置 `nginx -t` 通过；长耗时任务触发在 1s 内返回 `202` 且不触发 `504`。

#### B3：部署流水线与容器运行基线加固
- **涉及位置**：`.github/workflows/deploy.yml:55-177`、`scripts/deploy/deploy-remote.sh:33-88`、`scripts/deploy/backup-production.sh:11-61`、`Dockerfile:43-61`、`docker-compose.prod.yml:1-22`
- **修复方案**：
  1. 在 `deploy.yml` 检出代码后用 `RESOLVED_SHA=$(git rev-parse HEAD)` 替代 `${{ github.sha }}` 作为 `releases/<sha>` 目录名与 `RELEASE_SHA`，确保指定历史 commit/tag 部署时版本标识准确；并将 `ln -sfn .../current` 移至健康门禁通过之后（或失败时回指旧 release）。
  2. 移除 `deploy.yml` 与 `deploy-remote.sh` 中的 `source app.env/.env`（改用 Node `dotenv.parse` 安全提取所需标量变量），并在追加密钥前写入换行符；用预置 `DEPLOY_KNOWN_HOSTS` 替代动态 `ssh-keyscan`；为三个定时 workflow 补齐 `concurrency` 防重叠。
  3. 移除 `deploy-remote.sh:80` 的 `pnpm prisma db push` 兜底（缺失迁移目录直接 `exit 1`，防止意外删除部分唯一索引与限流表）；允许首次部署或旧容器已退出时从 `shared/.env` 读取连接串完成备份。
  4. 增加宿主机保留裁剪（仅保留最近 5 个 `releases/*`、`backups/*.dump` 与 `my-next-app:pre-*` 镜像标签），在 `docker-compose.prod.yml` 配置 `init: true` 与 Docker 日志轮转（`max-size: "20m"`, `max-file: "5"`），并将 `Dockerfile` 切换为 Next.js `output: "standalone"` + 非 `root`（`USER node`）运行。
- **验收标准**：`deploy-remote.test.cjs` 与 `backup-production.test.cjs` 新增覆盖无运行旧容器、含特殊字符 `$`/`!` 的 `.env`、缺失迁移目录失败退出及 `RESOLVED_SHA` 一致性。

#### B4：PostgreSQL 连接池默认值、日志保留短路与过期数据裁剪
- **涉及位置**：`src/lib/prisma.ts:41-45`、`src/lib/api-operation-log-retention.ts:18-36`、`src/lib/rate-limit.ts:51-68`
- **修复方案**：
  1. `readPoolMax()` 在生产环境未显式配置 `DATABASE_POOL_MAX` 时默认设为 `8`（测试/构建环境保持 `1–2`），同步更新 `.env.example` 与 `README.md`。
  2. 在 `runApiOperationLogRetention` 第 19 行拿到 `before` 统计后，若 `before.bytes <= maxStorageBytes` 立即短路返回 `status: 'completed'`，消除稳态下每 15 分钟无意义的窗口函数全表扫描与二次统计。
  3. 将 `rate_limit_entries` 声明进 `prisma/schema.prisma`（对齐 `#29` 5.4），并在 `log-retention` 定时任务中顺带执行 `DELETE FROM rate_limit_entries WHERE reset_at <= NOW()`；同时对内存态 `createMemoryRateLimiter` 与 `aiSearchCache` 增加最大键数上限与惰性清理。
- **验收标准**：PG 集成测试验证未超限时清理耗时与删除行数为 0、超限时行为不变，且过期限流行被正确清理。

---

### 批次 C：AI 流水线止血、缓存/软删一致性与权限数据层（P1 下半）

#### C1：独立 Worker（`#11/#8/#15`）落地前的 AI 流水线止血
- **涉及位置**：
  - `src/lib/ai-batch-jobs.ts:272-293`、`src/lib/ai-tasks.ts:121-140`
  - `src/lib/ai-news/run/entry.ts:269-292`、`src/app/api/cron/ai-news/route.ts:56-157`、`.github/workflows/daily-ai-news.yml:58-84`
  - `src/lib/ai-news/run/steps.ts:335-370`
  - `src/lib/ai-news/source-admin.ts:697`、`src/lib/ai-news/fetchers.ts:187-289, 310-389`
- **修复方案**：
  1. `resumeAiBatchTasks()` 无 `taskId` 分支补上 `status: { in: ["QUEUED", "RUNNING"] }`，避免被最近 10 条已完成任务遮蔽；将 GET 接口中的 `?resume=1` 写副作用拆到显式恢复动作，并限制单进程批处理并发度（如最多 3 项并发）。
  2. `resolveTaskStatus()` 当 `succeeded === 0 && failed === 0 && skipped > 0` 时不再判为 `SUCCEEDED`（避免对 0 成功任务发送“AI 任务已完成”通知）。
  3. `runDailyAiNews` 增加基于日期的 PostgreSQL advisory lock（拦截 Cron 与后台手动并发双跑）及超时僵尸 `RUNNING` 回收；`POST /api/cron/ai-news` 先落库 `AiNewsRun` 并返回 `runId`，`daily-ai-news.yml` 改为按精确 `runId` 轮询。
  4. 在 `"candidate-pipeline"` 正常模式下移除 `steps.ts:335` 废弃正文的 6000-token `generateDailyAiNewsDraft` 调用（标题直接由 `editorialBrief` 产出）；当候选为 0 落入 `"fallback"` 模式时默认保存为草稿而非自动公开发布。
  5. 修复 `fetchRssItems` 中 `fetchImpl === fetch` 判断失效导致的 `ExternalContentClient` 绕过问题，并将 HackerNews（加并发上限 ≤ 6）与 GitHub Releases 抓取统一收口至 `ExternalContentClient`。
- **验收标准**：单测与集成测试验证 10+ 历史完成任务下仍能恢复旧 `QUEUED` 任务、并发触发日报互斥返回确定状态、源测试严格受 5 MiB 响应上限保护。

#### C2：公共页 ISR 动态退化修复、构建期兜底与软删失效闭环
- **涉及位置**：
  - `src/app/(public)/posts/page.tsx:1, 35-36`、`categories/[slug]/page.tsx:1, 35-43`、`tags/[slug]/page.tsx:1, 35-43`
  - `src/app/(public)/about/page.tsx`、`contact/page.tsx`、`src/app/llms.txt/route.ts`、`src/app/api/ai/openapi/route.ts`
  - `src/lib/cache.ts:9-27, 106-137`、`src/lib/topic-guides.ts:178-241`、`src/app/api/admin/series/route.ts:152-186`
  - `src/lib/posts.ts:149-151`、`src/lib/public-search.ts:128-139`、`src/lib/ai-authoring.ts:550-560, 651-662`
- **修复方案**：
  1. 为公共数据读取函数（文章分页、分类/标签目录、站点设置）封装 `unstable_cache` + 语义化 `tags`（对齐 `#29` 阶段二），解决 `await searchParams` 使路由级 `revalidate = 300` 退化为每次请求打库的问题。
  2. 为 `/about`、`/contact`、`/llms.txt`、`/api/ai/openapi` 补齐 `export const revalidate = 300`，防止 Docker 无 `DATABASE_URL` 构建期将默认占位文案永久冻结在产物中，并同步纳入 `public-layout-cache.test.ts` 契约测试。
  3. 补齐 `TopicGuide` 创建/更新/软删对 `/guides`、`/guides/[slug]` 及 `/sitemap.xml` 的缓存失效，并将已发布导读纳入 `sitemap.ts`；`Series` 软删时在同事务清空关联文章的 `seriesId = null` 并重验证受影响文章页；补齐 `getPublishedPostsPage` 分类筛选、`public-search.ts` 标签/分类关联及 `createAdminPost/updateAdminPost` 写入时的 `deletedAt: null` 校验。
- **验收标准**：`next build && next start` 生产模式下验证 `/about` 首次请求回源更新真实设置、TopicGuide 与 Series 变更后前台立即刷新且无残留软删引用。

#### C3：后台 RSC 页面与外部 Agent 实时角色校验（`#12` 补全）及管理员邮箱隔离
- **涉及位置**：`src/app/admin/page.tsx`、`src/app/admin/settings/page.tsx`、`src/lib/ai-auth.ts:64-75`、`src/lib/public-profile.ts:9-19`、`src/app/api/analytics/visit/route.ts`
- **修复方案**：
  1. 配合 `#12` 将后台鉴权统一查数据库当前用户角色的同时，抽取带 `React.cache` 的 `requireAdminPageSession()` 并在 `/admin` 各服务端 `page.tsx` 调用（堵住客户端 RSC 切页不重跑 `admin/layout.tsx` 的窗口）。
  2. `requireAiClient` 查询 `AiApiClient` 时增加 `owner: { role: 'ADMIN' }` 条件，确保账号降权后其持有的外部 Agent Token 立即失效。
  3. `getPublicProfile()` 改为只读取 `BlogSettings` 公开配置邮箱或 `NEXT_PUBLIC_CONTACT_EMAIL`，不再回退暴露管理员登录表 `User.email`。
- **验收标准**：管理员降权为 `USER` 后，持原 JWT 访问 `/admin` RSC 请求、`/api/admin/*` 及持原 `AiApiClient` Token 请求 `/api/ai/drafts` 均立即返回 403/重定向。

#### C4：列表查询大字段裁剪、本地无库单测修复与种子脚本补齐
- **涉及位置**：`src/lib/public-search.ts:207-214`、`src/app/api/admin/posts/route.ts:78-93`、`src/app/(public)/series/[slug]/page.tsx:28-45`、`src/lib/topic-guides.ts:243-257`、`src/app/api/admin/posts/metadata/__tests__/route.test.ts`、`src/app/api/admin/posts/review/__tests__/route.test.ts`、`scripts/seed-mock-posts.cjs`
- **修复方案**：
  1. 将 `/api/search`、`/api/admin/posts`、`/series/[slug]`、`/guides/[slug]` 中的 `Post` `include` 替换为排除 `content`（`@db.Text`）的窄 `select`。
  2. 为 `metadata/__tests__/route.test.ts` 与 `review/__tests__/route.test.ts` 补齐 `ai-models` 默认模型解析在无 `DATABASE_URL` 时的 mock/回退，消除全仓本地无库跑 `pnpm test` 时唯一的 6 个失败用例。
  3. 参照 `#33` 对 `seed-categories.cjs` 的改法，将 `scripts/seed-mock-posts.cjs` 中的 `.upsert({ where: { slug } })` 改为基于 `deletedAt: null` 的幂等查找更新。
- **验收标准**：无 `.env` / `DATABASE_URL` 环境下运行 `pnpm test` 100% 全绿；`/api/search` 与 `/api/admin/posts` 列表响应体不再携带整篇 `content`。

---

### 批次 D：前端路由、移动端后台外壳与阅读交互收口（P2）

#### D1：管理后台 `< 1024px` 移动端抽屉导航与退出入口
- **涉及位置**：`src/components/admin/shell/AdminLayoutContext.tsx`、`AdminHeader.tsx:19-54`、`AdminSider.tsx:91-125`、`AdminLayout.tsx:40-70`
- **根因**：`AdminSider` 在 `lg` 以下隐藏，而 `AdminHeader` 左上角按钮仅切换桌面端 `isCollapsed` 宽度（`64px/224px`），平板与手机端点击无反应，且「设置」与「退出登录」仅存在于侧栏底部。
- **修复方案**：在 `AdminLayoutContext` 增加 `isMobileDrawerOpen` 状态；`< 1024px` 时顶栏按钮打开 `Sheet` 抽屉渲染完整 `AdminSider` 并在路由切换时自动关闭。
- **验收标准**：390px 视口下在 `/admin` 点击顶栏按钮可展开导航抽屉、正常跳转子页并执行退出登录。

#### D2：普通用户 `/profile` 误跳报错修复与注册页协议路由补齐
- **涉及位置**：`src/components/auth/AccountEntry.tsx:117-121`、`src/app/profile/page.tsx`、`src/app/profile/edit/page.tsx`、`src/app/(auth)/register/page.tsx`
- **修复方案**：
  1. 将 `/profile` 迁入 `src/app/(public)/profile/page.tsx` 提供基础账号信息修改（复用 `/api/users/me`），或对 `ADMIN` 跳转 `/admin/settings?tab=account`、对 `USER` 隐藏后台入口，不再把普通读者导向 `/admin` 触发“非管理员账号”错误弹窗。
  2. 新增简洁版公开页 `/terms` 与 `/privacy`（或在未配置条款时调整注册勾选文案），消除注册表单上的两个 `404` 死链；同时在前台导航/页脚补充已上线的 `/guides`（专题导读）入口。
- **验收标准**：`USER` 角色登录后点击账号菜单无权限报错；注册页链接均可正常打开。

#### D3：文章详情 TOC 代码围栏过滤、行内代码锚点对齐与外链安全属性
- **涉及位置**：`src/app/(public)/posts/[slug]/page.tsx:163-210`（及 Markdown `components` 映射）
- **修复方案**：
  1. 抽取共享 `src/lib/markdown-headings.ts`：`extractHeadings` 严格跟踪 ```` ``` ```` 与 `~~~` 围栏状态以跳过代码块内的 `# 注释`，并在展示文本与 `slugify` 前剥离行内 Markdown 标记（`` `code` ``、`**bold**`、`[label](url)`），保证目录项 ID 与 `ReactMarkdown` 渲染标题的纯文本 ID 100% 一致。
  2. 在文章详情与编辑器预览的 `ReactMarkdown` `components.a` 中，对外部 `http(s)://` 链接自动附加 `target="_blank" rel="noopener noreferrer"`，对站内 `/` 相对路径使用 Next.js `<Link>`。
- **验收标准**：含 Bash `# 注释` 代码块及 ``## 使用 `useSWR` 请求`` 标题的文章，目录不混入代码注释且点击标题精准平滑定位。

#### D4：Next.js 16 分类/标签后台重定向 `await searchParams` 与前台详情分页
- **涉及位置**：`src/app/admin/categories/page.tsx:25-33`、`src/app/admin/tags/page.tsx:25-33`、`src/app/(public)/categories/[slug]/page.tsx`、`src/app/(public)/tags/[slug]/page.tsx`
- **修复方案**：
  1. 将 `AdminCategoriesRedirectPage` 与 `AdminTagsRedirectPage` 的 `searchParams` 类型修正为 `Promise<SearchParams>` 并 `await` 后再拼接查询串。
  2. 在前台分类详情页与标签详情页底部接入 `Pagination` 组件（复用方向 A 页码积木），使第 2 页及之后文章可正常翻页访问。
- **验收标准**：访问 `/admin/categories?q=ai&page=2` 重定向后完整保留 `q=ai&page=2&tab=categories`；超过单页容量的分类/标签页可翻页。

#### D5：视图过渡冲突、通知铃铛错误恢复、编辑器防卡顿与客户端上传收敛
- **涉及位置**：
  - `src/lib/view-transition.ts:3-17`、`src/components/blog/ArticleToc.tsx`
  - `src/components/admin/notifications/NotificationBell.tsx:91-98`、`NotificationCenterClient.tsx`
  - `src/components/posts/MarkdownEditor.tsx`、`src/components/AppProviders.tsx`
  - `useCoverUpload.ts` / `EditorWorkspace.tsx` / `CoverUploadDropzone.tsx` / `image-crop-upload-dialog.tsx` / `CoverGalleryManager.tsx`
- **修复方案**：
  1. `toSafeSlug` 对纯中文/非 ASCII slug 追加确定性短哈希后缀替代固定 `"unknown"`，消除同屏多篇中文 slug 文章因相同 `viewTransitionName` 抛出 `InvalidStateError` 的问题；`ArticleToc` 的 `LayoutGroup` 使用 `useId()` 隔离桌面栏与移动抽屉。
  2. `NotificationBell` 与 `NotificationCenterClient` 在 SWR `onSuccess` 中调用 `setError(null)`，避免单次瞬时网络报错后永久锁死错误态。
  3. `MarkdownEditor` 分屏模式下对预览输入使用 `useDeferredValue(value)` + `React.memo`，解决长篇带代码块文章输入掉帧问题。
  4. `AppProviders` 中对 `GlobalLoginDialog` 采用 `next/dynamic` 按需加载，并将 `SessionProvider` 设为 `refetchOnWindowFocus={false}`；将 5 处重复手写的七牛上传 `fetch` 收敛为单一 `uploadFileToQiniu` 客户端模块（经 `apiMutate` + `toErrorMessage` 统一中文错误提示），并将 `CoverGalleryManager` 迁回共享 `useFilterMemory`；`BookmarkButton` 改用 `useSyncExternalStore` 消除剩余水合警告。
- **验收标准**：两篇中文 slug 文章同屏切换无控制台 `ViewTransition` 异常；通知接口断网恢复后下一次轮询自动恢复列表；长文编辑无同步重排卡顿。

---

## 3. 与现有开放 Issue 的边界对照及共同门禁

### 3.1 归属边界对照

| 开放 Issue | 与本计划的关系 |
| --- | --- |
| `#2` 操作日志移出热路径 | 主体已落地；本计划 **A5** 修补日志漏字段 bug，**B4** 增加未超限短路优化与 `rate_limit_entries` 清理 |
| `#5` 公共搜索排序分页 / `#9` Route Handler 护栏 | 独立推进；本计划 **C2** 先修软删标签/分类泄露，**C4** 先去掉搜索响应中的 `Post.content` 大字段 |
| `#6` 运行配置窄 getter + ratchet | 独立推进；本计划 **B4** 的默认连接池调整直接消费同一数据库配置入口 |
| `#7` 健康探针与部署等待 | Web 端已落地；本计划 **B3** 补齐 `deploy.yml` SHA 错位、软链时序与 `.env` 安全解析 |
| `#10` 状态列 CHECK 约束 | 独立推进（按 `#10` 顺序先覆盖 `CoverAsset` 与 `TopicGuide`） |
| `#16 -> #17 -> #11 -> #8/#15` 持久化 Worker 链 | 长期架构主线；本计划 **C1** 仅做零表结构变更的查询过滤、状态判定与互斥锁止血，不新建第二套队列 |
| `#12` 后台授权读数据库实时角色 | 本计划 **C3** 将检查范围从 `/api/admin/*` 一并闭合到 `/admin` RSC 页面与 `AiApiClient` |
| `#14` 外部调用可靠性与 Completion 收口 | 本计划 **A1**（SSRF 网关）与 **C1.5**（修复 `ExternalContentClient` 绕过）直接作为 `#14` 的安全与覆盖面补完 |
| `#29` 三阶段改进总图 / `#35` 覆盖率与 E2E 门禁翻转 | 阶段一（`#30–#34`）已随 PR `#36` 合入；本计划 **A/B/C/D** 补齐审查新发现的安全/业务缺陷，并与 `#29` 阶段二/三并行不悖 |

### 3.2 每个交付单元的验收门禁

1. **先写失败回归测试再写修复**：安全拦截（A1/A2/A3/A4）、日志字段（A5）、事务与锁（B4/C1）均需有可复现的前置失败单测或 PG 集成测试。
2. **全套静态与单测门禁必过**：`pnpm lint`（0 error）、`pnpm typecheck`、`pnpm test`、`pnpm vitest run --config vitest.integration.config.ts`、`pnpm build`。
3. **契约测试同步更新**：涉及公共页缓存（C2）、API 错误响应（A2/A3/A5）、环境变量（B1/B4）的改动必须同步更新对应 `*-contract.test.ts`。
4. **文档生命周期**：全部批次实施验收完毕后，将本文移入 `docs/archive/` 并更新 `docs/README.md` 索引。
