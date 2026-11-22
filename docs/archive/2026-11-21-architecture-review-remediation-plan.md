# 前后端架构审查与修复计划

- 日期：2026-11-21（2026-11-22 实施前审查修订）
- 代码基线：`main` @ `b485e2d`（代码态等同 `9e6b9f1`，已按序合入 PR `#40` 字体分片、PR `#36` 改进计划阶段一、PR `#42` 方向 A 全站 UI 重构）
- 范围：前后端安全边界、API 与业务正确性、AI 流水线、缓存与软删除一致性、部署与网关基础设施、App Router 与交互体验
- 协同原则：与现有开放 Issue（`#2`、`#5`、`#6`、`#7`、`#8`、`#9`、`#10`、`#11`、`#12`、`#14`、`#15`、`#16`、`#17`、`#29`、`#35`）及 [对照开源项目改进分析](../implementation/improvement-analysis-vs-github-projects.md) 保持单一事实源——已有 Issue 拥有的架构决策（如 `#11` 独立 Worker、`#10` 状态列 CHECK 约束、`#6` 配置窄 getter）本文直接引用并补充前置止血项，不重复造轮子。
- 证据口径：文中严格区分“静态代码与单测已确认事实”和“待生产数据库/线上环境配置核实的运行态事实”，不把静态推断写成既成生产统计。

---

## 0. 基线同步与已合入修复确认

在制定本计划前，已按依赖顺序将以下 3 个在途 PR 合入 `main` 并通过 CI（`validate` + `e2e`）：

