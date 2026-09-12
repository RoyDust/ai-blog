# AI 新闻来源控制台（NotebookLM Lite）实施计划

> 创建日期：2026-05-31
> 状态：已对照代码核对并修订（2026-05-31 审查）
> 目标版本：先做简化版来源控制，不做完整 Notebook / RAG / 文档解析系统

> 审查修订要点（2026-05-31，已对照 `prisma/`、`ai-news-run-flow.ts`、`ai-news-sources.ts`、run/test route 核对源码）：
> 1. 明确新增来源 `id` 生成策略：按 `name` slugify + 冲突加后缀（见 6.3 / 8.2 / 第 9 节）。
> 2. 统一来源测试响应语义：端点错误走 `toErrorResponse()` 非 2xx，抓取结论一律 200 + `data.status`（见 8.5）。
> 3. 来源快照改为 run 创建后立即写入“输入快照”，不依赖成功分支（见 P2）。
> 4. 通用字段 PATCH 不得整体覆盖 `config`，避免抹掉种子里的 `owner/repo`、`commentLimit`（见 8.3）。
> 5. 选中加载器命中 0 条时返回空并报校验错，绝不回退 fallback（见第 9 节）。
> 6. 新增 5 个 route 统一套 `requireAdminSession` + `withApiOperationLogging` + `toErrorResponse`（见第 8 节通用约定）。
> 7. cron 路径保持默认全量来源，纳入回归（见 8.6 / 测试计划）。
> 8. 展示“本次使用 N 个来源”取 `configuredSourceCount` 或快照长度，不用 `sourceCount`（那是条目数）。
> 9. 修正 selected 模式与停用来源的契约：selected 模式可临时使用默认停用来源，但运行时要显式绕开 fetcher 的 `enabled === false` 过滤（见 6.2 / 8.6 / 第 9 节）。
> 10. 来源测试必须在服务层补做最近 48 小时过滤；RSS 抓取器本身不使用 `since`（见 8.5）。
> 11. 来源快照写入顺序改为：先解析来源集合，再创建 run 并立即写入 snapshot，再进入模型解析和抓取（见 P2）。
> 12. 删除策略改为 P0 保护内置 seed 来源：无 `custom/deletable` 字段前，内置源只允许停用，不允许删除（见 8.4）。
> 13. 列表 API 不裸露 raw `config`，只返回类型化 `settings` / `capabilities` 等 public DTO 字段（见 8.1）。

## 1. 背景

当前 AI 新闻流水线已经具备“多来源采集 → 候选持久化 → 去重评分 → 生成日报 → 审稿发布”的基础能力，但来源控制仍停留在后台不可见状态：

- 数据库已有 `AiNewsSource` 模型，字段覆盖类型、名称、URL、分类、启停、权重、抓取上限和 `config`。
- `loadDailyAiNewsSources()` 已经优先读取数据库中 `enabled: true` 的来源。
- 抓取器已经支持 `RSS`、`HACKERNEWS`、`GITHUB_RELEASES`、`GITHUB_TRENDING_RSS`，`REDDIT` 目前只适合作为保留类型。
- 后台 `/admin/ai-news` 已经能触发生成、展示运行记录和候选新闻，但不能管理来源，也不能控制“本次生成用哪些来源”。

