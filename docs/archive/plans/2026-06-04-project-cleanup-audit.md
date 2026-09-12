# 项目冗余与旧文档清理审查

> 生成日期：2026-06-04  
> 范围：文档、源码候选冗余、public 资源、依赖、仓库本地工具资产  
> 状态：本轮清理与验证已完成；保留为审查证据与后续清理记录

## 结论摘要

当前项目没有类型或 lint 阻断，整体可维护性基础较好。主要问题不是业务代码失控，而是历史文档、agent 工具资产、未引用资源与少量替换后遗留代码持续堆积。

建议先清理会误导维护者的文档，再处理仓库资产边界，最后分批删除未引用源码和 public 资源。每批删除后都要跑对应验证，避免把测试辅助、Next 路由或 shadcn 内部依赖误删。

## 本轮处理记录

已执行：

- 将 `PROJECT_DOCS.md`、`TEST_REPORT.md`、`docs/project-major-issues-analysis.md` 原文移动到 `docs/archive/`，未修改旧文档正文。
- 将仍引用已删除工具目录或过期组件/端口结论的旧审计、旧计划、旧实施记录移动到 `docs/archive/`，未修改旧文档正文。
- 删除仓库内本地 agent / 工具资产：`.claude/`、`.codex/`、`.opencode/`、`.sisyphus/`。
- 删除 `tasks/` 历史任务日志与截图。
- 删除未引用 public 资源：Next 模板 SVG、旧 anime 图标、未引用 favicon 变体、未引用 `public/images/icons/*`、未使用 `.eot` 字体。
- 删除高置信未引用源码：`src/auth.ts`、旧首页组件、只被测试引用的旧过滤/滚动辅助模块、旧收藏项组件、未引用 `StatCard` 与 `useInspectorState`。
- 移除顶层重复依赖 `@radix-ui/react-alert-dialog`。
- 将低风险默认配置从旧个人标识收敛到 localhost / Inkforge：`.env.example`、SEO 默认 URL、AI 新闻 User-Agent、公开资料兜底、后台设置占位符；保留 `next.config.ts` 中旧域名的 HTTP/HTTPS 图片源，并允许可信图片源解析到本地/保留网段，以兼容本地生产环境中的数据库历史封面与头像；默认公开资料不再渲染空链接或 `mailto:null`。
- 更新 README / README.en 中旧文档链接到归档路径。
- 更新 `.gitignore`，防止本地 agent / tasks 产物重新入库。

## 验证基线

已执行：

- `pnpm exec tsc --noEmit`：通过。
- `pnpm lint`：通过。
- `pnpm test`：221 个测试文件、777 条用例全部通过。
- `pnpm build`：通过。
- 浏览器复查：本地生产服务 `http://localhost:3000`，已登录后台后检查 50 条页面/资源路由，桌面 0 失败；移动端抽检首页、文章详情、后台首页 0 失败。报告见 `test-results/browser-check-final/browser-audit-final-summary.md`。
- `rg -n "\.sisyphus|blog-optimization-docs-contract" docs README.md README.en.md src -g "!docs/archive/**"`：除本清理审查文档的处理记录外无活跃引用。
- `rg -n "roydust|RoyDust|RoyDustBlog" src -g "*.ts" -g "*.tsx" -g "!**/__tests__/**"`：无生产源码命中。
- `rg -n "HomeHero|HomeFeaturedGrid|HomeDiscoveryGrid|HomeReaderBanner|PostCardSecondary|filterPosts|hasReachedScrollThreshold|BookmarkShelfItem|StatCard|useInspectorState|@/auth" src -g "*.ts" -g "*.tsx"`：无命中。

## P0：先处理会误导维护者的旧文档

### 1. `PROJECT_DOCS.md` 已明显过时

证据：

- `PROJECT_DOCS.md` 仍写开发服务器为 `http://localhost:3001`，但 `package.json` 的 `pnpm dev` 未指定端口，README 写的是 `http://localhost:3000`。
- 文档引用 `src/components/UserNav.tsx`、`src/components/LogoutButton.tsx`，当前文件已不存在。
- 文档列出的 `src/app/tags/[slug]/page.tsx`、`src/app/categories/[slug]/page.tsx` 不符合当前 `(public)` 路由结构。
- 文档末尾标注最后更新为 `2026-03-02`。

