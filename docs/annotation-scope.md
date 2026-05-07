# 代码注释增强范围说明

## 目标

本轮工作不是机械地给每一行代码补注释，而是为**核心文件、关键导出函数、复杂辅助方法、重要 API 路由**增加高价值中文备注，降低以下成本：

- 新成员阅读成本
- AI 在检索与修改代码时的理解成本
- 跨模块排查副作用时的定位成本

## 注释原则

1. **优先解释职责边界**：这个文件负责什么，不负责什么。
2. **优先解释副作用**：是否会查库、写库、鉴权、刷新缓存、调用外部服务。
3. **优先解释输入输出**：导出函数、路由处理器、复杂组件需要明确前后置条件。
4. **避免注释噪音**：简单 JSX、单纯转发、显而易见的常量不做重复描述。
5. **以中文为主**：与项目默认语言保持一致，方便团队和 AI 统一理解。

## 优先级分层

### P0：基础设施与跨模块公共能力

- `src/app/layout.tsx`
- `src/components/AppProviders.tsx`
- `src/lib/auth.ts`
- `src/lib/api-auth.ts`
- `src/lib/api-errors.ts`
- `src/lib/prisma.ts`
- `src/lib/cache.ts`
- `src/lib/seo.ts`
- `src/lib/slug.ts`
- `src/lib/validation.ts`

### P1：核心业务链路

- `src/app/api/posts/[slug]/route.ts`
- `src/components/posts/AdminPostWorkspace.tsx`
- `src/lib/ai-news.ts`
- `src/lib/ai-authoring.ts`
- `src/lib/ai-models.ts`
- `src/lib/ai-post-actions.ts`
- `src/lib/ai-tasks.ts`
- `src/lib/ai-review.ts`

### P2：后台工作台与前台阅读路径

- `src/components/posts/EditorWorkspace.tsx`
- `src/components/posts/MarkdownEditor.tsx`
- `src/components/posts/PublishChecklist.tsx`
- `src/app/admin/page.tsx`
- `src/app/admin/posts/page.tsx`
- `src/app/admin/ai-news/page.tsx`
- `src/app/(public)/page.tsx`
- `src/app/(public)/posts/[slug]/page.tsx`

## 本轮已执行的准备工作

- 在 `.worktrees/code-annotations-pass-1` 创建隔离工作区
- 安装依赖并补跑 `pnpm prisma generate`
- 通过基线校验：
  - `pnpm lint`
  - `pnpm test`

## 已完成批次

### 第一批：基础设施与公共能力

已覆盖：

- `src/app/layout.tsx`
- `src/components/AppProviders.tsx`
- `src/lib/auth.ts`
- `src/lib/api-auth.ts`
- `src/lib/api-errors.ts`
- `src/lib/prisma.ts`
- `src/lib/cache.ts`
- `src/lib/seo.ts`
- `src/lib/slug.ts`
- `src/lib/validation.ts`
- `src/app/api/posts/[slug]/route.ts`
- `src/components/posts/AdminPostWorkspace.tsx`
- `src/lib/ai-news.ts`

补充内容以：

- 文件级职责说明
- 导出函数 / 组件说明
- 路由级别权限与副作用说明
- 复杂模块的阅读顺序提示

为主。

### 第二批：AI 编排与后台编辑主链路

已覆盖：

- `src/lib/ai-authoring.ts`
- `src/lib/ai-models.ts`
- `src/lib/ai-post-actions.ts`
- `src/lib/ai-tasks.ts`
- `src/app/admin/page.tsx`
- `src/components/posts/EditorWorkspace.tsx`
- `src/components/posts/MarkdownEditor.tsx`

这一批重点补充：

- AI 模型与任务中心的数据流说明
- 草稿 / 正式文章写入边界
- 后台首页数据聚合职责
- 编辑器上传、摘要生成、图片粘贴上传等交互说明

### 第三批：发布检查、前台阅读路径与核心支撑模块

已覆盖：

- `src/lib/ai-review.ts`
- `src/components/posts/PublishChecklist.tsx`
- `src/app/admin/posts/page.tsx`
- `src/app/admin/ai-news/page.tsx`
- `src/app/(public)/page.tsx`
- `src/app/(public)/posts/[slug]/page.tsx`
- `src/components/blog/PostsListingClient.tsx`
- `src/components/admin/ai/PostAiWorkspace.tsx`
- `src/lib/posts.ts`
- `src/lib/post-summary.ts`
- `src/lib/cover-assets.ts`
- `src/app/api/search/route.ts`
- `src/app/api/admin/ai/actions/route.ts`
- `src/app/api/admin/posts/review/route.ts`

这一批重点补充：

- 发布前 AI 审稿与检查面板逻辑
- 首页、文章详情页、文章列表的读者路径说明
- 摘要、封面、搜索、AI 动作等核心支撑模块的职责边界
- 若干关键后台 API 的权限与副作用说明

### 第四批：AI 日报子模块补齐

已覆盖：

- `src/lib/ai-news-candidates.ts`
- `src/lib/ai-news-dedupe.ts`
- `src/lib/ai-news-enrichment.ts`
- `src/lib/ai-news-fetchers.ts`
- `src/lib/ai-news-renderer.ts`
- `src/lib/ai-news-scoring.ts`

这一批重点补充：

- 候选持久化与状态回写职责
- URL 去重与语义去重边界
- 事实卡生成、引用校验与覆盖率计算
- 多源抓取器的输入输出契约
- 评分、降权、最终筛选规则
- 日报 Markdown 正文渲染结构

## 当前完成定义

当前已覆盖项目中最核心的几条链路：

- 应用基础设施与鉴权
- 公共内容缓存与 SEO
- 后台文章编辑、发布与 AI 辅助
- AI 新闻日报流水线
- 后台文章列表与 AI 日报控制台
- 前台首页、文章详情页、无限列表与站内搜索
- 摘要生成、封面素材、公共文章查询等核心支撑模块

对于“主要重要文件和方法增加备注，方便 AI / 人类理解”这一目标，本轮已达到可交付状态。