用户期望参考 NotebookLM 的 Sources 体验：来源是一级对象，用户能看到来源、选择来源，并让后续 AI 产物只基于选中的来源工作。官方 NotebookLM 帮助文档说明其 Sources 面板支持选择来源，使对话和产物基于指定来源工作；本项目只借鉴这个交互原则，不复制完整产品复杂度。参考：[NotebookLM Help](https://support.google.com/notebooklm/answer/14276468?hl=en)。

## 2. 产品目标

把 AI 新闻来源从“隐藏配置”升级为“可见、可选、可测试、可回溯”的后台控制台。

第一版要达成：

- 管理员能在 AI 日报页看到全部新闻来源。
- 管理员能启停来源，调整来源权重。
- 管理员能新增和编辑 RSS 来源。
- 管理员能测试单个来源是否可抓取。
- 管理员能在一次生成前选择“本次使用哪些来源”。
- 每次生成能记录本次使用的来源快照，便于事后追溯。

## 3. 非目标

第一版不做以下内容：

- 不做 NotebookLM 式 Notebook、多文档空间、聊天问答。
- 不做网页全文抽取、PDF/文档解析、向量检索。
- 不开放任意 JSON 配置编辑器。
- 不让用户自定义抓取脚本。
- 不新增外部依赖。
- 不做自动来源推荐或自动发现。
- 不改变现有 AI 日报文章生成主流程的质量门槛。

## 4. 设计原则

1. 来源是一级对象，而不是隐藏配置。
2. 默认行为稳定：不选择来源时，仍使用所有已启用来源。
3. 本次选择不污染默认配置：临时勾选只影响当前 run。
4. 配置要类型化：不同来源类型展示不同表单，不暴露裸 `config`。
5. 失败要可解释：测试失败、抓取失败、解析失败都要给出可读原因。
6. 历史要可回溯：每篇日报能查到当时实际使用了哪些来源。
7. 第一版要小：先覆盖 RSS 和通用启停权重，再扩 HN/GitHub 细节。

## 5. 信息架构

复用现有 `/admin/ai-news` 页面，增加 NotebookLM Lite 风格来源面板。

建议页面分为三个区域：

1. 顶部：生成控制
   - 生成日期
   - 模型选择
   - “使用默认来源” / “使用选中来源”切换
   - 生成 / 重新生成按钮

2. 中部：来源控制台
   - 来源库
   - 分组筛选
   - 搜索
   - 批量选择
   - 新增来源
   - 测试来源

3. 下方：运行记录和候选新闻
   - 保留现有运行历史
   - 每次 run 展开后补充“本次来源快照”
   - 候选列表继续按当前方式展示

## 6. 核心交互

### 6.1 来源卡片

每个来源展示为紧凑卡片，方便批量扫描。

信息字段：

- 勾选框：是否纳入本次生成
- 启用开关：是否默认参与日报
- 名称
- 类型：RSS / HN / GitHub Releases / GitHub Trending RSS
- 分类：official / industry / developer / community / github-release
- 权重
- URL
- 最近测试状态
- 最近测试候选数量
- 操作：测试、编辑、复制、删除

示例：

```text
[x] OpenAI Blog                         RSS       official        权重 120
    https://openai.com/news/rss.xml
    最近测试：可用 · 抓到 4 条 · 2026-05-31 10:24
    [测试] [编辑] [停用]
```

### 6.2 来源选择模式

生成面板增加一个来源范围选择：

- 默认来源：使用所有已启用来源。
- 选中来源：只使用当前勾选来源。

交互规则：

- 页面初始勾选所有已启用来源。
- 取消勾选只影响本次生成，不改变 `enabled`。
- 关闭启用开关会更新默认配置，并从本次选择中移除。
- 默认停用来源不会初始勾选；如果管理员在“选中来源”模式下手动勾选默认停用来源，表示“仅本次临时使用”，不会改变数据库 `enabled`。
- UI 对这类来源显示“默认停用，本次临时使用”的状态，避免和默认启用混淆。
- 如果选择模式为“选中来源”，但没有勾选任何来源，生成按钮禁用并提示“至少选择一个来源”。

### 6.3 新增来源弹窗

第一版只开放 RSS 新增，避免过早暴露复杂配置。

字段：

- 来源类型：默认 `RSS`
- 名称：必填
- Feed URL：必填，必须是合法 URL
- 主页 URL：可选，必须是合法 URL
- 分类：下拉选择
- 权重：默认 50（仅 UI 默认值，与数据库列默认 `1` 无关）
- 抓取上限：可选，默认空
- 是否启用：默认启用

表单不暴露 `id`。`id` 由服务层按 `name` 自动 slugify 生成（如 “Example AI Blog” → `example-ai-blog`），与现有种子来源的 slug 风格保持一致；落库前查重，冲突时追加 `-2`、`-3` 后缀。

保存前校验：

- `name` 非空，长度限制 2-80。
- `url` 必须是 `http` 或 `https`。
- `weight` 范围 0-200。
- `fetchLimit` 范围 1-100。
- 同一个 `url` 不允许重复创建。
- slugify 后的 `id` 非空，且不与现有来源冲突（冲突时自动加后缀）。

### 6.4 编辑来源弹窗

所有来源都允许编辑通用字段：

- 名称
- 主页
- 分类
- 启用状态
- 权重
- 抓取上限

第一版对非 RSS 来源采取保守策略：

- `HACKERNEWS` 可编辑 `minScore`、`fetchLimit`。
- `GITHUB_RELEASES` 可编辑仓库 URL，但保存时必须能解析 `owner/repo`。
- `REDDIT` 暂时只展示，不允许新增，不建议启用。

### 6.5 来源测试

测试按钮调用服务端真实抓取，不进入正式 run，不写候选表。

返回：

- `status`: success / failed
- `itemCount`: 抓到的原始条数
- `sampleItems`: 前 3 条标题和 URL
- `message`: 错误原因或成功摘要
- `testedAt`: 测试时间

测试结果第一版不落库，只在 UI 显示。这与 AI 模型测试的落库式 `recordAiModelTestResult()` 模式不同，是有意简化：避免 P0 引入迁移；来源健康字段（`lastTestedAt` 等）已排到 P4 / 7.3。

测试会真实发起外部抓取，必须设置请求超时（确认 `fetchAiNewsRawItems()` 是否已带超时，没有则在测试入口包一层），避免慢源拖住后台请求。

## 7. 数据模型计划

### 7.1 复用现有 `AiNewsSource`

现有字段已足够第一版：

- `id`
- `type`
- `name`
- `url`
- `homepage`
- `category`
- `enabled`
- `weight`
- `minScore`
- `fetchLimit`
- `config`
- `createdAt`
- `updatedAt`

第一版不新增迁移。

### 7.2 来源快照

为了记录“本次 run 实际用了哪些来源”，建议优先使用现有 `AiNewsRun` 的可扩展字段方案，避免立即加表。

方案 A（推荐 P0）：

- 在 `AiNewsRun.sourceFailureJson` 继续只放失败信息，不混入来源快照。
- 在 `AiNewsRun.generationMode` 保持现状。
- 新增 `AiNewsRun.sourceSnapshotJson Json?` 字段。

优点：

- 语义清晰。
- 展示运行记录时一次查询即可拿到来源快照。
- 不影响候选表。

缺点：

- 需要新增 Prisma migration。

方案 B（低迁移）：

- 不新增字段。
- 通过 `AiNewsCandidate.sourceId/sourceName/sourceType` 反推实际产生候选的来源。

优点：

- 无迁移。

缺点：

- 抓取失败且没有候选的来源无法完整回溯。
- 无法区分“选中了但没有抓到”和“没有选中”。

建议：P0 做方案 A。该功能的核心价值就是回溯来源选择，不应省掉快照。

快照结构：

```json
[
  {
    "id": "openai",
    "type": "RSS",
    "name": "OpenAI Blog",
    "url": "https://openai.com/news/rss.xml",
    "category": "official",
    "enabled": true,
    "weight": 120
  }
]
```

### 7.3 测试状态

第一版不新增字段。后续如果需要来源健康面板，再新增：

- `lastTestedAt DateTime?`
- `lastTestStatus String?`
- `lastTestMessage String?`
- `lastFetchedItemCount Int?`

## 8. API 计划

通用约定（5 个新 route 一致，与现有 admin route 对齐）：

- 鉴权统一用 `requireAdminSession()`。
- 统一用 `withApiOperationLogging(handler, { scope: 'admin', operation: 'admin.ainews.sources.*', route })` 包装，确保进入站内操作审计日志（现有 run / models route 均如此）。
- 错误统一走 `toErrorResponse()`。
- route 保持轻薄，校验与业务逻辑下沉到 `ai-news-source-admin.ts`（对齐 `ai-models.ts` 模式）。

### 8.1 来源列表

`GET /api/admin/ai-news/sources`

返回全部来源，按 `enabled desc, weight desc, name asc` 排序。

响应使用 public DTO，不直接暴露数据库 raw `config`。服务层按类型展开为 `settings`，并派生 `editable` / `deletable`，避免前端依赖内部 JSON 结构。

响应：

```json
{
  "success": true,
  "data": [
    {
      "id": "openai",
      "type": "RSS",
      "name": "OpenAI Blog",
      "url": "https://openai.com/news/rss.xml",
      "homepage": "https://openai.com/news/",
      "category": "official",
      "enabled": true,
      "weight": 120,
      "minScore": null,
      "fetchLimit": null,
      "settings": {},
      "editable": true,
      "deletable": false,
      "createdAt": "2026-05-06T00:00:00.000Z",
      "updatedAt": "2026-05-06T00:00:00.000Z"
    }
  ]
}
```

### 8.2 新增来源

`POST /api/admin/ai-news/sources`

请求：

```json
{
  "type": "RSS",
  "name": "Example AI Blog",
  "url": "https://example.com/feed.xml",
  "homepage": "https://example.com",
  "category": "industry",
  "enabled": true,
  "weight": 50,
  "fetchLimit": 20
}
```

行为：

- 仅管理员可调用。
- 校验并规范化 URL。
- `id` 不接受客户端传入，由服务层按 `name` slugify 生成并查重（冲突加后缀）。
- RSS 新增可直接写库。
- 非 RSS 新增第一版返回 `400`，提示“第一版仅支持新增 RSS 来源”。

### 8.3 修改来源

`PATCH /api/admin/ai-news/sources/[id]`

允许局部更新：

- `name`
- `url`
- `homepage`
- `category`
- `enabled`
- `weight`
- `minScore`
- `fetchLimit`
- 类型化 `config`

行为：

- 不允许修改 `id`。
- 不建议修改 `type`；如要改变类型，建议删除重建。
- 通用字段编辑（名称/主页/分类/启停/权重/抓取上限）**不触碰 `config`**：数据库现有 HN / GitHub Releases 来源的 `config` 存着 `commentLimit`、`owner/repo` 等种子配置，整体覆盖会抹掉它们导致抓取失败。
- 只有 P3 的类型化表单才按字段**合并**写入 `config`（如更新 GitHub Releases URL 时同步解析并写回 `config.owner/config.repo`）。

### 8.4 删除来源

`DELETE /api/admin/ai-news/sources/[id]`

行为：

- P0 不允许删除内置 seed 来源；内置源只允许停用。当前 schema 没有 `sourceKind/custom/deletable` 字段，服务层先用内置 seed id 白名单派生 `deletable: false`。
- 删除前检查是否存在历史候选。
- 因候选表关系是 `onDelete: SetNull`，删除用户新增来源不会破坏历史候选。
- UI 提示：“历史候选仍保留来源名称快照，但不再关联来源配置。”
- 后续如要允许区分系统源与自定义源，需新增 `sourceKind` 或 `createdById` 字段，而不是靠 id 约定长期维持。

### 8.5 测试来源

`POST /api/admin/ai-news/sources/[id]/test`

行为：

- 从数据库读取来源。
- 调用已有 `fetchAiNewsRawItems()`，只传单个来源。
- 测试时无视该来源的默认启停状态：即使 `enabled=false`，也要用 runtime source 副本执行测试，避免被 `fetchAiNewsRawItems()` 的 `enabled !== false` 过滤掉。
- 使用最近 48 小时窗口；注意 RSS / GitHub Trending RSS fetcher 本身不会使用 `since`，所以 `testAiNewsSource()` 必须在服务层对返回 items 再做一次 `publishedAt >= cutoff` 的 post-filter，和正式 run 的 `collectDailyAiNewsRawItems()` 语义保持一致。
- 不写入 `AiNewsRun`，不写入 `AiNewsCandidate`。

响应：

```json
{
  "success": true,
  "data": {
    "status": "success",
    "itemCount": 4,
    "sampleItems": [
      {
        "title": "Example update",
        "url": "https://example.com/update"
      }
    ],
    "message": "来源可用，最近 48 小时抓到 4 条候选。",
    "testedAt": "2026-05-31T02:24:00.000Z"
  }
}
```

响应语义分两层，不要混用：

- **端点级错误**（来源不存在、非管理员、参数非法）走 `toErrorResponse()`，返回非 2xx。
- **抓取结论**（来源可用 / 不可用）一律返回 **HTTP 200 + `data.status`**：“这个源抓不到”是测试要传达的有效结果，不是接口错误，这样 UI 才能稳定渲染测试结果卡片。

### 8.6 生成接口扩展

扩展 `POST /api/admin/ai-news/run` body：

```json
{
  "date": "2026-05-31",
  "modelId": "model-1",
  "regenerate": false,
  "sourceMode": "selected",
  "sourceIds": ["openai", "github-vercel-ai"]
}
```

规则：

- `sourceMode` 缺省为 `default`。
- `default`：忽略 `sourceIds`，使用所有已启用来源。
- `selected`：只加载 `sourceIds` 中的来源，且必须存在。
- 是否允许选中已停用来源：建议允许。停用表示不参与默认日报，不代表不能临时运行。
- selected 模式加载已停用来源时，运行时 config 必须把 `enabled` 归一化为 `true` 或让 fetcher 支持 `includeDisabled`；否则现有 `fetchAiNewsRawItems()` 会静默过滤 `enabled=false` 来源。推荐 P1 采用“selected loader 返回 runtime source 副本，`enabled: true`，另带 `defaultEnabled` 用于快照/UI”的方式，影响面最小。
- 选中来源为空时返回 `400`。
- cron 触发（`/api/cron/ai-news`）不传 `sourceMode/sourceIds`，保持默认全量来源行为；调整 `runDailyAiNews()` 签名时必须保证 cron 调用形态不变（其测试有精确 `toHaveBeenCalledWith` 断言）。

## 9. 服务层计划

新增 `src/lib/ai-news-source-admin.ts`，封装来源管理逻辑。

职责：

- `listAiNewsSources()`
- `createAiNewsSource(input)`：按 `name` slugify 生成 `id` 并查重（冲突加后缀）后写库。
- `updateAiNewsSource(id, input)`
- `deleteAiNewsSource(id)`
- `testAiNewsSource(id, fetchImpl?)`
- `loadAiNewsSourcesByIds(ids)`：按 `id` 命中加载，不加 `enabled: true` 条件；命中 0 条时返回空数组，**绝不回退** `FALLBACK_DAILY_AI_NEWS_SOURCES`。返回给运行时的 source 副本统一 `enabled: true`，同时保留 `defaultEnabled` 供快照和 UI 展示。
- `toPublicAiNewsSource(row)`

新增原因：

- 避免把校验逻辑塞进 route。
- 与 `ai-models.ts` 的管理服务模式保持一致。
- 便于单元测试覆盖输入校验和 GitHub URL 解析。

对现有 `ai-news-sources.ts` 的调整：

- 保留 `loadDailyAiNewsSources()` 作为运行时默认来源加载器（DB 查 0 条回退 fallback 的行为只适用于“默认”模式）。
- 新增 `loadSelectedDailyAiNewsSources(sourceIds)`：只按 id 命中，命中 0 条返回空数组，**不复用默认加载器的 fallback 回退**，由上层 route 报“至少选择一个来源”的校验错。该函数不按 `enabled` 过滤；对于默认停用但被临时选中的来源，返回 runtime 副本时设置 `enabled: true`，避免 fetcher 静默跳过。
- `runDailyAiNews()` 根据 `sourceMode/sourceIds` 决定调用默认加载还是选中加载；现有内部 `collectDailyAiNewsRawItems()` 是来源加载的唯一入口，从这里分流改动最小。

## 10. UI 组件计划

建议拆成小组件，避免 `src/app/admin/ai-news/page.tsx` 继续膨胀。

新增组件：

- `src/components/admin/ai-news/AiNewsSourcePanel.tsx`
- `src/components/admin/ai-news/AiNewsSourceCard.tsx`
- `src/components/admin/ai-news/AiNewsSourceFormDialog.tsx`
- `src/components/admin/ai-news/AiNewsSourceTestResult.tsx`
- `src/components/admin/ai-news/hooks/useAiNewsSources.ts`

现有页面改动：

- `src/app/admin/ai-news/page.tsx`
  - 加载来源列表。
  - 维护本次选中的 `sourceIds`。
  - 生成请求 body 加上 `sourceMode/sourceIds`。
  - 运行记录展示来源快照摘要。

视觉要求：

- 保持后台工具风格，信息密度高，不做营销式大卡。
- 来源卡片固定高度和稳定布局，避免测试结果出现时撑坏列表。
- 操作用图标按钮或短按钮：测试、编辑、删除、启停。
- 分组和筛选用 segmented controls / tabs，而不是长段说明文字。

## 11. 实施阶段

### P0：来源库 CRUD + RSS 测试

目标：让来源可见、可维护，先不改生成时选择范围。

任务：

- [ ] 新增 `ai-news-source-admin.ts` 服务层。
- [ ] 新增 `GET /api/admin/ai-news/sources`。
- [ ] 新增 `POST /api/admin/ai-news/sources`，第一版仅允许 RSS。
- [ ] 新增 `PATCH /api/admin/ai-news/sources/[id]`。
- [ ] 新增 `DELETE /api/admin/ai-news/sources/[id]`，P0 仅允许删除用户新增来源，内置 seed 来源返回校验错误。
- [ ] 新增 `POST /api/admin/ai-news/sources/[id]/test`。
- [ ] 新增来源面板 UI，展示来源、启停、权重、测试结果。
- [ ] 为 RSS 新增/编辑做弹窗表单。

验收：

- 管理员能看到当前数据库来源。
- 管理员能新增 RSS 来源。
- 管理员能停用一个来源，下次默认生成不再使用它。
- 管理员能测试来源，并看到候选数量或错误原因。
- 内置来源不可删除，只能停用；用户新增来源可以删除。

### P1：本次生成选择来源

目标：实现 NotebookLM Lite 的核心体验：本次 AI 产物只基于选中来源。

任务：

- [ ] 扩展生成请求 payload：`sourceMode/sourceIds`。
- [ ] 新增 `loadAiNewsSourcesByIds()`。
- [ ] 修改 `runDailyAiNews()` 支持选中来源。
- [ ] 页面增加“默认来源 / 选中来源”切换。
- [ ] 来源卡片勾选状态参与生成请求。
- [ ] 禁止选中来源为空时生成。
- [ ] 运行结果展示“本次使用 N 个来源”：取 metrics 里已有的 `configuredSourceCount`（或快照长度），不要用 `sourceCount`（run-flow 里它等于抓到的条目数，不是来源数）。

验收：

- 默认模式行为与当前一致。
- 选中模式只请求选中来源的 URL。
- 未选中来源不会进入候选。
- 已停用来源可以被临时选中运行，但 UI 要明确显示“默认停用”。

### P2：运行来源快照

目标：能回溯每次日报基于哪些来源生成。

任务：

- [ ] 新增 Prisma migration：`AiNewsRun.sourceSnapshotJson Json?`。
- [ ] 更新 Prisma Client。
- [ ] 调整 `runDailyAiNews()` 顺序：先解析/校验本次 source set，再创建 run，并在 create data 或紧随其后的 update 中写入“输入快照”；随后再解析模型、抓取和生成。这样模型解析失败、抓取失败、生成失败都能回溯本次打算用哪些源。
- [ ] 明确 `SKIPPED` 语义：如果同日文章已存在且未 `regenerate`，可不解析来源、`sourceSnapshotJson=null`；UI 展示“跳过，未执行来源采集”。如果用户在 selected 模式下也希望记录请求来源，则需要在检查 existing 前先解析来源并承担一次额外 DB 查询。
- [ ] 运行记录 API 返回 `sourceSnapshotJson`。
- [ ] UI 展示来源快照摘要：来源数量、失败数量、主要分类。
- [ ] 展开 run 时显示来源列表。

验收：

- 每次运行记录能看到当时使用的来源。
- 抓取失败但被选中的来源也能出现在快照中。
- 删除来源后，历史 run 仍可展示快照。

### P3：GitHub/HN 类型化配置

目标：把现有非 RSS 来源也纳入可编辑范围。

任务：

- [ ] GitHub Releases 表单支持仓库 URL。
- [ ] 保存时解析 `owner/repo` 并写入 `config`。
- [ ] HN 表单支持 `minScore`、`fetchLimit`、`commentLimit`。
- [ ] `GITHUB_TRENDING_RSS` 按 RSS 表单处理，但类型独立展示。
- [ ] 对 `REDDIT` 显示“暂未开放”。

验收：

- 管理员能新增 GitHub Releases 来源。
- 管理员能调整 HN 最小分数和抓取数量。
- 错误配置不会进入运行时。

### P4：来源健康与质量治理

目标：让来源控制台从配置面板升级为运营面板。

任务：

- [ ] 增加来源最近测试状态字段。
- [ ] 统计近 20 次 run 中每个来源的候选数量、失败次数、入选次数。
- [ ] 展示长期失败来源提醒。
- [ ] 展示低入选率来源提醒。
- [ ] 支持批量停用失败来源。

验收：

- 管理员能判断哪些来源长期不可用。
- 管理员能基于入选率调整来源权重。

## 12. 测试计划

### 单元测试

新增：

- `src/lib/__tests__/ai-news-source-admin.test.ts`

覆盖：

- RSS 输入校验。
- URL 规范化。
- 权重和抓取上限边界。
- 重复 URL 拒绝。
- GitHub URL 解析。
- `loadAiNewsSourcesByIds()` 保持输入顺序或按权重排序的约定。
- `loadAiNewsSourcesByIds()` 不按 `enabled` 过滤，且 selected runtime source 会设置 `enabled: true`。
- 来源测试成功返回样例候选。
- 来源测试失败返回结构化错误。
- 来源测试会过滤最近 48 小时之外的 RSS 条目。

### API 测试

新增：

- `src/app/api/admin/ai-news/sources/__tests__/route.test.ts`
- `src/app/api/admin/ai-news/sources/[id]/__tests__/route.test.ts`
- `src/app/api/admin/ai-news/sources/[id]/test/__tests__/route.test.ts`

覆盖：

- 未登录/非管理员拒绝。
- 列表返回来源。
- 创建 RSS 来源成功。
- 非 RSS 创建在 P0 被拒绝。
- PATCH 更新启停和权重。
- DELETE 删除来源。
- DELETE 内置 seed 来源被拒绝。
- TEST 返回候选样例。
- TEST 默认停用来源仍会真实测试，不被 `enabled=false` 静默过滤。
- GET sources 不返回 raw `config` 字段，只返回 public `settings`。
- Prisma delegate 不可用时返回可读错误。

### 流水线测试

更新：

- `src/lib/__tests__/ai-news.test.ts`
- `src/app/api/admin/ai-news/run/__tests__/route.test.ts`

覆盖：

- 默认模式仍调用 `loadDailyAiNewsSources()`。
- 选中模式只加载 `sourceIds`。
- 选中来源为空返回校验错误。
- 已停用来源可被选中模式临时使用。
- 已停用来源在 selected 模式会被真实抓取，不被 fetcher 过滤。
- 选中加载器命中 0 条不回退 fallback。
- `sourceSnapshotJson` 在 run 创建后即写入，run 失败也保留输入快照。
- cron 回归：`src/app/api/cron/ai-news/__tests__/route.test.ts` 仍以默认来源调用 `runDailyAiNews()`，签名调整未改变其调用形态。

### UI 测试

更新：

- `src/app/admin/__tests__/ai-news-page.test.tsx`

覆盖：

- 来源面板渲染来源卡片。
- 切换来源选择模式。
- 勾选/取消来源会影响生成请求。
- 新增 RSS 来源表单提交。
- 测试来源按钮展示测试结果。
- 运行记录展示来源快照摘要。

### 手动验证

- 本地启动后台，打开 `/admin/ai-news`。
- 新增一个 RSS 测试源。
- 测试来源并确认样例候选展示。
- 默认模式生成一次，确认所有启用来源参与。
- 选中 1-2 个来源生成一次，确认未选来源没有请求。
- 展开运行记录，确认来源快照和候选来源一致。
- 停用一个来源，再默认生成，确认不再参与。

## 13. 风险与缓解

### 风险 1：错误来源拖低日报质量

缓解：

- 新增来源后建议先测试。
- 默认权重较低。
- 失败来源只记录失败，不中断整个 run。

### 风险 2：配置表单过复杂

缓解：

- P0 只开放 RSS。
- HN/GitHub 在 P3 单独做类型化表单。
- 不暴露裸 JSON。

### 风险 3：临时选择与默认启停语义混淆

缓解：

- UI 明确区分“本次选中”和“默认启用”。
- 勾选框只影响当前生成。
- 启用开关才写入数据库。

### 风险 4：历史回溯不完整

缓解：

- P2 新增 `sourceSnapshotJson`。
- 快照记录选中但抓取失败的来源。

### 风险 5：页面状态变复杂

缓解：

- 把来源逻辑拆到 `useAiNewsSources()`。
- 页面只负责组装生成请求。
- 来源 CRUD 后统一刷新来源列表。

## 14. 文件影响范围

预计新增：

- `src/lib/ai-news-source-admin.ts`
- `src/lib/__tests__/ai-news-source-admin.test.ts`
- `src/app/api/admin/ai-news/sources/route.ts`
- `src/app/api/admin/ai-news/sources/__tests__/route.test.ts`
- `src/app/api/admin/ai-news/sources/[id]/route.ts`
- `src/app/api/admin/ai-news/sources/[id]/__tests__/route.test.ts`
- `src/app/api/admin/ai-news/sources/[id]/test/route.ts`
- `src/app/api/admin/ai-news/sources/[id]/test/__tests__/route.test.ts`
- `src/components/admin/ai-news/AiNewsSourcePanel.tsx`
- `src/components/admin/ai-news/AiNewsSourceCard.tsx`
- `src/components/admin/ai-news/AiNewsSourceFormDialog.tsx`
- `src/components/admin/ai-news/AiNewsSourceTestResult.tsx`
- `src/components/admin/ai-news/hooks/useAiNewsSources.ts`

预计修改：

- `prisma/schema.prisma`（P2 新增 `sourceSnapshotJson`）
- 新增 Prisma migration（P2）
- `src/lib/ai-news-sources.ts`
- `src/lib/ai-news-run-flow.ts`
- `src/lib/ai-news-types.ts`
- `src/app/api/admin/ai-news/run/route.ts`
- `src/app/admin/ai-news/page.tsx`
- `src/app/admin/__tests__/ai-news-page.test.tsx`
- `src/lib/__tests__/ai-news.test.ts`
- `src/app/api/admin/ai-news/run/__tests__/route.test.ts`

## 15. 验收标准

- [ ] 管理员能在 AI 日报后台看到来源库。
- [ ] 管理员能新增、编辑、停用、删除 RSS 来源。
- [ ] 管理员能测试来源并看到候选样例或失败原因。
- [ ] 默认生成行为与当前保持兼容。
- [ ] 管理员能选择本次生成使用的来源集合。
- [ ] 选中来源模式下，未选中来源不会参与抓取。
- [ ] 每次 run 能展示本次使用的来源快照。
- [ ] 已删除来源不影响历史运行记录展示。
- [ ] 相关 API、服务层、UI、流水线测试通过。
- [ ] `pnpm lint` 通过。
- [ ] `pnpm test` 或至少相关测试集通过。

## 16. 推荐执行顺序

建议分三次提交，降低风险：

1. 来源 CRUD 与测试
   - 服务层、API、来源面板、RSS 表单、来源测试。

2. 本次选择来源
   - 生成接口扩展、运行时加载选中来源、UI 勾选参与请求。

3. 来源快照与回溯
   - Prisma migration、run 快照写入、运行记录展示。

P3/P4 可以作为后续增强，不阻塞第一版可用。
