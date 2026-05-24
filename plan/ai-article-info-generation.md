# AI 辅助生成文章功能完善计划

> 生成日期：2026-05-24
> 范围：后台文章编辑器里的“一键 AI 生成文章信息”和“AI 辅助”相关任务流。
> 原则：保留标题和正文不被一键覆盖；优先修正任务语义、失败恢复和覆盖安全，再做体验增强。

## 背景

当前后台文章编辑器已经具备“一键 AI 生成文章信息”能力，入口位于描述/元信息编辑区域，功能会调用 `/api/admin/ai/actions/article-info`，创建 `post-article-info` 类型 AI 任务，并生成以下字段：

- slug
- 摘要
- SEO 描述
- 分类
- 标签

该能力已经避免覆盖标题和正文，但在任务可靠性、任务中心状态语义、草稿恢复、覆盖确认和单项 AI 入口统一性上仍有完善空间。

## 现状结论

- [x] 一键生成已接入 `/api/admin/ai/actions/article-info`，任务类型为 `post-article-info`
- [x] 一键生成会保留标题和正文，仅回填 slug、摘要、SEO 描述、分类、标签
- [x] AI 辅助入口已收拢为弹窗，主编辑布局不再长期占用右侧空间
- [x] 任务中心已有 `post-article-info` 基础展示标签
- [x] 后端已逐项记录成功/失败状态；失败时 502 响应已返回 `failures` 与已成功的 `items`（详见 P0-1 修正）
- [x] 一键生成仍在单个请求里串行执行 5 个 AI 动作，存在耗时和整体失败风险；本轮已先支持部分成功回填，异步轮询留到后续
- [x] 编辑模式下一键生成只回填表单、未落库；本轮已让任务详情不再显示直接落库“应用”按钮
- [x] 草稿一键生成任务的重试/恢复语义错位；本轮已移出通用 resume 白名单，并在任务详情禁用一键任务重试
- [x] 单项标题、slug、分类、标签生成已迁移到 `/api/admin/ai/actions`，`/api/admin/posts/metadata` 仅作为兼容入口保留

## P0：可靠性与任务语义

### P0-1 改造一键生成执行方式

> 修正（基于代码核验）：`src/app/api/admin/ai/actions/article-info/route.ts` 已逐项 `markAiTaskItemSucceeded/Failed`，并在失败时（502）返回 `failures` 与已成功的 `items`。因此“任务中心记录每项状态”已满足，**不要重写这部分**。真正缺口只有两处：后端 `normalizeArticleInfo` 强制 slug+excerpt+seoDescription 三者齐全（任一缺失即抛错，全有或全无）；前端 `handleGenerateAllArticleInfo` 在 `!response.ok` 时直接 throw、丢弃一切。

待办（收窄后）：

- [x] 后端：把 `normalizeArticleInfo` 从“全有或全无”改为允许部分字段缺失，失败 action 不阻断其余字段返回
- [x] 前端：部分失败时不再整体丢弃，改为消费逐项 `data.items[].output` 按字段回填
- [x] 前端明确提示失败字段，失败字段保留表单原值
- [x] 已评估“创建任务后异步轮询”：本轮保留同步执行，叠加 partial 回填、预览确认和短时间缓存，避免扩大执行模型

partial 语义（消除聚合冲突）：

- `partial: true` 与聚合 `articleInfo` 互斥——partial 意味着某些字段缺失，但 `articleInfo` 结构当前要求核心字段必须在
- 部分回填时前端应读取逐项 `data.items[].output`，而非聚合 `articleInfo`
- 逐字段独立回填：slug 失败时，excerpt/seo/category/tags 仍各自回填；失败字段保留原值并提示

验收：

- [x] 其中一个 action 抛错时，前端仍按字段回填其余成功项（后端逐项状态记录已具备）
- [x] 前端不会因为一个字段失败而丢弃全部生成结果
- [x] slug 单独失败时，摘要/SEO/分类/标签仍能回填到表单

### P0-2 修正回填与应用状态

> 修正（基于代码核验）：草稿模式已正确——`AiTaskDetail` 的 `canApply` 要求 `Boolean(item.postId)`，草稿项 postId 为 null，已显示“-”且行内标注“未保存草稿”，无需再做。真正的问题在编辑模式：一键生成只回填表单、不落库，但任务项 `applied=false`+有 postId，任务详情会显示“应用”按钮，点击 `applyPostAiTaskItem` 把原始 AI 输出直接写库，与用户在表单里的后续编辑分叉。

> 过度设计提醒：`AiTaskItem` 当前只有 `applied` 字段，新增 `formApplied` 需要 Prisma 迁移。但 metadata 已有 `oneClick`、task 已有 `type`/`source`，用现有信号即可，无需新字段、无需迁移。

待办（收窄后）：

- [x] 让 `canApply` 对 `post-article-info` 类型（或 metadata.oneClick=true）不显示落库“应用”按钮，改为展示“已回填表单”状态
- [x] 编辑模式不保留一键任务详情里的直接覆盖落库能力，统一回到编辑器表单确认后保存
- [x] 首选用现有 `type`/`source`/`metadata.oneClick` 判定，不新增 `formApplied` 字段

