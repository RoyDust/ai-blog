# 代码注释增强（第一轮）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为博客系统的核心基础设施、重要 API 路由与复杂后台工作台补充高价值中文备注，降低人类与 AI 的理解成本。

**Architecture:** 本轮不追求全仓库逐行注释，而是先覆盖跨模块引用最频繁、最容易产生副作用的核心文件。注释分为文件级职责说明、导出函数说明、复杂内部辅助函数说明三层。

**Tech Stack:** Next.js 16、TypeScript、NextAuth、Prisma、Vitest

---

### Task 1: 建立隔离工作区与基线验证

**Files:**
- Create: `.worktrees/code-annotations-pass-1/`
- Modify: `docs/annotation-scope.md`

- [x] 创建独立 worktree：`git worktree add .worktrees/code-annotations-pass-1 -b chore/code-annotations-pass-1`
- [x] 安装依赖：`pnpm install`
- [x] 生成 Prisma Client：`pnpm prisma generate`
- [x] 运行基线检查：`pnpm lint && pnpm test`
- [x] 记录注释范围文档：`docs/annotation-scope.md`

### Task 2: 标注基础设施核心文件

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/components/AppProviders.tsx`
- Modify: `src/lib/auth.ts`
- Modify: `src/lib/api-auth.ts`
- Modify: `src/lib/api-errors.ts`
- Modify: `src/lib/prisma.ts`
- Modify: `src/lib/cache.ts`
- Modify: `src/lib/seo.ts`
- Modify: `src/lib/slug.ts`
- Modify: `src/lib/validation.ts`

- [x] 为文件头部增加职责说明
- [x] 为关键导出函数增加输入/输出/副作用说明
- [x] 为复杂校验与数据库初始化逻辑补充阅读提示

### Task 3: 标注重要文章路由与后台工作台

**Files:**
- Modify: `src/app/api/posts/[slug]/route.ts`
- Modify: `src/components/posts/AdminPostWorkspace.tsx`

- [x] 为文章 GET / PATCH / DELETE 路由补充权限与缓存失效说明
- [x] 为后台文章工作台补充模式切换、草稿恢复与跳转策略说明

### Task 4: 标注 AI 日报主编排模块

**Files:**
- Modify: `src/lib/ai-news.ts`

- [x] 为模块头部补充整体流水线说明
- [x] 为候选抓取、草稿生成、总入口函数增加注释
- [x] 后续按需继续下沉到去重、评分、富化子模块

### Task 5: 验证与后续扩展

**Files:**
- Modify: `docs/annotation-scope.md`

- [x] 运行 `pnpm lint`
- [x] 运行 `pnpm test`
- [x] 汇总本轮已覆盖文件与下一批候选文件
