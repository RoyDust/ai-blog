# E2E 全量回归计划（2026-09-20）

> 2026-09-20 审查修订：对照实际代码修正 E02/E10/E16–E22/E26 断言（详见用例表内注释），基础设施改为 storageState + seed admin + 本地 mock server，新增限流与 ISR 风险。本计划只解决 E2E；MIT 许可已落地（`LICENSE` + 中英 README + `package.json` license 字段）。

> 2026-09-24 实施完成：32/32 通过（3.9 分钟，单 worker chromium）。落地内容：
> - `playwright.config.ts`：setup project（global-setup.spec.ts UI 登录一次产 `e2e/.auth/admin.json` storageState）+ chromium project 复用；`E2E_SERVER_COMMAND` 支持 CI 跑 `pnpm start`。
> - `e2e/helpers.ts`（uniqueSlug/uniqueEmail/createPostViaApi/deletePostViaApi——DELETE 走 query `?ids=`，createCategory/TagViaApi）、`e2e/mock-upstream.ts`（本地 RSS feed + OpenAI 兼容端点，按 system prompt 关键词区分评分 JSON / 日报草稿 JSON / 纯文本）。
> - `scripts/seed-e2e-admin.cjs`（bcrypt upsert ADMIN）。
> - 15 个 spec 文件、32 用例覆盖 E01–E27；CI 新增非阻塞 e2e job（`continue-on-error: true`，稳定后移除）。
> - 已知问题（另行处理）：①`scripts/seed-categories.cjs`/`seed-tags.cjs` 在 partial-unique-index 迁移后失效（upsert where slug 不再是唯一约束）；②admin/posts 列表筛选记忆在 Next dev + storageState origin 恢复组合下 reload 不恢复 UI（localStorage 写入契约正常，单测路径正常），E07 只锁写入契约；③前台详情 `notFound()` 在 dev 返回 200 渲染 not-found 内容，E10 断内容而非状态码。

## 现状

- `e2e/` 仅 3 个 stub：`admin.spec.ts`（未登录跳登录）、`reader.spec.ts`（首页/`/posts` 可见）、`author.spec.ts`（`/write` 未登录跳登录）。
- `playwright.config.ts`：`testDir: ./e2e`，单 chromium、单 worker、串行，`webServer: pnpm dev` + `reuseExistingServer: true`。
- CI（`ci.yml`）只跑 lint + `vitest run` + build，**不跑 E2E**；E2E 无 PG seeding、无登录夹具、无清理策略。
- 后台已有强 Vitest 组件测试（`src/app/admin/__tests__/`：posts-workbench、comments、taxonomy-studio、covers、newsletter、topic-guides、series、ai-news 等），E2E 不得重复断言组件内态，只断言用户可观察行为。

## 目标

覆盖前台阅读、认证、创作、后台全模块（文章/评论/分类/标签/系列/专题/封面/AI 模型·任务·新闻/Newsletter/通知/日志/设置）主链路，接入 CI 门禁，本地 `pnpm test:e2e` 一键可跑。

## 非目标

- 不测 AI 生成内容质量（摘要/评分/成文只断任务状态流转与落库，不判语义）。
- 不做多浏览器矩阵（保持仅 chromium）、不做性能/Lighthouse、不做图片供应商真实上传（七牛走 mock/跳过）。
- 不碰 `middleware` 内部密钥语义（已有 `internal-api-protection-coverage` 单元契约锁定）。

## 基础设施变更（P0，先行）