验收：

- [x] 一键生成成功后，任务详情不会误导用户重复应用
- [x] 不引入新的 Prisma 迁移即可区分“仅回填表单”和“已落库”

### P0-3 修复草稿任务重试/恢复

当前问题（已核验可复现）：

- `post-article-info` 在 `ai-batch-jobs.ts` 的 `targetedResumeTaskTypes` 白名单里
- 触发路径：点“重试失败项” → `tasks/[id]/retry/route.ts` 调 `resumeAiBatchTasks(retryTask.id)` → `runAiBatchTask` → 无 `postId` 的草稿项被标记 `SKIPPED("Post not found")`
- 同步请求中途崩溃留下的 active 草稿任务，被 resume 时同样会误 SKIP

方案对比：

- [x] 方案 C（首选，根因修法）：把 `post-article-info` 移出 `targetedResumeTaskTypes`，或按 `source !== "draft-post"` 网关化。`article-info` 是同步、请求内完成的任务，没有能正确恢复草稿态的异步 runner；一处改动同时消除“重试误跳过”和“resume 误跳过”
- [x] 方案 B（补充 UI）：草稿任务在任务详情禁用重试按钮，提示“请回到编辑器重新生成”
- [x] 方案 A 已评估为后续可选项，本轮通过禁用一键任务 retry 与移出 resume 白名单解决当前风险

推荐先做方案 C（根因），叠加方案 B（明确 UI 语义）；方案 A 视后续需要再做。注意：方案 B 只堵 UI 入口、不堵 resume 路径，不能单独使用。

验收：

- [x] 草稿一键任务不会被通用批处理恢复错误标记为 `SKIPPED`（无论经重试按钮还是 resume 轮询）
- [x] 任务详情页对草稿任务的重试入口语义清晰

### P0-4 增加回归测试

> 测试骨架已存在：`src/app/api/admin/ai/actions/article-info/__tests__/route.test.ts`，以扩展为主而非新建。

- [x] 一键生成部分失败时，前端按字段回填其余成功项（后端逐项状态已记录）
- [x] 草稿任务经重试按钮（`resumeAiBatchTasks`）与 resume 轮询两条路径都不会被误标 `SKIPPED`
- [x] 已回填任务项不会在任务详情误导用户重复应用
- [x] 编辑模式一键生成仍保留标题和正文

## P1：编辑体验与覆盖安全

### P1-1 增加一键生成预览确认

- [x] 展示即将替换的字段：slug、摘要、SEO 描述、分类、标签
- [x] 对 slug、分类、标签这类影响路由或归档的字段给出更明显提示
- [x] 当前值为空时显示“将补全”
- [x] 当前值已有内容时显示“将替换”

验收：

- [x] 用户能在覆盖前确认 AI 会改哪些字段
- [x] 用户可以取消应用 AI 结果

### P1-2 增加差异视图

- [x] slug：展示当前 slug 和 AI slug
- [x] 摘要/SEO：展示当前文本和 AI 文本
- [x] 分类：展示当前分类和 AI 分类
- [x] 标签：展示新增、保留、移除的标签

验收：

- [x] 覆盖风险字段有明确 diff
- [x] 标签变化不再只是整体替换

### P1-3 成功后展示任务入口

- [x] 一键生成成功后卡片和预览弹窗提供“查看 AI 任务”
- [x] 失败时也展示任务入口，方便看失败原因
- [x] 任务入口使用 `taskId` 跳转到 `/admin/ai/tasks/[id]`

验收：

- [x] 用户可以从编辑器追溯本次生成任务
- [x] 失败时无需去任务中心列表里手动查找

### P1-4 强化字段质量校验

- [x] slug 做唯一性预检查或保存前冲突提示
- [x] SEO 描述增加长度区间提示
- [x] 标签数量设置合理上限，避免生成过多弱相关标签
- [x] 分类/标签低置信度时只展示建议，不强制覆盖

验收：

- [x] AI 生成结果不会轻易造成 slug 冲突
- [x] SEO 描述长度更稳定
- [x] 标签结果更聚焦

### P1-5 增加组合结果语义

> 来源：原列为 P0-2，因成功响应已返回 `articleInfo`、任务详情也已逐项渲染输出（`AiTaskDetail` 的 `renderOutput`），属数据冗余、不阻塞 P0，故移入 P1。

- [x] 在任务 metadata 或输出中保存最终组合后的 `articleInfo`
- [x] 任务详情页优先展示组合结果，而不是只展示逐项 JSON
- [x] 保留逐项明细，便于排查具体 action 输出

建议展示字段：

- 最终 slug
- 摘要
- SEO 描述
- 分类
- 标签
- 是否部分成功
- 失败 action 列表

验收：

- [x] `post-article-info` 任务详情页能一眼看到最终文章信息
- [x] JSON 输出仍可作为调试信息保留

## P2：统一 AI 任务中心能力

### P2-1 迁移单项 AI 生成入口