处理结果：

- 已原文归档到 `docs/archive/PROJECT_DOCS.md`。
- 未修改旧文档正文。
- 当前开发端口、路由结构、认证入口、后台入口以 README / `src/app` / `package.json` 为准。

### 2. `TEST_REPORT.md` 仍是早期测试报告

证据：

- 仍写 `/write` 未登录可访问且需确认；当前 `/write` 已重定向到 `/admin/posts/new`。
- 仍把 `set-admin` 写成可用管理能力；当前 `/api/admin/set-admin` 是有意禁用的 404 安全桩。
- 仍写测试通过率 95%，与当前 786 条 Vitest 覆盖不一致。
- 生成时间为 `2026-03-02`。

处理结果：

- 已原文归档到 `docs/archive/TEST_REPORT.md`。
- 未修改旧文档正文。
- 当前测试基线维护在本清理文档与 README 命令中，避免继续扩散静态测试报告。

### 3. `docs/project-major-issues-analysis.md` 会产生严重误导

证据：

- 仍标“致命问题”，包括登录/登出无效、JWT 可伪造、NextAuth 适配器不兼容、Dockerfile 嵌入密钥等。
- 后续健康度分析已逐项说明这些问题多数已修复或不再成立。
- 其中 `set-admin` “死代码”结论也已不成立，当前是刻意禁用的安全桩。

处理结果：

- 已原文归档到 `docs/archive/project-major-issues-analysis.md`。
- 未修改旧文档正文。
- 保留作为安全整改历史记录，活跃文档以本清理文档和当前测试结果为准。

### 4. 旧执行链路文档已归档

证据：

- 旧优化链路文档仍引用已删除的 `.sisyphus/plans/blog-optimization-roadmap.md` 或已删除的 `blog-optimization-docs-contract` 测试。
- 旧审计、旧计划文档仍引用已移除组件、过期端口或已失效整改结论。

处理结果：

- 已将相关旧审计、旧计划、旧实施记录原文移动到 `docs/archive/`、`docs/archive/plans/`、`docs/archive/implementation/`。
- 未修改旧文档正文。

## P1：清理仓库边界与本地工具资产

### 1. agent / 本地工具配置被 Git 跟踪

已跟踪候选：

- `.codex/skills/ui-ux-pro-max/**`
- `.opencode/**`
- `.sisyphus/**`
- `.claude/settings.local.json`
- `.vscode/settings.json`

风险：

- 这些内容更像本地 agent 工作流、个人工具配置或审查证据，不一定属于产品源码。
- `.claude/settings.local.json` 包含本地权限白名单，尤其不适合作为通用项目配置。
- 后续不同 agent 可能继续把本地状态写进仓库。

建议动作：

- 明确哪些是项目资产，哪些是个人/工具资产。
- 个人配置迁到全局目录或加入 `.gitignore`。
- 如果需要保留 agent 工作流，只保留稳定、可复用、对团队有说明价值的最小文档。

### 2. `tasks/` 跟踪了历史截图和任务日志

证据：

- `tasks/` 约 2.4 MB。
- 跟踪了 6 张历史截图：`sidebar-home-before.png`、`sidebar-home-light-before.png`、`home-sidebar-ai-daily-aligned.png` 等。
- `tasks/todo.md` 包含多轮历史任务记录，不是当前项目说明。

建议动作：

- 历史截图移到 `docs/archive/assets/` 或直接从 Git 删除。
- `tasks/lessons.md` 如确有长期价值，可转成 `docs/maintenance/lessons.md`。
- `tasks/todo.md` 不建议长期作为项目事实来源，避免与真实代码状态漂移。

## P2：源码冗余候选

以下是静态引用扫描得到的候选，不建议一次性全删。应按小批次删除，每批跑 `tsc`、`lint` 和相关测试。

### 1. 高置信未引用

- `src/auth.ts`：搜索未发现生产引用；内容像 Auth.js v5 风格 shim，但当前依赖是 `next-auth@4`，实际入口为 `src/app/api/auth/[...nextauth]/route.ts` + `src/lib/auth.ts`。
- `src/components/admin/primitives/StatCard.tsx`：当前无生产引用。
- `src/hooks/useInspectorState.ts`：当前无引用。