1. **登录走 Playwright storageState，不是每用例登录**。`checkAuthRateLimit` 是 5 次/分/IP（`rate-limit.ts`），E2E 全程 127.0.0.1，逐用例 `loginAsAdmin` 第 6 次就 429。改为：`playwright.config.ts` 加 `projects: [{ name: 'setup', testMatch: /global-setup/ }, { name: 'chromium', dependencies: ['setup'], use: { storageState: 'e2e/.auth/admin.json' } }]`，setup 里经 UI 或 `signIn` 流程登录一次（Credentials provider 直查 bcrypt，密码 ≥8 位）。E04 注册用例用时间戳邮箱，单次不触限。
2. **CI admin 账号必须 seed**。migrate deploy 后跑 `scripts/` 新增的 `seed-e2e-admin.cjs`：`DATABASE_URL` 直连，bcrypt 哈希环境变量注入的密码，upsert `role: ADMIN` 固定邮箱（如 `e2e-admin@test.local`）。密码经 GH Secrets 注入，账号邮箱不入 Secrets（测试域邮箱无敏感）。
3. `e2e/helpers.ts`：`uniqueSlug(prefix)`、`createDraftPost(request, …)`（走 `/api/admin/posts`）、`deletePost(request, id)` 清理、`seedCategory/seedTag`（复用 `scripts/seed-categories.cjs` catalog 语义）。测试 slug/邮箱统一 `e2e-` + 时间戳前缀，用例末清理。
4. **CI E2E job 与 webServer 冲突要解决**：`playwright.config.ts` 的 `webServer.command` 硬编码 `pnpm dev`，CI 要跑 `pnpm start`——改为读 `process.env.E2E_SERVER_COMMAND ?? 'pnpm dev'`，CI 设 `E2E_SERVER_COMMAND="pnpm start"`（build 之后）。CI 首轮 E2E job 设为**非阻塞**（`continue-on-error: true` 或独立 notify-only job），两三批稳定后再纳入必过门禁。
5. **AI/Newsletter mock 策略**：Batch 3 用例在 Playwright 测试进程内起本地 mock http server（RSS feed + OpenAI-compatible completion 两个端点），模型/源的 baseUrl 指向 `http://127.0.0.1:<port>`（`validateExternalUrl`/`validateUrl` 均允许 localhost，Next 服务可达测试进程端口）。Newsletter 验证 token 在 API 响应与日志里均被脱敏，验证步骤由测试进程直连 PG 读 `newsletter_subscribers.verification_token`（CI 已有 `DATABASE_URL`）。
6.  E2E 专用 seed：保证分类/标签存在（复用现有 catalog）；测试文章统一前缀，避免污染 dev 库。

## 用例矩阵（按批次交付）

### Batch 1：冒烟 + 阅读 + 认证（5 条，门禁）

| # | 用例 | 断言 |
|---|------|------|
| E01 | 首页→文章详情 | 首页可见唯一 H1/精选入口；点进详情阅读进度/目录出现，无横向溢出（`document.documentElement.scrollWidth <= innerWidth`） |
| E02 | `/posts` 筛选+无限滚动 | 分类/标签/搜索词过滤列表变化；滚动触底加载下一页（`useInfinitePosts` 无页码 URL，勿断言翻页链接）；筛选变化重置列表 |
| E03 | 未登录访问 `/admin` | 跳登录（`login=1` + `callbackUrl=%2Fadmin`），与现有 stub 一致并保留 |
| E04 | 注册→登录→登出 | 注册新账号后可登录；登出后 `/write` 重新跳登录 |
| E05 | 评论发表→后台审核 | 前台发表评论（PENDING）；管理员登录后台审核通过后前台可见 |

### Batch 2：创作与内容后台（10 条）

| # | 用例 | 断言 |
|---|------|------|
| E06 | `/write` 建草稿→发布 | 登录后写草稿、发布，前台 `/posts/[slug]` 可见 |
| E07 | `admin/posts` 列表筛选 | 状态过滤/搜索/分页，localStorage 筛选记忆（`useFilterMemory`）刷新保持 |
| E08 | 文章工作台编辑 | 打开工作台改标题/分类/标签/excerpt，保存成功 toast + 重新取数 |
| E09 | 定时发布 | 设未来 `scheduledAt`，列表显示定时态；cron 语义由单元覆盖，E2E 只断展示 |
| E10 | 软删除 | 删除后前台详情 404（软删除过滤 + revalidate）、后台默认列表消失；记录保留可审计。注：当前无恢复功能（无 restore 端点/UI），不断言恢复 |
| E11 | 评论管理 | 批准/拒绝/标 SPAM，状态即时变化 |
| E12 | 分类 CRUD | 新建→改名→删除，文章分类下拉同步 |
| E13 | 标签 CRUD | 同上，颜色字段可选 |
| E14 | 系列管理 | 新建系列、文章入系排序，前台系列页顺序一致 |
| E15 | 专题（TopicGuide） | 新建专题、关联文章排序，前台 guides 页一致 |

### Batch 3：AI 与运营后台（12 条）