| PR | 合入方式 | 已解决的原架构问题 |
| --- | --- | --- |
| [#40](https://github.com/RoyDust/ai-blog/pull/40) | Squash (`30808d0`) | 移除 `src/app/fonts.ts` 四格式重复 preload 与 `.otf` 覆盖 `.woff2` 问题，改为 111 片 `unicode-range` woff2 按需加载 |
| [#36](https://github.com/RoyDust/ai-blog/pull/36) | Rebase (`229ac50..c28d9ad`) | API 错误响应收口与契约测试（`#30`）、点赞原子化与登录 `userId` / 去 IP 匿名身份（`#31`）、PV 写路径去 `getServerSession` 与拆事务（`#32`）、CI 新增 `pnpm typecheck` 与修复 `seed-categories/tags.cjs` 及 `dependabot`（`#33`）、清理 5 个冗余依赖与 `sitemap.ts` ISR 及搜索 `keepPreviousData`（`#34`） |
| [#42](https://github.com/RoyDust/ai-blog/pull/42) | Squash (`9e6b9f1`) | 落地方向 A「编辑排版」前后台体系、固定 `--hue: 224` 消除首屏色相跳变、移除 `HuePicker` 移动端死锁、收藏页改 `useSyncExternalStore` 消除水合不一致、收敛 `.admin-theme` 变量别名、精简 `/admin/posts` 顶部指标条缓解笔记本视口挤压、补齐分类/标签详情页 `EditorialPagination` 分页（`TaxonomyPostGrid.tsx:68`）、替换 3 处原生 `window.confirm` |

下文列出的 **19 个修复单元（分 A/B/C/D 四批）** 均已在 `9e6b9f1` 代码基线上逐文件复核确认仍待修复。

---

## 1. 修复批次总表

建议每个编号独立提交或独立窄 PR，业务改动与回归测试同步交付。

| 批次 | 编号 | 模块 | 问题摘要 | 严重度 | 工作量 | 关联 Issue |
| --- | --- | --- | --- | --- | --- | --- |
| **A：安全与越权止血** | A1 | 安全 / 出站 | 生图全链路、模型调用、RSS 测源与 HN/GitHub 抓取缺统一 SSRF 防护（含阿里云 ECS `100.100.100.200`）及 URL/Base64 双格式图片魔数校验 | P0 | M | `#14` 延伸 |
| **A：安全与越权止血** | A2 | API / 权限 | 遗留 `/api/posts` 普通用户抢注 slug、覆盖线上已发布文章、`browserId` 泄露与孤儿路由 `/posts/[slug]/edit` | P0 | S | 新增 |
| **A：安全与越权止血** | A4 | 安全 / 上传 | 七牛上传 Token 缺扩展名白名单（允许 `.html/.svg` 与路径穿越）、缺 `fsizeLimit` 与 `mimeLimit` | P0 | S | 新增 |
| **A：安全与越权止血** | A5 | 可观测 / 安全 | 操作日志 JSON 解析失败时记录 512 字符未脱敏原文（含密码/密钥风险）、代码漏写 `ipHash`（且用无盐 SHA-256）、受控 4xx/5xx 丢失错误原因 | P0 | S | `#2` 补充 |
| **A：安全与越权止血** | A6 | AI 日报 / 发布 | 日报重跑（`!regenerate`）遇到同 slug 未发布文章直接发布并改写 `generatedByAiNews`，导致同名人工草稿或待审 fallback 草稿被误发 | P0 | S | `#15` 前置 |
| **A：安全与越权止血** | A3 | API / 评论 | `/api/comments` 暴露未使用的无校验 `PATCH/DELETE` 写面（绕过重审、缺缓存失效；顺手随批次 A 下线） | P1 | S | 新增 |
| **B：闭环与基础设施** | B1 | Newsletter | 邮件退订链接点击必报 `405`、验证接口 `GET` 扫描预抓误激活、异步触发重启后 `unknown` 人工核对衔接与发信器配置对齐 | P1 | M | 新增 |
| **B：闭环与基础设施** | B2 | 网关 / 安全 | 仓库 Nginx 配置缺 TLS 且定时 workflow 含明文 `http://` 回退；60s 默认读超时与 keepalive/请求体上限缺口 | P1 | S | 运维手册 |
| **B：闭环与基础设施** | B3 | CI/CD / 部署 | `deploy.yml` 回滚 `inputs.ref` 与 `github.sha` 错位、软链时序与停旧容器后的恢复演练、Bash `source .env`、危险 `prisma db push` 兜底与容器/磁盘治理 | P1 | M | `#7/#16` 协同 |
| **B：闭环与基础设施** | B4 | 数据库 / 性能 | PostgreSQL 连接池默认 `max=1` 易引发健康探针假死；日志保留清理未超限时仍做 3 次全表扫描；`rate_limit_entries` 过期行未清理 | P1 | S | `#2/#29` |
| **C：AI、缓存与数据层** | C1 | AI 流水线 | Worker 落地前止血：`resumeAiBatchTasks` 漏筛活跃状态、全跳过误报成功、日报互斥锁与 `202` 持久化 `runId` 重启恢复、移除冗余 6000-token 草稿生成 | P1 | M | `#8/#15` 前置 |
| **C：AI、缓存与数据层** | C2 | 缓存 / 软删 | `/posts`、`/categories/[slug]`、`/tags/[slug]` 因 `await searchParams` 退化为动态直查库；无库构建后首访返回构建期兜底文案；`TopicGuide` / `Series` 软删与缓存失效缺口 | P1 | M | `#29` 阶段二 |
| **C：AI、缓存与数据层** | C3 | 权限 / 隐私 | 直读敏感数据的后台 RSC `page.tsx` 与独立令牌 `AiApiClient` 缺少实时管理员角色校验；公开页脚直接暴露管理员登录邮箱 | P1 | S | `#12` 延伸 |
| **C：AI、缓存与数据层** | C4 | 查询 / 测试 | 搜索与管理列表对外返回整篇 `Post.content`（需保留 AI 搜索 220 字受限摘要）；无 `DATABASE_URL` 时 6 个单测本地失败；`seed-mock-posts.cjs` 未适配部分唯一索引 | P1 | S | `#5/#33` 延伸 |
| **D：前端与体验收口** | D1 | 后台外壳 | 管理端 `< 1024px` 侧边栏隐藏但顶栏无移动端抽屉，平板/手机无法切换菜单或退出登录 | P2 | S | `#42` 补遗 |
| **D：前端与体验收口** | D2 | 前台路由 | 普通用户点击「个人资料」`/profile` 跳 `/admin` 触发权限报错；注册页必选的 `/terms`、`/privacy` 页面 `404` | P2 | S | 新增 |
| **D：前端与体验收口** | D3 | 文章阅读 | 详情页 TOC `extractHeadings` 把代码块 `# 注释` 当标题且行内代码锚点失配；Markdown 外链缺 `rel="noopener noreferrer"` | P2 | S | 新增 |
| **D：前端与体验收口** | D4 | 后台重定向 | `/admin/categories` 与 `/admin/tags` 在 Next.js 16 下未 `await searchParams`，导致重定向至 `/admin/taxonomy` 时丢失查询参数 | P2 | S | 新增 |
| **D：前端与体验收口** | D5 | 交互与包体积 | 中文 Slug 触发 `viewTransitionName` 冲突；`NotificationBell` 偶发错误后卡死；`MarkdownEditor` 分屏打字卡顿；首屏 `LoginDialog` 动态拆包与 5 处七牛上传样板收敛 | P2 | M | `#29` 阶段二/三 |

---

## 2. 逐项修复方案与验收标准

### 批次 A：安全、越权与误发布止血（P0 为主，含 A3 顺手收口）

建议执行顺序：`A1 -> A2 + A6 -> A4 -> A5 -> A3`。

#### A1：统一出站 SSRF 防护网关、测源/抓取收口与双格式图片魔数校验
- **涉及位置**：
  - `src/lib/ai-cover-image.ts:105-226, 251-252`（含 Base64 分支 `L106-112`、图片下载 `L114`、DashScope 轮询 `L138`、DashScope 提交 `L162`、OpenAI 兼容生图提交 `L199`）
  - `src/lib/external-content-client.ts:86-127, 176-187`
  - `src/lib/ai-models.ts:392-396`、`src/lib/ai-completion-client.ts:61-97`、`src/lib/openai-compatible-completion-client.ts:193-206, 304-312`
  - `src/lib/ai-news/source-admin.ts:210-222, 304-310, 697`、`src/lib/ai-news/fetchers.ts:187-289, 310-389`
- **根因**：
  1. `ai-cover-image.ts` 内的提交、轮询与结果下载共有 4 处独立裸 `fetch`；其中 `imageToBuffer()` 下载 `url` 时默认跟随重定向、无协议/IP 限制、无真实图片格式校验，随后直传公开七牛 Bucket 并返回 CDN URL，构成完整回显型 SSRF 外带链路；且 `base64` 分支硬编码 `contentType: "image/png"`，未按实际字节识别格式。
  2. `validateExternalUrl()` 仅校验 `http(s):` 与无账密，未阻断回环地址（`127.0.0.0/8`、`::1`）、RFC1918 私网、链路本地（`169.254.0.0/16`）以及**阿里云 ECS 元数据网段 `100.64.0.0/10`（含 `100.100.100.200`）**，外部源一次 `302` 重定向即可穿透。
  3. 后台测源 `testAiNewsSource`（`source-admin.ts:697`）对 `fetch` 包装了 `withFetchTimeout`，导致 `fetchRssItems`（`fetchers.ts:188` `fetchImpl === fetch`）恒为 `false` 而绕过 `ExternalContentClient`（丢失 5 MiB 体积上限与重定向剥离）；HackerNews 与 GitHub Releases 抓取同样绕过了统一客户端。
- **修复方案**：
  1. 新建 `src/lib/ssrf-guard.ts`：校验 URL 协议并基于 `undici` `Agent` 的连接期 `connect`/`lookup` 钩子在 DNS 解析结果层面拦截 `0.0.0.0/8`、`127.0.0.0/8`、`10.0.0.0/8`、`172.16.0.0/12`、`192.168.0.0/16`、`169.254.0.0/16`、`100.64.0.0/10` 及对应 IPv6（`::1`、`fc00::/7`、`fe80::/10`、`::ffff:*`），防 DNS Rebinding（仅在显式测试/本地隔离环境变量开关下放行本地 Mock 上游）。
  2. 将 `ExternalContentClient`、`OpenAICompatibleCompletionClient`、`fetchAiModelJson`、`ai-cover-image.ts` 全部 4 处出站调用，以及 `testAiNewsSource` / `fetchRssItems`、HackerNews（加并发上限 ≤ 6）与 GitHub Releases 抓取全部收口至安全出站层，重定向统一 `manual` 逐跳校验并剥离跨源凭据头。
  3. `imageToBuffer` 对 `url` 与 `base64` 两种返回统一读取字节并按文件头魔数识别真实栅格图片格式（PNG/JPEG/WebP/GIF/AVIF），据此决定上传 `contentType` 与对象后缀，非图片载荷一律拒绝；生图与模型测试上游报错统一经 `scrubUpstreamDiagnostic` 脱敏。
- **验收标准**：从业务调用入口（`generateAiCoverImage`、`testAiNewsSource`、`testAiModelConnection`、`collectDailyAiNewsRawItems`）端到端测试直连与 `302` 跳转至 `127.0.0.1`、`169.254.169.254`、`100.100.100.200`、`[::1]` 全部阻断；测源超 5 MiB 响应被截断拒绝；URL 与 Base64 的 JPEG/PNG/WebP 按真实魔数识别 MIME，伪装 `text/plain` 或非法二进制均不触发七牛上传。

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

#### A6：AI 日报重跑草稿归属校验与待审草稿保护（由原 C1 提级为 P0）
- **涉及位置**：`src/lib/ai-news/run/entry.ts:289-330`、`src/lib/__tests__/ai-news-run-flow.test.ts:282-330`
- **根因**：`runDailyAiNews` 在非 `regenerate` 模式下按 `slug` 查到任何未软删且 `published: false` 的文章时，不检查 `generatedByAiNews` 归属与草稿待审原因，直接调用 `publishAiDraftPost` 将其公开发布并把 `generatedByAiNews` 改写为 `true`（既有测试 `ai-news-run-flow.test.ts:282` 还锁定了该危险行为）。即使下线 `POST /api/posts`（A2），存量草稿与后台人工草稿仍受威胁，且会导致无有效候选的待审 `fallback` 草稿在同日二次触发时被直接发出。
- **修复方案**：
  1. 查询 `existing` 时一并读取 `generatedByAiNews` 及关联运行/审稿状态：若 `existing.generatedByAiNews !== true`，严禁自动发布或改写 `generatedByAiNews`，保留人工草稿原状并明确记录冲突原因返回。
  2. 对 `generatedByAiNews === true` 且处于未发布状态的草稿（如因 0 候选 `fallback` 或未过审而保留的草稿），非 `regenerate` 重跑时保持 `published: false` 待人工审核，不自动调用 `publishAiDraftPost`；同步更新 `ai-news-run-flow.test.ts` 用例契约。
- **验收标准**：同名人工草稿在日报重跑后仍保持 `published: false` 且 `generatedByAiNews: false`；同一天前次因无候选生成的待审草稿在后续非 `regenerate` 重跑后仍保持未发布待审核状态。

#### A4：七牛上传凭证安全策略加固与代码去重
- **涉及位置**：`src/app/api/admin/uploads/qiniu-token/route.ts:19-81`、`src/lib/qiniu-server.ts:20-33`
- **根因**：`sanitizeFilename` 未清洗扩展名 `ext`（允许签发 `.html`/`.svg` 凭证造成同源存储型 XSS，或通过 `a.b/../../x` 注入路径斜杠），且 `putPolicy` 缺少 `fsizeLimit` 与 `mimeLimit`；Token 签名逻辑在两文件中重复实现。
- **修复方案**：
  1. 在 `src/lib/qiniu-server.ts` 统一封装 `createQiniuUploadToken` 与文件名生成，强制匹配扩展名白名单 `/^\.(jpe?g|png|webp|avif|gif)$/`（拒绝 `.svg`、`.html` 及任何含 `/`、`\`、`..` 的输入），并校验请求的 `contentType` 与扩展名一致。
  2. 在客户端直传 `putPolicy` 中加入 `fsizeLimit: 10 * 1024 * 1024`（10 MiB）与 `mimeLimit: "image/jpeg;image/png;image/webp;image/avif;image/gif"`。
- **验收标准**：上传 `.svg`、`.html`、路径穿越文件名或非法 MIME 返回 `400 ValidationError`；解码返回 token 的 `putPolicy` 断言包含 `fsizeLimit` 与 `mimeLimit`。

#### A5：操作审计日志明文泄漏阻断与字段完整性修复
- **涉及位置**：
  - `src/lib/api-operation-log-route.ts:66-87, 142-191`
  - `src/lib/api-operation-logs.ts:276-284, 325-348`
  - `src/lib/api-errors.ts:189-225`
  - `middleware.ts:11-14`、`src/app/api/analytics/visit/route.ts:22-30`
- **根因**：
  1. **敏感原文落库风险**：`readRequestBodySnapshot`（`api-operation-log-route.ts:79-81`）在 `JSON.parse` 失败时直接返回 `{ malformedJson: true, preview: text.slice(0, 512) }`，跳过了 `sanitizeLogPayload`；注册/登录或后台保存模型 `apiKey` 时若请求体 JSON 格式损坏，密码与密钥明文会被直接写入 `api_operation_logs.requestBody`。
  2. **`ipHash` 遗漏与弱哈希**：当前代码 `createApiOperationLog` 在 `model.create({ data })` 中遗漏了 `ipHash: input.ipHash ?? null`（当前版本新写入行恒为 `NULL`；*注：线上历史行是否存在更早版本写入值待生产库统计核实*）；且 `hashIp` 使用无盐 `SHA-256`，IPv4 地址可被彩虹表秒级逆向。
  3. **受控错误丢失原因 & IP 头优先级不一**：各路由捕获异常返回 `toErrorResponse(error)` 后，包装器 `caughtError` 为 `null`，导致受控 4xx/5xx 缺失 `errorName` 和 `errorMessage`；客户端 IP 提取顺序在 `rate-limit.ts`（`x-real-ip` 优先）与其余模块（`x-forwarded-for[0]` 优先）间不一致。
- **修复方案**：
  1. `readRequestBodySnapshot` 在 JSON 解析失败时仅记录 `{ malformedJson: true, byteLength: Buffer.byteLength(text, "utf8") }`，彻底移除 `preview` 原文切片。
  2. 在 `createApiOperationLog` 补齐 `ipHash: input.ipHash ?? null`；将 `hashIp`（含 `visit/route.ts`）统一改为带服务端密钥的 `HMAC-SHA256`；抽离单一 `getClientIp(headers)` 辅助函数并以受控网关覆写的 `x-real-ip` 优先。
  3. 在 `toErrorResponse` 内将 `{ errorName, errorMessage }`（500 未知异常记录经脱敏的摘要）写入 `api-operation-log-context`，由 `withApiOperationLogging` 在 `finally` 中落库；把 11 个向 `toErrorResponse(error, error.message)` 透传原始异常消息的路由改为静态安全兜底文案，并在 `toErrorResponse` 补齐 Prisma `P2025 -> 404` 与 JSON `SyntaxError -> 400`。
- **验收标准**：向注册或模型接口发送含明文密码/`apiKey` 的损坏 JSON，断言数据库日志 `requestBody` 与 `errorMessage` 均不含密码/密钥原文且仅记录 `malformedJson: true`；返回 400/401/404/429/500 时准确持久化非空 HMAC `ipHash`、`errorName` 与脱敏 `errorMessage`。

#### A3：收口 `/api/comments` 未使用的公开 `PATCH / DELETE` 入口（P1，随批次 A 顺手清理）
- **涉及位置**：`src/app/api/comments/route.ts:19-113`
- **根因**：`PATCH` 直接解构 `const { id, content } = await request.json()` 未走 `validation.ts`（漏传 `id` 时 `findFirst` 会读取首条未删评论，随后 `update({ where: { id } })` 因唯一键为 `undefined` 被 Prisma 拒绝抛 500；`DELETE` 已判空 `id`）。实质问题在于：`content` 无类型与长度上限校验、管理员经此入口修改 `APPROVED` 评论不会重置审核状态且修改/删除均未调用 `revalidatePublicContent`，而 `POST` 从不写入 `authorId` 使普通登录读者根本无法使用 `PATCH/DELETE`。
- **修复方案**：评论编辑与删除统一归口至 `/api/admin/comments`，直接移除 `/api/comments` 上的 `PATCH` 与 `DELETE`（仅保留带限流与入参校验的公开 `POST`）。
- **验收标准**：路由测试确认 `/api/comments` 仅暴露 `POST`，不再保留无校验的 `PATCH/DELETE` 写面。

---

### 批次 B：核心业务闭环、网关与部署可靠性（P1 上半）

> **交付解耦原则**：`B2` 纯化为网关与传输层配置变更，不与业务接口异步化绑死；Newsletter 与 AI 日报的 `202` 异步触发及重启恢复语义分别归入 `B1` 与 `C1` 独立验收。

#### B1：Newsletter 退订/验证链路修复、异步重启核对衔接与发信器对齐
- **涉及位置**：
  - `src/lib/newsletter-renderer.ts:36, 56`
  - `src/app/api/newsletter/unsubscribe/route.ts:8-39`、`verify/route.ts:7-35`、`subscribe/route.ts:46-54`
  - `src/app/api/admin/newsletter/campaigns/[id]/send/route.ts:16-18`、`retry/route.ts:16-18`、`src/lib/newsletter-delivery-execution.ts:99-181`
  - `src/lib/newsletter-mailer.ts:51-81`、`.env.example:78-79`
- **修复方案**：
  1. 新增公开确认页 `src/app/(public)/newsletter/unsubscribe/page.tsx` 与 `verify/page.tsx`，邮件正文链接指向确认页并由按钮发起 `POST`（解决点击退订 `405` 及企业邮箱扫描预抓 `GET` 误激活）；同时在 `POST /api/newsletter/unsubscribe` 兼容 URL query / 表单 `token`，邮件头附带 `List-Unsubscribe` 与 `List-Unsubscribe-Post: List-Unsubscribe=One-Click`（RFC 8058）。
  2. 为 `/api/newsletter/verify` 补齐 `checkInteractionRateLimit` 与验证 token 过期时间（如 48h）；`/api/newsletter/subscribe` 返回统一模糊提示防订阅邮箱枚举。
  3. 在 `#11` 独立 Worker 落地前，若将后台 `send` / `retry` 改为冻结受众与 `SENDING` 状态落库后立即返回 `202 Accepted`，必须完整保留现有 P2-03 恢复契约：收到 `202` 后若进程立即重启，管理员按 `campaignId` 找回 `SENDING` 活动，确认旧发送进程已停止后调用 `recoverSendingNewsletterCampaign`（`senderStopped: true`）将中断的 `sending` 行转为 `unknown` 交人工凭据核对（`reconcile`），继续发送仅消费 `pending`、失败重试仅消费 `failed`，**严禁自动重发 `unknown`**。
  4. 修正 `.env.example` 中无效的 `NEWSLETTER_PROVIDER="console"`（对齐 `"log"`），接入真实邮件供应商前在后台明确标识模拟状态，隐藏或接通未消费的 `scheduledAt`。
- **验收标准**：`GET` 访问退订/验证链接渲染确认页且不改库，确认或 One-Click `POST` 成功生效；触发异步发送收到 `202` 后模拟进程中断，按 `campaignId` 可找回状态并将途中的 `sending` 转为 `unknown` 待核对，继续发送只发剩余 `pending` 且不重发 `sent` / `unknown`。

#### B2：生产 HTTPS 终结与 Nginx 代理超时/连接头加固（纯网关层）
- **涉及位置**：`deploy/nginx.my-next-app.conf:1-15`、`.github/workflows/daily-ai-news.yml`、`.github/workflows/log-retention.yml`、`.github/workflows/publish-scheduled.yml`
- **现状说明**：仓库内 `nginx.my-next-app.conf` 目前仅监听 80 端口，三个定时工作流均保留了 `|| 'http://47.98.167.32'` 明文回退（*注：GitHub 线上 `production` environment 中 `PRODUCTION_BASE_URL` 当前实际配置为 `http://` 还是 `https://` 待线上配置核实*）。
- **修复方案**：
  1. 在 Nginx 终结 TLS（`listen 443 ssl http2;`，80 端口除 ACME 验证外 `301` 跳转 HTTPS），使生产会话启用 `__Secure-` / `Secure` Cookie。
  2. 移除三个定时工作流中的 `http://47.98.167.32` 明文回退，在脚本入口校验 `PRODUCTION_BASE_URL` 必须以 `https://` 开头并传 `curl --proto '=https' --tlsv1.2 --max-time 30`。
  3. Nginx 增加 `map $http_upgrade $connection_upgrade`（修复非 WebSocket 请求的上游 keepalive）、`server_tokens off;`、`client_max_body_size 10m;`，并为同步 AI 交互端点（`/api/admin/ai/`、`/api/admin/covers/generate`、`/api/admin/posts/`、`/api/ai/drafts`）单独配置 `proxy_read_timeout 180s;`。
- **验收标准**：`nginx -t` 校验通过；工作流传入非 `https://` 地址时立即非零失败退出；HTTPS 下会话 Cookie 带 `Secure` 属性且长耗时 AI 接口在 60–150s 窗口内不触发 Nginx `504`。

#### B3：部署流水线加固与迁移/探针失败恢复演练
- **涉及位置**：`.github/workflows/deploy.yml:55-177`、`scripts/deploy/deploy-remote.sh:33-88`、`scripts/deploy/backup-production.sh:11-61`、`docs/deployment/p2-recovery-runbook.md:7-20`、`Dockerfile:43-61`、`docker-compose.prod.yml:1-22`
- **根因与停服边界**：除 `inputs.ref` 与 `${{ github.sha }}` 错位、`source .env` Shell 解析风险与 `prisma db push` 兜底风险外，`backup-production.sh:59` 在备份校验通过后会**主动执行 `docker stop` 停止旧容器**以终止进程内发送者；因此即便将 `current` 软链延后切换，一旦后续数据库迁移或新容器健康检查失败，线上仍处于已停服状态，必须依赖可验证的人工恢复流程闭环。
- **修复方案**：
  1. 在 `deploy.yml` 检出后以 `RESOLVED_SHA=$(git rev-parse HEAD)` 替代 `${{ github.sha }}` 作为发布目录与 `RELEASE_SHA`；仅在健康门禁通过后更新 `current` 软链。
  2. 移除 `deploy.yml` 与 `deploy-remote.sh` 中的 `source app.env/.env`（改用 Node `dotenv.parse` 安全读取标量配置），追加密钥前确保换行；用预置 `DEPLOY_KNOWN_HOSTS` 替代动态 `ssh-keyscan`；为三个定时 workflow 补齐 `concurrency` 防重叠。
  3. 移除 `deploy-remote.sh:80` 的 `pnpm prisma db push` 兜底（缺迁移目录直接 `exit 1`）；支持首次部署或旧容器已停止时从 `shared/.env` 安全读取连接串执行备份。
  4. 补充保留策略（仅保留最近 5 个 `releases/*`、`backups/*.dump` 与 `my-next-app:pre-*` 镜像标签），配置 `init: true` 与容器日志轮转，并将 `Dockerfile` 迁至 `output: "standalone"` + `USER node`。
- **验收标准**：脚本测试覆盖含 `$`/`!` 特殊字符 `.env`、缺失迁移目录失败退出与 `RESOLVED_SHA` 一致性；**新增部署故障恢复演练**：分别在旧容器停止后注入迁移失败与健康检查失败，按 `p2-recovery-runbook.md` 核对数据库 schema 与旧版兼容性后拉起保留的 `my-next-app:pre-<sha>-<ts>` 镜像，必须以服务重新通过 `/api/health/ready`（`running healthy`）作为验收通过条件。

#### B4：PostgreSQL 连接池默认值、日志保留短路与过期数据裁剪
- **涉及位置**：`src/lib/prisma.ts:41-45`、`src/lib/api-operation-log-retention.ts:18-36`、`src/lib/rate-limit.ts:51-68`
- **修复方案**：
  1. `readPoolMax()` 在生产环境未显式配置 `DATABASE_POOL_MAX` 时默认设为 `8`（测试/构建环境保持 `1–2`），同步更新 `.env.example` 与 `README.md`。
  2. 在 `runApiOperationLogRetention` 第 19 行拿到 `before` 统计后，若 `before.bytes <= maxStorageBytes` 立即短路返回 `status: 'completed'`，消除稳态下每 15 分钟无意义的窗口函数全表扫描与二次统计。
  3. 将 `rate_limit_entries` 声明进 `prisma/schema.prisma`（对齐 `#29` 5.4），并在 `log-retention` 定时任务中顺带执行 `DELETE FROM rate_limit_entries WHERE reset_at <= NOW()`；同时对内存态 `createMemoryRateLimiter` 与 `aiSearchCache` 增加最大键数上限与惰性清理。
- **验收标准**：PG 集成测试验证未超限时清理删除行数为 0 且跳过重扫描、超限时行为不变，且过期限流行被正确清理。

---

### 批次 C：AI 流水线止血、缓存/软删一致性与权限数据层（P1 下半）

#### C1：独立 Worker（`#11/#8/#15`）落地前的 AI 批处理与日报异步恢复止血
- **涉及位置**：
  - `src/lib/ai-batch-jobs.ts:272-293`、`src/lib/ai-tasks.ts:121-140`
  - `src/lib/ai-news/run/entry.ts:269-292`、`src/app/api/cron/ai-news/route.ts:56-157`、`src/app/api/admin/ai-news/run/route.ts:70-88`、`.github/workflows/daily-ai-news.yml:58-84`
  - `src/lib/ai-news/run/steps.ts:335-370`
  - *(注：原 `C1.5` 测源与 HN/GitHub 抓取收口已提级并入 `A1`；原日报重跑误发草稿已提级为 `A6`。)*
- **修复方案**：
  1. `resumeAiBatchTasks()` 无 `taskId` 分支补上 `status: { in: ["QUEUED", "RUNNING"] }`，避免被最近 10 条已完成任务遮蔽；将 GET 接口中的 `?resume=1` 写副作用拆到显式 `POST` 恢复入口，并限制单进程批处理并发度（如最多 3 项并发）。
  2. `resolveTaskStatus()` 当 `succeeded === 0 && failed === 0 && skipped > 0` 时不再判为 `SUCCEEDED`（避免对 0 成功任务发送“AI 任务已完成”通知）。
  3. 日报执行与异步 `202` 持久化契约：`runDailyAiNews` 增加基于日期的 PostgreSQL advisory lock（拦截 Cron 与后台手动并发双跑）及超时僵尸 `RUNNING` 判定回收；Cron 与后台手动异步触发均须**先在数据库创建 `AiNewsRun` 记录拿到 `runId` 后再返回 `202 Accepted`**，`daily-ai-news.yml` 改为按 `runId` 精确轮询。（*边界说明：进程重启后的自动无感后台续跑归 `#11 -> #8/#15` 独立 Worker 拥有；本阶段保证重启后按 `runId` 可查到中断记录并能幂等重跑恢复。*）
  4. 在 `"candidate-pipeline"` 正常模式下移除 `steps.ts:335` 废弃正文的 6000-token `generateDailyAiNewsDraft` 调用（标题直接由 `editorialBrief` 产出）；当候选为 0 落入 `"fallback"` 模式时默认保存为未发布草稿待人工审核（配合 `A6` 确保后续重跑不误发）。
- **验收标准**：10+ 历史完成任务下仍能找回旧 `QUEUED` 任务；Cron/手动收到 `202` 后立即模拟进程重启，按返回的 `runId` 可查到该次运行、超时后可将僵尸 `RUNNING` 标记回收并通过重跑恢复完成；并发双触发互斥不撞 `P2002`。

#### C2：公共页动态退化修复、无库构建首访真值与软删失效闭环
- **涉及位置**：
  - `src/app/(public)/posts/page.tsx:1, 35-36`、`categories/[slug]/page.tsx:1, 43-49`、`tags/[slug]/page.tsx:1, 43-49`
  - `src/app/(public)/about/page.tsx`、`contact/page.tsx`、`src/app/llms.txt/route.ts`、`src/app/api/ai/openapi/route.ts`
  - `src/lib/cache.ts:9-27, 106-137`、`src/lib/topic-guides.ts:178-241`、`src/app/api/admin/series/route.ts:152-186`
  - `src/lib/posts.ts:149-151`、`src/lib/public-search.ts:128-139`、`src/lib/ai-authoring.ts:550-560, 651-662`
- **修复方案**：
  1. 为公共数据读取函数（文章分页、分类/标签目录与详情、站点设置、公开作者资料）封装 `unstable_cache`（300s TTL + 语义化 `tags`，对齐 `#29` 阶段二），解决 `await searchParams` 使路由级 `revalidate = 300` 退化为每次请求打库的问题。
  2. **对齐无库构建与首位访客要求**：单纯添加 `export const revalidate = 300` 在 Next.js stale-while-revalidate 语义下仍会让容器启动后的首位访客拿到构建期固化的兜底文案（`"My Blog"` / `"Inkforge Author"`）。对于 `/about`、`/contact`、`/llms.txt`、`/api/ai/openapi`，改为跳过无 `DATABASE_URL` 构建期的静态假数据固化（运行期动态渲染直接消费第 1 步的 300s `unstable_cache`，或在 `deploy-remote.sh` 健康门禁后执行首轮预热失效），保证启动后首位访客即看到数据库真实配置，同时稳态请求命中缓存不重复打库。
  3. 补齐 `TopicGuide` 创建/更新/软删对 `/guides`、`/guides/[slug]` 及 `/sitemap.xml` 的缓存失效，并将已发布导读纳入 `sitemap.ts`；`Series` 软删时在同事务清空关联文章的 `seriesId = null` 并重验证受影响文章页；补齐 `getPublishedPostsPage` 分类筛选、`public-search.ts` 标签/分类关联及 `createAdminPost/updateAdminPost` 写入时的 `deletedAt: null` 校验。
- **验收标准**：模拟 Docker“无 `DATABASE_URL` 执行 `next build` → 配置真实库执行 `next start`”，验证启动后的**第一个 HTTP 请求**即返回数据库中的真实站点名称与作者资料（而非 `"My Blog"`）；TopicGuide 与 Series 变更后前台立即刷新且无残留软删引用。

#### C3：直读敏感数据的后台 RSC 与独立令牌 `AiApiClient` 角色校验及邮箱隔离
- **涉及位置**：`src/lib/auth.ts:135-158`（既有基线）、`src/app/admin/page.tsx`、`src/app/admin/settings/page.tsx`、`src/lib/ai-auth.ts:64-75`、`src/lib/public-profile.ts:9-19`
- **现状边界**：`src/lib/auth.ts:135-158` 的 `jwt` 回调已在每次调用 `getServerSession` 时实时查库刷新 `role` 并拦截已删用户（已有 `auth-session` 单测覆盖），无需重复改造常规会话接口；真正绕过该检查的是不调 `getServerSession`（或未校验 `ADMIN`）的后台 RSC 页面与独立 Bearer 令牌。
- **修复方案**：
  1. 抽取带 `React.cache` 的 `requireAdminPageSession()`，在直接查询敏感业务数据的后台服务端 `page.tsx`（如 `admin/page.tsx`、`admin/settings/page.tsx`）入口调用，堵住客户端 RSC 切页不重跑 `admin/layout.tsx` 且 `middleware.ts` 仅做无状态 JWT 解码的窗口。
  2. 在独立于 NextAuth 会话的 `requireAiClient`（`src/lib/ai-auth.ts:64-75`）查询条件中增加 `owner: { role: 'ADMIN' }`，确保账号降权后其持有的外部 Agent Token 立即失效。
  3. `getPublicProfile()` 改为仅读取 `BlogSettings` 公开配置邮箱或 `NEXT_PUBLIC_CONTACT_EMAIL`，不再回退暴露管理员登录表 `User.email`。
- **验收标准**：管理员在数据库中降权为 `USER` 后，持原 Cookie 请求后台敏感页 RSC payload 或持原 `AiApiClient` Token 请求 `/api/ai/drafts` 均立即被拒；公开页 HTML 不含管理员登录账号私有邮箱。

#### C4：列表大字段裁剪（保留 AI 搜索受限摘要）、本地无库单测修复与种子脚本补齐
- **涉及位置**：`src/lib/public-search.ts:207-214`、`src/app/api/search/route.ts:130-138, 237`、`src/app/api/admin/posts/route.ts:78-93`、`src/app/(public)/series/[slug]/page.tsx:28-45`、`src/lib/topic-guides.ts:243-257`、`src/app/api/admin/posts/metadata/__tests__/route.test.ts`、`src/app/api/admin/posts/review/__tests__/route.test.ts`、`scripts/seed-mock-posts.cjs`
- **修复方案**：
  1. 将 `/api/admin/posts`、`/series/[slug]`、`/guides/[slug]` 中的 `Post` `include` 替换为不含 `content`（`@db.Text`）的窄 `select`。
  2. **搜索裁剪兼顾 AI 候选摘要**：`src/app/api/search/route.ts:130-138` 的 `generateAiSearchResult` 需要读取候选文章正文前 220 字构造 `snippet`（尤其当文章 `excerpt` 为空时）。内部搜索查询改为仅提取有长度上限的正文前缀（如 SQL `LEFT("content", 240)` 或仅对前 8 条候选读取受限前缀），并在对外序列化 `/api/search` 公开响应时剔除完整 `content` 与内部管理字段。
  3. 为 `metadata/__tests__/route.test.ts` 与 `review/__tests__/route.test.ts` 补齐无 `DATABASE_URL` 时的模型解析 mock/回退，消除本地无库跑 `pnpm test` 时仅剩的 6 个失败用例；参照 `#33` 将 `scripts/seed-mock-posts.cjs` 改为基于 `deletedAt: null` 的幂等查找更新。
- **验收标准**：无 `.env` / `DATABASE_URL` 环境下运行 `pnpm test` 100% 全绿；`/api/search` 与 `/api/admin/posts` 公开响应不含完整 `content`，且 `excerpt` 为空的文章在开启 AI 搜索时仍能正常生成带正文前 220 字上下文的推荐结果。

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

#### D4：Next.js 16 分类/标签后台重定向 `await searchParams` 修复
- **涉及位置**：`src/app/admin/categories/page.tsx:25-33`、`src/app/admin/tags/page.tsx:25-33`
- **现状说明**：前台分类与标签详情页的分页组件已在 PR `#42`（`TaxonomyPostGrid.tsx:68-75` 与 `taxonomy-redirects.test.tsx:193`）落地，无需重复建设；仅剩后台旧路由重定向页未适配 Next.js 16 异步 `searchParams`。
- **修复方案**：将 `AdminCategoriesRedirectPage` 与 `AdminTagsRedirectPage` 的 `searchParams` 类型修正为 `Promise<SearchParams>` 并 `await` 后再拼接查询串跳转 `/admin/taxonomy`。
- **验收标准**：访问 `/admin/categories?q=ai&page=2` 与 `/admin/tags?q=llm` 重定向后完整保留原始查询参数与对应 `tab`。

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
| `#2` 操作日志移出热路径 | 主体已落地；本计划 **A5** 阻断损坏 JSON 明文落库并补写 HMAC `ipHash`/错误详情，**B4** 增加未超限短路优化与 `rate_limit_entries` 清理 |
| `#5` 公共搜索排序分页 / `#9` Route Handler 护栏 | 独立推进；本计划 **C2** 先修软删标签/分类泄露，**C4** 剔除公开响应完整正文但保留 AI 排序所需的 220 字受限摘要 |
| `#6` 运行配置窄 getter + ratchet | 独立推进；本计划 **B4** 的默认连接池调整直接消费同一数据库配置入口 |
| `#7` 健康探针与部署等待 | Web 端已落地；本计划 **B3** 补齐 `deploy.yml` SHA 错位、`.env` 安全解析与停旧容器后的故障恢复演练 |
| `#10` 状态列 CHECK 约束 | 独立推进（按 `#10` 顺序先覆盖 `CoverAsset` 与 `TopicGuide`） |
| `#16 -> #17 -> #11 -> #8/#15` 持久化 Worker 链 | 长期架构主线（拥有跨重启自动无感续跑能力）；本计划 **A6** 先修日报重跑误发草稿，**C1** 做零表结构变更的状态过滤、互斥锁与持久化 `runId` 重启可找回止血，不新建第二套队列 |
| `#12` 后台授权读数据库实时角色 | `auth.ts` `jwt` 回调已覆盖常规会话读取；本计划 **C3** 补齐未自检会话却直读敏感数据的后台 RSC `page.tsx` 与独立令牌 `AiApiClient` |
| `#14` 外部调用可靠性与 Completion 收口 | 本计划 **A1**（生图全链路、模型、RSS 测源、HN/GitHub 出站 SSRF 网关与图片魔数识别）直接作为 `#14` 的安全与覆盖面闭环 |
| `#29` 三阶段改进总图 / `#35` 覆盖率与 E2E 门禁翻转 | 阶段一（`#30–#34`）已随 PR `#36` 合入；本计划 **A/B/C/D** 补齐审查新发现的安全/业务缺陷，并与 `#29` 阶段二/三并行不悖 |

### 3.2 每个交付单元的验收门禁

1. **先写失败回归测试再写修复**：安全拦截（A1/A2/A4/A5/A6）、事务与锁（B4/C1）、重启恢复与回退演练（B1/B3/C1）均需有可复现的前置失败用例或脚本演练。
2. **全套静态与单测门禁必过**：`pnpm lint`（0 error）、`pnpm typecheck`、`pnpm test`、`pnpm vitest run --config vitest.integration.config.ts`、`pnpm build`。
3. **契约测试同步更新**：涉及公共页缓存与首访语义（C2）、API 错误响应与脱敏（A2/A3/A5）、环境变量（B1/B4）的改动必须同步更新对应 `*-contract.test.ts`。
4. **文档生命周期**：全部批次实施验收完毕后，将本文移入 `docs/archive/` 并更新 `docs/README.md` 索引。

---

## 4. 审查修订记录

- **2026-11-22（实施前独立审查纠偏）**：
  1. 新增 **A6（P0）**：修复 `runDailyAiNews`（`!regenerate`）无条件发布同 slug 未发布文章并改写 `generatedByAiNews` 的问题，保护同名人工草稿与无候选待审 `fallback` 草稿。
  2. 扩充 **A1（P0）**：覆盖 `ai-cover-image.ts` 全部 4 处出站 `fetch`，将原 `C1.5`（RSS 测源绕过 `ExternalContentClient` 及 HN/GitHub 抓取收口）提前并入 `A1`，并对 URL 与 Base64 两种图片统一按魔数识别格式。
  3. 扩充 **A5（P0）**：阻断 `readRequestBodySnapshot` 在 JSON 解析失败时记录 512 字符未脱敏原文（防密码/`apiKey` 落库），并修正 `ipHash` 历史数据断言口径。
  4. 拆分 **B2** 与 **B1/C1**：`B2` 纯化为网关/TLS 变更（并修正线上生效协议待核实口径）；`B1/C1` 明确 `202` 返回前持久化 ID 及进程重启后可找回恢复的边界（Newsletter 保留 `sending -> unknown` 人工核对语义，不自动重发）。
  5. 补充 **B3** 验收：针对 `backup-production.sh` 停旧容器后的停服窗口，增加迁移/健康门禁失败后核对 schema 兼容性并拉起保留镜像通过 `/api/health/ready` 的演练。
  6. 修正 **A3** 依据并下调为 **P1**：删除“漏传 `id` 篡改首条评论”表述（`update` 会因缺唯一键被 Prisma 拒绝），保留随批次 A 移除未使用的公开 `PATCH/DELETE`。
  7. 收窄 **C3** 范围：确认 `auth.ts` `jwt` 回调已覆盖常规会话刷新，聚焦直读敏感数据的后台 RSC `page.tsx`、独立令牌 `AiApiClient` 与公开页脚管理员邮箱隔离。
  8. 修正 **C2** 首访语义：摒弃单纯依赖构建期兜底 + `revalidate = 300`，要求无库构建、连库启动后的首个响应即返回数据库真实配置。
  9. 细化 **C4** 搜索裁剪：公开响应剔除完整 `content`，内部查询保留 220 字受限前缀供 AI 搜索构造摘要（覆盖 `excerpt` 为空的文章）。
  10. 精简 **D4**：移除 PR `#42` 已落地的前台分类/标签分页重复项，仅保留后台重定向未 `await searchParams` 修复。

---

## 5. 实施完成与归档记录（2026-11-22）

本文全部 **19 个修复单元（A1–A6、B1–B4、C1–C4、D1–D5）** 已按批次完成开发、CI 门禁（`validate` + `e2e`）与每轮合并前真实浏览器联调实测，并全部合入 `main`：

| 批次 | 单元 | 合入 PR | 关键交付摘要 |
| --- | --- | --- | --- |
| **A：安全与越权止血** | A6 | [#53](https://github.com/RoyDust/ai-blog/pull/53) | 保护同名人工草稿（`generatedByAiNews: false`）与待审 `fallback` 日报草稿不被 `runDailyAiNews` 误发或覆盖 |
| **A：安全与越权止血** | A2, A3, A4 | [#54](https://github.com/RoyDust/ai-blog/pull/54) | 下线遗留 `/api/posts` 与 `/api/comments` 无校验写面（`405`）、移除孤儿路由、收窄公开文章 `select`、补齐七牛上传扩展名/MIME/`fsizeLimit` 策略 |
| **A：安全与越权止血** | A5 | [#55](https://github.com/RoyDust/ai-blog/pull/55) | 阻断损坏 JSON 明文凭据写入 `api_operation_logs`、补写 HMAC-SHA256 `ipHash`、脱敏 500 错误详情、收口 `P2025 -> 404` / `SyntaxError -> 400` |
| **A：安全与越权止血** | A1 | [#56](https://github.com/RoyDust/ai-blog/pull/56) | 统一出站 SSRF 防护网关（含阿里云 ECS `100.100.100.200`、DNS 重绑定校验、重定向复检）及 URL/Base64 双格式图片魔数识别 |
| **B：闭环与基础设施** | B2 | [#57](https://github.com/RoyDust/ai-blog/pull/57) | Nginx TLS 1.2/1.3 + HTTP/2、80->443 跳转、WebSocket `map`、AI 路由 180s 读超时；移除全部 cron 明文 `http://` 回退并补齐 `concurrency` |
| **B：闭环与基础设施** | B4 | [#58](https://github.com/RoyDust/ai-blog/pull/58) | PostgreSQL 生产默认连接池调至 `8`、操作日志未超限短路与 `rate_limit_entries` 过期清理、内存限流与 AI 搜索缓存容量上限 |
| **B：闭环与基础设施** | B1 | [#59](https://github.com/RoyDust/ai-blog/pull/59) | Newsletter 验证/退订确认页（`GET` 零写库防预抓）、RFC 8058 一键退订、48h 令牌过期、防枚举响应与 `202` 异步发信衔接 `unknown` 人工核对 |
| **B：闭环与基础设施** | B3 | [#60](https://github.com/RoyDust/ai-blog/pull/60) | `deploy.yml` 精确 `RESOLVED_SHA` 与健康检查后 `current` 原子切链、NUL 分隔安全解析 `.env`、`DEPLOY_KNOWN_HOSTS`、移除 `prisma db push` 兜底、非 root `standalone` 镜像与恢复演练 |
| **C：AI、缓存与数据层** | C3 | [#61](https://github.com/RoyDust/ai-blog/pull/61) | 8 个直读后台敏感数据的 RSC `page.tsx` 与 `AiApiClient` 补齐数据库实时管理员角色校验；公开页脚隔离管理员登录邮箱 |
| **C：AI、缓存与数据层** | C4 | [#62](https://github.com/RoyDust/ai-blog/pull/62) | 管理列表/系列详情剔除完整 `Post.content`、公共搜索剔除正文并保留 AI 搜索 240 字受限摘要、修复无库环境 6 个单测与 `seed-mock-posts.cjs` |
| **C：AI、缓存与数据层** | C2 | [#63](https://github.com/RoyDust/ai-blog/pull/63) | 公共读取 300s `unstable_cache` + 语义 tag 精准失效、无库构建后连库首访返回真实配置（不缓存 `"My Blog"` 兜底）、`TopicGuide`/`Series` 软删与 `sitemap.ts` 对齐 |
| **C：AI、缓存与数据层** | C1 | [#64](https://github.com/RoyDust/ai-blog/pull/64) | `resumeAiBatchTasks` 活跃状态筛选 + `POST` 恢复分离 + 并发上限 `3`、全跳过置 `PARTIAL_FAILED`、日报 PG 咨询锁 + 15m 僵尸回收 + `202` 预持久化 `runId`、移除冗余 6000-token 草稿生成 |
| **D：前端与体验收口** | D1, D4 | [#65](https://github.com/RoyDust/ai-blog/pull/65) | 管理后台 `< 1024px` 移动端抽屉导航与退出登录入口；分类/标签后台重定向补齐 `await searchParams` 参数透传 |
| **D：前端与体验收口** | D2 | [#66](https://github.com/RoyDust/ai-blog/pull/66) | 独立前台 `/profile` 读者个人资料页（消除误跳 `/admin` 报错）、补齐 `/terms` 与 `/privacy` 协议页及顶栏/页脚 `/guides` 专题导航 |
| **D：前端与体验收口** | D3 | [#67](https://github.com/RoyDust/ai-blog/pull/67) | 文章详情 TOC 围栏代码块 `#` 注释过滤、行内 Markdown 剥离与锚点 ID 对齐、正文外链 `_blank` + `noopener noreferrer` 与危险协议降级 |
| **D：前端与体验收口** | D5 | [#68](https://github.com/RoyDust/ai-blog/pull/68) | 非 ASCII `viewTransitionName` 短哈希去重、`ArticleToc` `LayoutGroup` 隔离、通知 SWR `onSuccess` 错误自愈、`MarkdownEditor` 延迟预览、5 处客户端七牛上传收敛与 `BookmarkButton` 无水合闪烁 |