建议动作：

- 删除前再次执行 `rg "@/auth|src/auth|StatCard|useInspectorState"`。
- 删除后跑 `pnpm exec tsc --noEmit`、`pnpm lint`。

### 2. 首页旧组件候选

候选：

- `src/components/blog/HomeHero.tsx`
- `src/components/blog/HomeFeaturedGrid.tsx`
- `src/components/blog/HomeDiscoveryGrid.tsx`
- `src/components/blog/HomeReaderBanner.tsx`
- `src/components/blog/PostCardSecondary.tsx`（主要被旧 HomeFeaturedGrid 使用）

证据：

- 当前首页 `src/app/(public)/page.tsx` 只组合 `HomeAiDailyStrip` 与 `HomeLatestPosts`。
- `src/components/blog/index.ts` 仍导出多个旧首页组件，容易让后续误用。

建议动作：

- 先从 `src/components/blog/index.ts` 移除未使用导出，跑测试确认没有外部依赖。
- 再删除组件文件与只服务于这些组件的测试。
- 保留当前首页真实使用的 `HomeAiDailyStrip`、`HomeLatestPosts`。

### 3. 只被测试引用的辅助代码

候选：

- `src/components/blog/posts-filter.ts`
- `src/components/blog/scroll-threshold.ts`
- `src/components/bookmarks/BookmarkShelfItem.tsx`

证据：

- `posts-filter.ts` 与 `scroll-threshold.ts` 只被对应测试引用；当前列表加载已使用 `IntersectionObserver`。
- `BookmarkShelfItem.tsx` 只被自身测试引用；当前书签页内联渲染收藏项。

建议动作：

- 如果这些是旧实现残留，连同对应测试删除。
- 如果想保留为未来复用，需给出生产引用或迁到明确的实验/参考目录，否则会增加维护噪声。

### 4. 认证 session 路由需复核

候选：

- `src/app/api/auth/session/route.ts`

风险：

- 项目同时存在 NextAuth catch-all `src/app/api/auth/[...nextauth]/route.ts`。
- 自定义 `/api/auth/session` 会覆盖 NextAuth 默认 session 端点，但当前仅返回 `{ user }`。
- `SessionProvider`、`getSession()`、`useSession()` 通常依赖 NextAuth 客户端协议，需确认这里是否有意为之。

建议动作：

- 若没有明确需求，优先交回 NextAuth catch-all 管理。
- 若保留，补测试证明 `next-auth/react` 客户端行为不受影响。

## P3：public 资源与体积清理

`public/` 总量约 50 MB，主要由多格式字体、旧图标和兜底图构成。

### 1. 未引用资源候选

静态扫描未发现引用：

- `public/file.svg`
- `public/globe.svg`
- `public/next.svg`
- `public/vercel.svg`
- `public/window.svg`
- `public/font/AlibabaPuHuiTi-3-65-Medium.eot`
- `public/icons/anime-blog-icon.png`
- `public/icons/anime-blog-icon-v2.png`
- `public/icons/anime-blog-icon-v3.png`
- `public/icons/anime-blog-icon-v4.png`
- `public/icons/favicon-16.png`
- `public/icons/favicon-48.png`
- `public/icons/favicon-256.png`
- `public/images/icons/icon_book_cat.png`
- `public/images/icons/icon_chibi_kano.png`

建议动作：

- 先删除 Next 模板 SVG 与未使用旧图标。
- 字体只保留当前实际加载需要的格式；优先保留 `woff2`，确认是否还需要 `woff`、`ttf`、`otf`。
- 删除后跑 `pnpm build`，并打开首页、文章页、OG 图片相关路径做视觉检查。

### 2. 大体积文件关注

最大文件：

- `public/font/AlibabaPuHuiTi-3-65-Medium.ttf`：约 8.4 MB。
- `public/font/AlibabaPuHuiTi-3-65-Medium.eot`：约 8.4 MB。
- `public/font/AlibabaPuHuiTi-3-65-Medium.otf`：约 7.2 MB。
- `public/imgs/Error.png`：约 6.2 MB。
- `public/font/AlibabaPuHuiTi-3-65-Medium.woff`：约 5.7 MB。
- `public/font/AlibabaPuHuiTi-3-65-Medium.woff2`：约 5.5 MB。