| # | 用例 | 断言 |
|---|------|------|
| E16 | 封面库 | 走 `POST /api/admin/covers` 手动 URL 建 `CoverAsset`（`parseCoverAssetInput` 支持，不碰七牛真实上传），文章选用后详情页封面更新 |
| E17 | AI 模型管理 | 新建 OpenAI 兼容模型指向本地 mock completion server（Playwright 测试进程起 http server，Next 服务可达 127.0.0.1），连通性测试成功路径有反馈；再配假端口断言失败反馈 |
| E18 | AI 任务中心 | 发起摘要/SEO 批量任务（`createAiBatchTask` 内 `scheduleBatchTask` setTimeout 异步执行，用 `expect.poll` 等终态），成功计数增长；单项失败可重试 |
| E19 | AI 摘要状态机 | 草稿触发摘要→状态 QUEUED→GENERATED/FAILED 可见（mock completion server，不判文本质量；直发 `/api/admin/posts/summarize` 是同步接口，工作台路径异步） |
| E20 | AI 新闻控制台 | 建本地 RSS mock feed 源（`validateUrl` 允许 127.0.0.1）+ 本地 mock completion server 作为模型 baseUrl，手动触发 run；admin 触发是同步 await 全流水线（`run/route.ts` 直接 `await runDailyAiNews`），断言响应与最终 run 记录 SUCCEEDED、文章已发布；候选列表可浏览。cron 触发的 202+RUNNING 轮询语义由 route 单测覆盖 |
| E21 | AI 话题雷达 | 无手动建话题入口（POST 仅 `materializeTopicsFromRecentCandidates` 聚合候选）；先 seed `aiNewsCandidate`（带 aiTags），materialize 后断言 NEW 状态出现，再走 WATCHING→PLANNED 状态操作（server action 表单） |
| E22 | Newsletter 订阅 | 设置页开 newsletter + provider `log`；前台订阅→订阅响应只含 `verificationRequired: true`（token 响应与日志均脱敏）；测试进程直连 PG 读 `verification_token` 调 `/api/newsletter/verify` 完成验证，再退订；admin 订阅者统计三态变化 |
| E23 | Newsletter 群发 | 新建 campaign、选择文章、发送后 delivery 状态落定（provider `log` 下 delivered） |
| E24 | 通知中心 | 触发评论/AI任务事件后通知出现，可标已读/忽略 |
| E25 | 操作日志 | 上述管理操作后 `/admin/logs` 出现对应记录（method/path/actor） |
| E26 | 设置页 | 改站点名称，保存后前台 Navbar/Footer 同步（真实消费 `blogSettings.siteName`，`revalidateBlogSettings` 覆盖 `/` 等路径）。注意：联系页邮箱走构建期内联的 `NEXT_PUBLIC_CONTACT_EMAIL`，不受设置页控制，勿断言 |
| E27 | 阅读分析 | 浏览文章后 dashboard 访问/阅读统计出现增量（容忍聚合延迟，用轮询断言） |

## 交付顺序与验收

- P0：helpers + storageState + seed admin + CI job（非阻塞）+ Batch 1（5 条）全绿 → 合并。
- P1：Batch 2（10 条）→ 合并；CI E2E 转**必过门禁**。
- P2：Batch 3（12 条）→ 合并，全量约 30 条。
- 每批验收：`pnpm test:e2e` 本地通过 + CI E2E job 通过 + `git diff --check`；不要求全量 Vitest 重跑（未动业务代码），但 CI 本来就会跑。
- 现有 3 个 stub 保留并升级（不断言改写，只增强），避免回归口径漂移。

## 风险

- **限流是最大坑**：auth 5/分、interaction 20/分（评论/订阅共用）、analytics 30/分，全按 IP=127.0.0.1 计。storageState 解决登录；评论相关用例合计不超 3 次 POST；analytics 用例单独发访客 ID，不与其他用例叠加。必要时 CI 设 `RATE_LIMIT_DRIVER=memory` 并接受这些上限（不改生产代码）。
- admin 手动触发 AI 新闻是同步长请求（全流水线含外部调用），CI 上 mock 端点就绪后通常 <30s；仍设 `expect.poll` 兜底 + route 层 `test.timeout` 放宽到 120s。
- ISR `revalidate = 300`：内容变更后有 `revalidatePublicContent` 精确失效，前台断言直接请求变更后的路径即可；但**首页**等列表页在 `pnpm start` 下可能命中构建期静态快照，Batch 1 的 E01 详情跳转用文章详情路径（动态参数 `dynamicParams: true`），不要断言首页出现刚发的文章。
- AI 外部调用不稳定：E2E 内一律本地 mock server 或走失败路径断言，不依赖 DashScope 真实 key。
- 并发写冲突：全 slug/邮箱加时间戳前缀，单 worker 串行已规避大部分竞态。