- [x] 标题生成迁移到 `/api/admin/ai/actions`
- [x] slug 生成迁移到 `/api/admin/ai/actions`
- [x] 分类生成迁移到 `/api/admin/ai/actions`
- [x] 标签生成迁移到 `/api/admin/ai/actions`
- [x] 保留 `/api/admin/posts/metadata` 一段时间作为兼容层

验收：

- [x] 单项 AI 生成也进入任务中心
- [x] 单项生成可以追踪模型、输入、输出和失败原因

### P2-2 统一任务记录字段

- [x] 记录 action
- [x] 记录 modelId
- [x] 记录 inputSnapshot
- [x] 记录 output
- [x] 记录 applied / formApplied 语义（不新增字段，用任务类型和 metadata 区分表单回填）
- [x] 记录失败原因

验收：

- [x] 任务中心字段语义一致
- [x] 不同 AI 入口的输出结构可预测

### P2-3 统一 AI 辅助弹窗与一键生成的文案

- [x] 一键生成：面向“批量替换文章信息”
- [x] AI 辅助：面向“单项建议与人工选择”
- [x] 避免用户误以为两者是重复按钮

验收：

- [x] 编辑器内两个 AI 入口职责清晰
- [x] 用户能判断什么时候用一键生成，什么时候用单项辅助

### P2-4 更新接口目录

- [x] 同步 `src/lib/ai-interface-catalog.ts`
- [x] 标明哪些接口会落库
- [x] 标明哪些接口只回填表单
- [x] 标明任务类型和返回结构

验收：

- [x] AI 接口目录与真实实现一致
- [x] 后续维护者能通过目录理解入口差异

## P3：质量、成本与可观测性

### P3-1 增加生成质量评分

- [x] slug 可读性检查
- [x] SEO 长度检查
- [x] 摘要是否覆盖主题
- [x] 标签数量和命中率检查

### P3-2 记录模型与耗时指标

- [x] 每个 action 记录耗时
- [x] 每个 action 记录使用模型
- [x] 编辑器预览和任务输出中展示 action 耗时/模型元信息

### P3-3 增加 prompt 版本

- [x] 任务 metadata 记录 promptVersion
- [x] prompt 调整后能比较生成质量变化

### P3-4 增加成本保护

- [x] 内容过短时禁用一键生成
- [x] 重复点击时复用进行中的任务
- [x] 同一草稿短时间内避免重复消耗模型额度

## 影响文件预估

- `src/app/api/admin/ai/actions/article-info/route.ts`
- `src/components/posts/hooks/useAiActions.ts`
- `src/components/posts/AdminPostWorkspace.tsx`
- `src/components/admin/ai/AiTaskDetail.tsx`
- `src/components/admin/ai/AiTaskList.tsx`
- `src/lib/ai-batch-jobs.ts`
- `src/lib/ai-post-actions.ts`
- `src/lib/ai-tasks.ts`
- `src/lib/ai-interface-catalog.ts`
- `src/app/api/admin/ai/actions/article-info/__tests__/route.test.ts`
- `src/lib/__tests__/ai-batch-jobs.test.ts`
- `src/components/admin/ai/__tests__/*`

## 分批提交建议

### Commit 1：修正一键生成可靠性

- 部分成功返回（后端 `normalizeArticleInfo` 改为允许部分字段缺失）
- 前端部分回填（消费逐项 `data.items`）
- 失败提示
- P0-3 根因：`post-article-info` 移出 resume 白名单
- 路由测试（扩展现有）

### Commit 2：修正任务中心状态语义

- `canApply` 对一键生成隐藏落库按钮（用现有 type/source/oneClick，不加字段）
- 任务详情展示调整
- 草稿任务重试入口保护（方案 B）
- 组件测试

### Commit 3：增加覆盖预览

- 一键生成预览弹窗
- 字段 diff
- 任务详情入口
- 编辑器交互测试

### Commit 4：统一单项 AI 入口

- 单项生成迁移到任务中心
- 保留兼容接口
- 更新接口目录
- 端到端回归

## 验收标准

- [x] 一键生成过程中，任意单项失败不会丢弃所有已成功结果
- [x] 任务中心能准确表达“已生成 / 已回填表单 / 已应用落库”
- [x] 草稿一键生成任务不会被通用批处理恢复逻辑误处理
- [x] 编辑器中覆盖已有字段前有明确预览或确认
- [x] 单项 AI 生成和一键生成在用户心智上有清晰分工
- [x] 新增/调整逻辑有针对性测试覆盖
- [x] `pnpm lint` 通过
- [x] 相关测试通过，必要时补跑 `pnpm test`

## 当前状态

计划已生成并经代码核验修正（2026-05-24）：收窄 P0-1（后端逐项状态已具备，勿重写）、修正 P0-2（草稿已正确，避免新增 `formApplied` 字段）、为 P0-3 补充根因修法（移出 resume 白名单）、原“组合结果语义”从 P0 移入 P1-5。本轮已完成 P0-P3：一键生成改为预览确认后应用，单项生成迁移到任务中心，任务详情展示组合文章信息，接口目录已同步，输出记录耗时、模型、promptVersion 与质量检查，短内容和短时间重复请求有成本保护。