建议动作：

- 字体做格式瘦身或子集化。
- `Error.png` 如果只是加载失败兜底图，建议压缩或替换为轻量 SVG/WEBP。

## P4：依赖清理候选

### 1. `@radix-ui/react-alert-dialog`

证据：

- `package.json` 直接声明 `@radix-ui/react-alert-dialog`。
- 当前源码 AlertDialog 实现从聚合包 `radix-ui` 导入。
- `pnpm why @radix-ui/react-alert-dialog` 显示它同时作为顶层依赖和 `radix-ui` 子依赖存在。

建议动作：

- 可评估移除顶层 `@radix-ui/react-alert-dialog`。
- 移除后跑 `pnpm install`、`pnpm exec tsc --noEmit`、`pnpm lint`、相关 Dialog 测试。

### 2. `date-fns` 不建议直接删

证据：

- 项目源码未直接 import `date-fns`。
- `pnpm why date-fns` 显示它满足 `@base-ui/react` / `react-day-picker` 依赖链。

建议动作：

- 暂不删除，除非同步确认 `@base-ui/react` / `react-day-picker` 的 peer 需求不再需要。

## P5：品牌与配置漂移

候选：

- `.env.example` 中 `NEXTAUTH_URL` / `NEXT_PUBLIC_SITE_URL` 仍是 `http://roydust.top`。
- `src/lib/seo.ts` 默认站点 URL 仍是 `http://roydust.top`。
- `src/lib/ai-news-fetchers.ts` 默认 UA 是 `RoyDustBlog-AiNews/1.0`。
- `src/lib/public-profile-data.ts` 仍有 `https://github.com/RoyDust`。
- `next.config.ts` 同时允许 `http://project.roydust.top` 和 `https://project.roydust.top`。

建议动作：

- 示例配置改成 `http://localhost:3000`，生产域名放注释说明。
- 代码兜底值中性化或统一成 Inkforge。
- 如果生产只用 HTTPS，移除 `http://project.roydust.top` 图片源。

## 建议执行顺序

1. 已完成：文档归档：`PROJECT_DOCS.md`、`TEST_REPORT.md`、`docs/project-major-issues-analysis.md`，以及仍引用已删除工具目录或过期组件/端口结论的旧审计、旧计划、旧实施记录。
2. 已完成：仓库边界清理：`.claude/`、`.opencode/`、`.sisyphus/`、`.codex/`、`tasks/`。
3. 已完成：public 资源低风险删除：Next 模板 SVG、未引用旧图标、未使用 `.eot` 字体。
4. 已完成：源码小批次删除：`src/auth.ts`、未引用组件、只被测试引用的旧辅助模块。
5. 已完成：依赖清理：移除顶层重复 `@radix-ui/react-alert-dialog`。
6. 已完成：品牌与配置兜底统一。
7. 待验证：最后做一次全量验证：`tsc`、`lint`、`test`、`build`，必要时补 Playwright 冒烟测试。

## 每批清理后的验证清单

最小验证：

```bash
pnpm exec tsc --noEmit
pnpm lint
```

源码或依赖清理：

```bash
pnpm test
pnpm build
```

public 资源清理：

```bash
pnpm build
pnpm test src/__tests__/next-config-images.test.ts
pnpm test src/app/__tests__/manifest.test.ts src/app/__tests__/opengraph-image.test.ts
```

文档清理：

```bash
rg -n "3001|UserNav|LogoutButton|致命问题|set-admin" README.md docs -g "!docs/archive/**" -g "!docs/plans/2026-06-04-project-cleanup-audit.md"
```

## 剩余风险

- 静态引用扫描可能漏掉动态 import、文档示例、外部消费者或未来计划依赖。
- shadcn 组件之间存在内部依赖，不能只按“无页面直接 import”删除。
- public 资源删除后仍建议做一次人工视觉检查，尤其 favicon、manifest、OG 图片、字体加载和图片兜底。
- 若外部部署或文档系统直接链接了已归档文档，需要同步调整外部入口。
