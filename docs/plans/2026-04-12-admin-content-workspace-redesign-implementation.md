# Admin Content Workspace Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the entire `/admin` surface into a unified editorial workspace with stronger information hierarchy, clearer state controls, denser content operations, and a single taxonomy studio.

**Architecture:** Keep the existing App Router admin routes and API contracts, but rebuild the shell and page composition around a content-workbench model. Introduce a small set of reusable admin workspace primitives first, then migrate overview, posts, editor, comments, and taxonomy onto that shared structure while preserving existing permissions and CRUD flows.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Vitest + Testing Library, existing admin API routes

---

## Scope Notes

- This plan rewrites the human admin UI only. It does not change admin auth boundaries or the AI draft API contract.
- Keep existing `/api/admin/*` endpoints as the data layer unless a task explicitly introduces a small companion endpoint.
- Preserve current route access for `/admin`, `/admin/posts`, `/admin/posts/new`, `/admin/posts/[id]/edit`, `/admin/comments`, `/admin/categories`, and `/admin/tags`.
- Consolidate category and tag management into a single taxonomy studio route, then redirect the legacy category/tag routes.
- Keep visual direction in the "content workbench" lane: quiet surfaces, clear state, strong inspector patterns, low motion.
- Shift the admin visual identity from cool utility blue toward a warmer editorial palette: paper-like background, white surfaces, thin borders, low-shadow containers, and soft status chips.
- Admin theming must be scoped under `.admin-theme` and must override the project's existing semantic variables (`--background`, `--surface`, `--surface-alt`, `--foreground`, `--muted`, `--border`, `--primary`, `--brand`, `--ring`, and status tokens). Do not introduce a second parallel `--color-*` token system for admin pages.
- The admin theme should use `#F9F9F8` as the background, `#FFFFFF` as the main surface, `#F1F1F0` as the alternate surface, `rgba(0,0,0,0.08)` as the base border, `#18181B` as the decisive action color, and `#4F46E5` as the editorial accent for links, focus, and active helper states.
- Status feedback should stay soft: shallow background fills with darker text, not saturated solid pills. Keep success/warning semantics but make them editorial rather than dashboard-like.
- The post editor inspector must not squeeze the editor below the `xl` breakpoint. Below `xl`, inspector sections should switch to a single active panel model driven by URL state such as `?panel=metadata`.
- Table-heavy screens must expose explicit loading and in-flight action feedback. Bulk actions and row-level status toggles should use optimistic updates with rollback on failure.
- Keyboard shortcuts are out of scope for this rewrite phase. If the new workbench lands well, they can be planned as a follow-up productivity pass.

## Design References

- `awesome-design-systems`: curation source only, not a direct template.
- Contentful Forma 36: content workbench layout, inspector logic, editorial information hierarchy.
- Adobe Spectrum: dense form layout and action grouping.
- AWS Cloudscape: table operations, batch controls, and state handling.

## Admin Theme Tokens

Use the existing semantic variable layer instead of introducing separate Tailwind-scoped token names. The admin palette should be wired through `.admin-theme` with overrides like:

```css
.admin-theme {
  --background: #f9f9f8;
  --surface: #ffffff;
  --surface-alt: #f1f1f0;
  --surface-elevated: #ffffff;
  --surface-contrast: #ececea;

  --foreground: #111827;
  --text-body: #30343b;
  --text-muted: #71717a;
  --muted: var(--text-muted);

  --border: rgba(0, 0, 0, 0.08);
  --border-strong: rgba(0, 0, 0, 0.12);
  --line-color: rgba(0, 0, 0, 0.08);

  --primary: #18181b;
  --brand: #4f46e5;
  --brand-strong: #4338ca;
  --ring: color-mix(in srgb, #4f46e5 35%, transparent);

  --success-surface: #ecfdf5;
  --success-border: rgba(16, 185, 129, 0.18);
  --success-foreground: #047857;
  --warning-surface: #fffbeb;
  --warning-border: rgba(245, 158, 11, 0.2);
  --warning-foreground: #b45309;

  --shadow-card: 0 1px 2px rgba(0, 0, 0, 0.02);
  --shadow-card-hover: 0 6px 20px rgba(0, 0, 0, 0.04);

  --ambient-primary: transparent;
  --ambient-secondary: transparent;
}
```

This keeps the Tailwind v4 `@theme inline` mapping intact, because the app already maps `--color-*` tokens from these semantic variables in `src/app/globals.css`.

## Acceptance Criteria

- The admin shell presents grouped editorial navigation with lighter breadcrumb emphasis and consistent page framing.
- The admin overview reads like an editorial home, not a metrics card wall.
- The posts list becomes a content queue with stronger filters, status controls, and row-level context.
- The create/edit article screens clearly separate editor surface, status controls, publish actions, and metadata.
- The create/edit article inspector keeps its active panel in the URL and collapses into a single-panel mobile pattern below `xl`.
- The comments screen becomes a moderation inbox with status-focused triage.
- Category and tag management are unified into a taxonomy studio, while legacy routes continue to resolve through redirects.
- Legacy `/admin/categories` and `/admin/tags` redirects preserve incoming query params while appending the new `tab` param.
- Existing targeted admin tests are updated, and new tests cover shell, dashboard, posts workbench, comments inbox, taxonomy studio, and the full create-to-publish content flow.

## File Structure

- `src/components/admin/shell/config.ts`
  Redefine the admin information architecture and active-route metadata around a workspace model.
- `src/styles/theme-variables.css`
  Add the admin-scoped warm editorial palette through `.admin-theme`, reusing the existing semantic variable layer.
- `src/components/admin/shell/AdminLayout.tsx`
  Apply the new two-layer shell: grouped navigation, lighter header chrome, stronger content framing, and the `.admin-theme` scope wrapper.
- `src/components/admin/shell/AdminHeader.tsx`
  Reduce header noise and align the page title zone with the new workbench structure.
- `src/components/admin/shell/AdminSider.tsx`
  Rebuild grouped nav sections and visual selected state for workbench navigation.
- `src/components/admin/primitives/WorkspacePanel.tsx`
  New surface primitive for major content blocks, queues, inspector cards, dense sections, and richer empty states.
- `src/components/admin/primitives/Toolbar.tsx`
  New compact action/filter row primitive for list pages.
- `src/components/admin/DataTable.tsx`
  Evolve into a denser collection view with better summary, toolbar slots, loading states, and action grouping.
- `src/app/admin/page.tsx`
  Rebuild as editorial home with work queues, review surfaces, and recent changes.
- `src/app/admin/posts/page.tsx`
  Rebuild as a content queue, using improved table framing and clearer status controls.
- `src/components/posts/CreatePostWorkspace.tsx`
  Reframe new-post experience into explicit workbench + inspector structure.
- `src/app/admin/posts/[id]/edit/page.tsx`
  Rebuild edit experience around a durable editorial inspector and top-level action bar.
- `src/hooks/useInspectorState.ts`
  Shared editor inspector state hook for active panel, URL sync, and mobile-panel switching.
- `src/components/posts/EditorWorkspace.tsx`
  Support cleaner content-first hierarchy and action grouping inside the editor surface.
- `src/components/posts/PublishChecklist.tsx`
  Recast checklist into an inspector-friendly readiness module.
- `src/app/admin/comments/page.tsx`
  Rebuild as a moderation inbox with status buckets and higher-signal row context.
- `src/components/admin/taxonomy/TaxonomyStudio.tsx`
  New shared studio component for category/tag maintenance.
- `src/app/admin/taxonomy/page.tsx`
  New consolidated taxonomy route.
- `src/app/admin/categories/page.tsx`
  Redirect to `/admin/taxonomy?tab=categories`.
- `src/app/admin/tags/page.tsx`
  Redirect to `/admin/taxonomy?tab=tags`.
- `src/app/admin/__tests__/page.test.tsx`
  Update dashboard expectations for the editorial-home rewrite.
- `src/app/admin/__tests__/admin-density.test.tsx`
  Update posts workbench expectations.
- `src/app/admin/__tests__/admin-editor.test.tsx`
  Extend editor expectations for the inspector-based workbench.
- `src/app/admin/__tests__/editor-publish-flow.test.tsx`
  Cover the create -> metadata -> readiness -> publish flow at component level.
- `src/app/admin/__tests__/comments-page.test.tsx`
  Update comments page expectations for moderation inbox layout.
- `src/app/admin/__tests__/taxonomy-studio.test.tsx`
  New test coverage for the shared taxonomy studio.
- `src/app/admin/__tests__/taxonomy-redirects.test.tsx`
  Verify legacy taxonomy routes preserve search params while redirecting.
- `src/components/admin/__tests__/admin-layout.test.tsx`
  Update shell expectations for grouped navigation and reframed layout.

## Task Order

1. Rebuild the admin shell and workspace primitives.
2. Rewrite the overview into an editorial home.
3. Rewrite the posts list into a content queue.
4. Rewrite create/edit post screens into a true editor workbench.
5. Rewrite comments into a moderation inbox.
6. Consolidate category/tag management into a taxonomy studio.
7. Run targeted verification, then full static verification.

---

### Task 1: Rebuild the Admin Shell and Workspace Primitives

**Files:**
- Create: `src/components/admin/primitives/WorkspacePanel.tsx`
- Create: `src/components/admin/primitives/Toolbar.tsx`
- Modify: `src/components/admin/shell/config.ts`
- Modify: `src/styles/theme-variables.css`
- Modify: `src/components/admin/shell/AdminLayout.tsx`
- Modify: `src/components/admin/shell/AdminHeader.tsx`
- Modify: `src/components/admin/shell/AdminSider.tsx`
- Modify: `src/components/admin/__tests__/admin-layout.test.tsx`
- Modify: `src/components/admin/shell/__tests__/config.test.ts`

- [ ] **Step 1: Write the failing shell tests**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/taxonomy",
}));

describe("admin layout", () => {
  test("renders grouped editorial navigation and workspace framing", async () => {
    const { AdminLayout } = await import("@/components/admin/shell/AdminLayout");

    render(
      <AdminLayout userLabel="Admin">
        <div>Taxonomy content</div>
      </AdminLayout>,
    );

    expect(screen.getByRole("navigation", { name: "Admin navigation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "分类与标签" })).toHaveAttribute("href", "/admin/taxonomy");
    expect(screen.getByText("工作台")).toBeInTheDocument();
    expect(screen.getByText("Taxonomy content")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the shell tests to verify they fail**

Run: `pnpm exec vitest run src/components/admin/__tests__/admin-layout.test.tsx src/components/admin/shell/__tests__/config.test.ts`

Expected: FAIL because the current shell still exposes the older grouped nav model and does not include the taxonomy route.

- [ ] **Step 3: Implement the shared shell primitives and nav rewrite**

Create `src/components/admin/primitives/WorkspacePanel.tsx`:

```tsx
import type { ReactNode } from "react";

interface WorkspacePanelProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  emptyState?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function WorkspacePanel({ title, description, actions, emptyState, children, className = "" }: WorkspacePanelProps) {
  return (
    <section className={`ui-surface rounded-3xl border border-[var(--border)] bg-[var(--surface)] ${className}`}>
      {(title || description || actions) ? (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div>
            {title ? <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm text-[var(--muted)]">{description}</p> : null}
          </div>
          {actions}
        </header>
      ) : null}
      <div className="px-5 py-4">
        {emptyState ?? children}
      </div>
    </section>
  );
}
```

Create `src/components/admin/primitives/Toolbar.tsx`:

```tsx
import type { ReactNode } from "react";

interface ToolbarProps {
  leading?: ReactNode;
  trailing?: ReactNode;
}

export function Toolbar({ leading, trailing }: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{leading}</div>
      <div className="flex flex-wrap items-center gap-2">{trailing}</div>
    </div>
  );
}
```

Update `src/components/admin/shell/config.ts`:

```ts
export const adminNavItems: AdminNavItem[] = [
  { href: "/admin", label: "总览", group: "工作台", icon: LayoutDashboard },
  { href: "/admin/posts", label: "文章", group: "内容", icon: FileText },
  { href: "/admin/comments", label: "评论", group: "互动", icon: MessageSquare },
  { href: "/admin/taxonomy", label: "分类与标签", group: "结构", icon: FolderTree },
];
```

Update `src/styles/theme-variables.css` with an admin-scoped palette instead of a second token system:

```css
.admin-theme {
  --background: #f9f9f8;
  --surface: #ffffff;
  --surface-alt: #f1f1f0;
  --surface-elevated: #ffffff;
  --surface-contrast: #ececea;
  --foreground: #111827;
  --text-body: #30343b;
  --text-muted: #71717a;
  --muted: var(--text-muted);
  --border: rgba(0, 0, 0, 0.08);
  --border-strong: rgba(0, 0, 0, 0.12);
  --line-color: rgba(0, 0, 0, 0.08);
  --primary: #18181b;
  --brand: #4f46e5;
  --brand-strong: #4338ca;
  --ring: color-mix(in srgb, #4f46e5 35%, transparent);
  --success-surface: #ecfdf5;
  --success-border: rgba(16, 185, 129, 0.18);
  --success-foreground: #047857;
  --warning-surface: #fffbeb;
  --warning-border: rgba(245, 158, 11, 0.2);
  --warning-foreground: #b45309;
  --shadow-card: 0 1px 2px rgba(0, 0, 0, 0.02);
  --shadow-card-hover: 0 6px 20px rgba(0, 0, 0, 0.04);
  --ambient-primary: transparent;
  --ambient-secondary: transparent;
}
```

Update `src/components/admin/shell/AdminLayout.tsx` so the main area reads like a workspace, not a dashboard shell:

```tsx
<div className="admin-theme min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased">
  <div className="grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
    <AdminSider pathname={pathname} userLabel={userLabel} />
    <div className="min-w-0">
      <AdminHeader currentLabel={meta.currentLabel} groupLabel={meta.currentGroup} />
      <main className="mx-auto w-full max-w-[1600px] px-4 py-5 lg:px-6 lg:py-6">
        <div className="space-y-4">
          <AdminBreadcrumbs items={meta.crumbs} />
          {children}
        </div>
      </main>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Rerun the shell tests**

Run: `pnpm exec vitest run src/components/admin/__tests__/admin-layout.test.tsx src/components/admin/shell/__tests__/config.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/primitives/WorkspacePanel.tsx src/components/admin/primitives/Toolbar.tsx src/styles/theme-variables.css src/components/admin/shell/config.ts src/components/admin/shell/AdminLayout.tsx src/components/admin/shell/AdminHeader.tsx src/components/admin/shell/AdminSider.tsx src/components/admin/__tests__/admin-layout.test.tsx src/components/admin/shell/__tests__/config.test.ts
git commit -m "feat(admin): rebuild workspace shell"
```

---

### Task 2: Rewrite the Overview into an Editorial Home

**Files:**
- Modify: `src/app/admin/page.tsx`
- Modify: `src/app/admin/__tests__/page.test.tsx`
- Reuse: `src/components/admin/primitives/PageHeader.tsx`
- Reuse: `src/components/admin/primitives/StatCard.tsx`
- Reuse: `src/components/admin/primitives/WorkspacePanel.tsx`

- [ ] **Step 1: Write the failing overview test**

```tsx
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      count: vi.fn().mockResolvedValue(7),
      findMany: vi.fn().mockResolvedValue([
        {
          id: "post-1",
          title: "AI Draft",
          slug: "ai-draft",
          published: false,
          createdAt: new Date("2026-04-01T00:00:00Z"),
        },
      ]),
    },
    user: { count: vi.fn().mockResolvedValue(2) },
    comment: {
      count: vi.fn().mockResolvedValue(4),
      findMany: vi.fn().mockResolvedValue([
        {
          id: "comment-1",
          content: "待处理评论",
          createdAt: new Date("2026-04-02T00:00:00Z"),
          author: null,
          authorLabel: "匿名访客",
          post: { title: "AI Draft", slug: "ai-draft" },
        },
      ]),
    },
    category: { count: vi.fn().mockResolvedValue(3) },
  },
}));

describe("admin overview", () => {
  test("renders editorial home queues and recent changes", async () => {
    const { default: AdminPage } = await import("../page");
    const ui = await AdminPage();

    render(ui as React.ReactElement);

    expect(screen.getByText("编辑部总览")).toBeInTheDocument();
    expect(screen.getByText("待处理工作")).toBeInTheDocument();
    expect(screen.getByText("最近变更")).toBeInTheDocument();
    expect(screen.getByText("待处理评论")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the overview test to verify it fails**

Run: `pnpm exec vitest run src/app/admin/__tests__/page.test.tsx`

Expected: FAIL because the current overview still renders a card wall and quick links instead of editorial queues.

- [ ] **Step 3: Implement the editorial-home layout**

Update `src/app/admin/page.tsx` so the page is organized into four blocks:

```tsx
return (
  <div className="space-y-6">
    <PageHeader
      eyebrow="Editorial"
      title="编辑部总览"
      description="把待发布内容、最近变化和内容风险收进同一工作台。"
      action={<Link href="/admin/posts/new"><Button size="sm">新建文章</Button></Link>}
    />

    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard label="全部文章" value={postCount} hint={`${draftCount} 篇仍为草稿`} />
      <StatCard label="待处理评论" value={pendingCommentCount} hint="优先处理互动风险" />
      <StatCard label="最近发布" value={publishedLast7Days} hint="过去 7 天上线内容" />
      <StatCard label="结构节点" value={categoryCount + tagCount} hint="分类与标签总数" />
    </section>

    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <WorkspacePanel title="待处理工作" description="优先完成最影响内容节奏的事项。">
        {/* 草稿队列、AI 草稿、最新评论入口 */}
      </WorkspacePanel>
      <WorkspacePanel title="最近变更" description="最近编辑、评论、发布动态。">
        {/* recent posts + recent comments */}
      </WorkspacePanel>
    </div>
  </div>
);
```

- [ ] **Step 4: Rerun the overview test**

Run: `pnpm exec vitest run src/app/admin/__tests__/page.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/page.tsx src/app/admin/__tests__/page.test.tsx
git commit -m "feat(admin): rewrite overview as editorial home"
```

---

### Task 3: Rewrite the Posts List into a Content Queue

**Files:**
- Modify: `src/components/admin/DataTable.tsx`
- Modify: `src/app/admin/posts/page.tsx`
- Modify: `src/app/admin/__tests__/admin-density.test.tsx`
- Create: `src/app/admin/__tests__/posts-workbench.test.tsx`
- Reuse: `src/components/admin/primitives/Toolbar.tsx`
- Reuse: `src/components/admin/primitives/WorkspacePanel.tsx`

- [ ] **Step 1: Write the failing posts-workbench test**

Create `src/app/admin/__tests__/posts-workbench.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import AdminPostsPage from "../posts/page";

describe("posts workbench", () => {
  test("renders queue controls, publish shortcuts, and row context", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          success: true,
          data: [
            {
              id: "1",
              title: "AI Draft",
              slug: "ai-draft",
              published: false,
              viewCount: 3,
              createdAt: "2026-04-01T00:00:00Z",
              author: { name: "Admin", email: "admin@example.com" },
              _count: { comments: 2, likes: 5 },
            },
          ],
        }),
      }),
    );

    render(<AdminPostsPage />);

    await waitFor(() => {
      expect(screen.getByText("内容队列")).toBeInTheDocument();
    });

    expect(screen.getByText("仅看草稿")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "切换为已发布" })).toBeInTheDocument();
    expect(screen.getByText("评论 2")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the posts-workbench tests to verify they fail**

Run: `pnpm exec vitest run src/app/admin/__tests__/admin-density.test.tsx src/app/admin/__tests__/posts-workbench.test.tsx`

Expected: FAIL because the posts page still uses the older management-table framing and does not expose a workbench-level status action label.

- [ ] **Step 3: Implement the content queue rewrite**

Update `src/components/admin/DataTable.tsx` to accept richer framing:

```tsx
interface DataTableProps<T extends { id: string }> {
  title: string;
  rows: T[];
  columns: DataColumn<T>[];
  emptyText: string;
  summary?: string;
  toolbar?: ReactNode;
  isLoading?: boolean;
  loadingLabel?: string;
  bulkActions?: Array<...>;
}
```

Update `src/app/admin/posts/page.tsx`:

```tsx
<PageHeader
  eyebrow="Content"
  title="内容队列"
  description="围绕草稿、发布和复盘组织文章操作。"
  action={<Link href="/admin/posts/new"><Button size="sm">新建文章</Button></Link>}
/>

<Toolbar
  leading={
    <>
      <Input ... />
      <button type="button">全部内容</button>
      <button type="button">仅看草稿</button>
      <button type="button">已发布</button>
    </>
  }
  trailing={<span className="text-sm text-[var(--muted)]">共 {filtered.length} 篇内容</span>}
/>

<DataTable
  title="文章列表"
  summary="按内容状态和发布时间组织内容队列。"
  toolbar={<div className="text-xs text-[var(--muted)]">支持批量隐藏与状态切换</div>}
  isLoading={loading}
  loadingLabel="正在加载内容队列..."
  columns={[
    ...,
    {
      key: "status",
      label: "状态",
      render: (row) => (
        <div className="space-y-2">
          <StatusBadge tone={row.published ? "success" : "warning"}>{row.published ? "已发布" : "草稿"}</StatusBadge>
          <Button size="xs" type="button" disabled={busyRowIds.includes(row.id)} onClick={() => void togglePublish(row)}>
            {row.published ? "切换为草稿" : "切换为已发布"}
          </Button>
        </div>
      ),
    },
  ]}
/>
```

Inside the page, make the publish toggle optimistic:

```tsx
async function togglePublish(row: PostRow) {
  const nextPublished = !row.published;

  setBusyRowIds((prev) => [...prev, row.id]);
  setPosts((prev) => prev.map((item) => (item.id === row.id ? { ...item, published: nextPublished } : item)));

  try {
    const res = await fetch("/api/admin/posts/publish", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, published: nextPublished }),
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || "状态更新失败");
    }
  } catch (error) {
    setPosts((prev) => prev.map((item) => (item.id === row.id ? { ...item, published: row.published } : item)));
    toast.error(error instanceof Error ? error.message : "状态更新失败");
  } finally {
    setBusyRowIds((prev) => prev.filter((id) => id !== row.id));
  }
}
```

- [ ] **Step 4: Rerun the posts-workbench tests**

Run: `pnpm exec vitest run src/app/admin/__tests__/admin-density.test.tsx src/app/admin/__tests__/posts-workbench.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/DataTable.tsx src/app/admin/posts/page.tsx src/app/admin/__tests__/admin-density.test.tsx src/app/admin/__tests__/posts-workbench.test.tsx
git commit -m "feat(admin): rewrite posts page as content queue"
```

---

### Task 4: Rewrite Create/Edit Post Screens into an Editor Workbench

**Files:**
- Modify: `src/components/posts/CreatePostWorkspace.tsx`
- Create: `src/hooks/useInspectorState.ts`
- Modify: `src/components/posts/EditorWorkspace.tsx`
- Modify: `src/components/posts/PublishChecklist.tsx`
- Modify: `src/app/admin/posts/[id]/edit/page.tsx`
- Modify: `src/app/admin/__tests__/admin-create-post.test.tsx`
- Modify: `src/app/admin/__tests__/admin-editor.test.tsx`
- Create: `src/app/admin/__tests__/editor-publish-flow.test.tsx`

- [ ] **Step 1: Write the failing editor-workbench tests**

Update `src/app/admin/__tests__/admin-editor.test.tsx` with a stronger inspector assertion:

```tsx
test("renders editorial inspector sections and top-level publish actions", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      success: true,
      data: {
        id: "1",
        title: "Post 1",
        slug: "post-1",
        content: "# Hello",
        excerpt: "Excerpt",
        coverImage: "",
        categoryId: "",
        tags: [],
        published: false,
      },
    }),
  }));

  render(<AdminPostEditPage />);

  expect(await screen.findByText("文章状态")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "保存草稿" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "发布文章" })).toBeInTheDocument();
  expect(screen.getByText("发布准备度")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the editor tests to verify they fail**

Run: `pnpm exec vitest run src/app/admin/__tests__/admin-create-post.test.tsx src/app/admin/__tests__/admin-editor.test.tsx`

Expected: FAIL because the current create/edit workspaces still frame save/publish inside a generic sidebar rather than a true editorial workbench.

- [ ] **Step 3: Implement the editor-workbench layout**

Update both create/edit flows to use the same section ordering:

```tsx
const inspector = useInspectorState({
  defaultPanel: "status",
  allowedPanels: ["status", "readiness", "metadata"],
});

<PageHeader
  eyebrow="Editor"
  title="后台编辑文章"
  description="正文优先，状态和发布控制放到独立检视区。"
  action={
    <>
      <Button type="submit" variant="outline">保存草稿</Button>
      <Button type="submit">发布文章</Button>
    </>
  }
/>

<div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
  <EditorWorkspace ... />
  <div className="hidden space-y-4 xl:block">
    <WorkspacePanel title="文章状态" description="保存前先决定该内容停留在草稿还是已发布。">
      {/* 当前状态、状态切换、最后保存提示 */}
    </WorkspacePanel>
    <WorkspacePanel title="发布准备度" description="围绕标题、slug、正文和封面给出清晰检查。">
      <PublishChecklist ... />
    </WorkspacePanel>
    <WorkspacePanel title="元数据" description="分类、标签、摘要和封面集中维护。">
      {/* taxonomy + metadata controls */}
    </WorkspacePanel>
  </div>
</div>

<div className="space-y-4 xl:hidden">
  <Toolbar
    leading={
      <>
        <button type="button" onClick={() => inspector.setPanel("status")}>状态</button>
        <button type="button" onClick={() => inspector.setPanel("readiness")}>准备度</button>
        <button type="button" onClick={() => inspector.setPanel("metadata")}>元数据</button>
      </>
    }
  />

  {inspector.panel === "status" ? <WorkspacePanel title="文章状态">{/* ... */}</WorkspacePanel> : null}
  {inspector.panel === "readiness" ? <WorkspacePanel title="发布准备度"><PublishChecklist ... /></WorkspacePanel> : null}
  {inspector.panel === "metadata" ? <WorkspacePanel title="元数据">{/* ... */}</WorkspacePanel> : null}
</div>
```

Create `src/hooks/useInspectorState.ts`:

```ts
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function useInspectorState<T extends string>({
  defaultPanel,
  allowedPanels,
}: {
  defaultPanel: T;
  allowedPanels: readonly T[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("panel") as T | null;
  const panel = current && allowedPanels.includes(current) ? current : defaultPanel;

  function setPanel(nextPanel: T) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("panel", nextPanel);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return { panel, setPanel };
}
```

- [ ] **Step 4: Rerun the editor tests**

Run: `pnpm exec vitest run src/app/admin/__tests__/admin-create-post.test.tsx src/app/admin/__tests__/admin-editor.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/posts/CreatePostWorkspace.tsx src/components/posts/EditorWorkspace.tsx src/components/posts/PublishChecklist.tsx src/app/admin/posts/[id]/edit/page.tsx src/app/admin/__tests__/admin-create-post.test.tsx src/app/admin/__tests__/admin-editor.test.tsx
git commit -m "feat(admin): rebuild editor as editorial workbench"
```

---

### Task 5: Rewrite Comments into a Moderation Inbox

**Files:**
- Modify: `src/app/admin/comments/page.tsx`
- Modify: `src/app/admin/__tests__/comments-page.test.tsx`
- Reuse: `src/components/admin/primitives/WorkspacePanel.tsx`
- Reuse: `src/components/admin/primitives/Toolbar.tsx`

- [ ] **Step 1: Write the failing comments-inbox test**

Update `src/app/admin/__tests__/comments-page.test.tsx`:

```tsx
test("renders moderation buckets and inline triage actions", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: async () => ({
        success: true,
        data: [
          {
            id: "comment-1",
            content: "匿名评论内容",
            createdAt: "2026-01-02T00:00:00Z",
            status: "PENDING",
            author: null,
            authorLabel: "匿名访客",
            post: { title: "Recent Post", slug: "recent-post" },
          },
        ],
      }),
    }),
  );

  render(<AdminCommentsPage />);

  expect(await screen.findByText("评论收件箱")).toBeInTheDocument();
  expect(screen.getByText("待审核")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "批量通过" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "通过" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the comments tests to verify they fail**

Run: `pnpm exec vitest run src/app/admin/__tests__/comments-page.test.tsx`

Expected: FAIL because the current page is still a generic table-first management screen.

- [ ] **Step 3: Implement the moderation inbox rewrite**

Update `src/app/admin/comments/page.tsx`:

```tsx
<PageHeader
  eyebrow="Moderation"
  title="评论收件箱"
  description="围绕待审核、已通过和已驳回组织评论治理。"
/>

<section className="grid grid-cols-1 gap-3 md:grid-cols-3">
  {/* 状态桶统计卡：待审核、已通过、已驳回 */}
</section>

<Toolbar
  leading={
    <>
      <Input ... />
      <button type="button">全部</button>
      <button type="button">待审核</button>
      <button type="button">已通过</button>
      <button type="button">已驳回</button>
    </>
  }
  trailing={<span className="text-sm text-[var(--muted)]">优先处理待审核评论</span>}
/>

<DataTable
  title="评论队列"
  summary="在同一视图里完成审核、驳回和隐藏。"
  columns={[...]}
/>
```

- [ ] **Step 4: Rerun the comments tests**

Run: `pnpm exec vitest run src/app/admin/__tests__/comments-page.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/comments/page.tsx src/app/admin/__tests__/comments-page.test.tsx
git commit -m "feat(admin): rewrite comments as moderation inbox"
```

---

### Task 6: Consolidate Category and Tag Management into a Taxonomy Studio

**Files:**
- Create: `src/components/admin/taxonomy/TaxonomyStudio.tsx`
- Create: `src/app/admin/taxonomy/page.tsx`
- Create: `src/app/admin/__tests__/taxonomy-studio.test.tsx`
- Create: `src/app/admin/__tests__/taxonomy-redirects.test.tsx`
- Modify: `src/components/admin/shell/config.ts`
- Modify: `src/app/admin/categories/page.tsx`
- Modify: `src/app/admin/tags/page.tsx`

- [ ] **Step 1: Write the failing taxonomy-studio test**

Create `src/app/admin/__tests__/taxonomy-studio.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import AdminTaxonomyPage from "../taxonomy/page";

describe("taxonomy studio", () => {
  test("renders shared category and tag maintenance tabs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: [{ id: "cat-1", name: "工程实践", slug: "engineering", description: "desc", createdAt: "2026-01-01T00:00:00Z", _count: { posts: 2 } }] }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: [{ id: "tag-1", name: "Next.js", slug: "nextjs", color: "#2563eb", createdAt: "2026-01-01T00:00:00Z", _count: { posts: 3 } }] }) }),
    );

    render(<AdminTaxonomyPage searchParams={Promise.resolve({ tab: "categories" })} />);

    await waitFor(() => {
      expect(screen.getByText("分类与标签")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "分类" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "标签" })).toBeInTheDocument();
    expect(screen.getByText("工程实践")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the taxonomy-studio test to verify it fails**

Run: `pnpm exec vitest run src/app/admin/__tests__/taxonomy-studio.test.tsx`

Expected: FAIL because the unified taxonomy studio route and shared studio component do not exist yet.

- [ ] **Step 3: Implement the shared taxonomy studio and legacy redirects**

Create `src/components/admin/taxonomy/TaxonomyStudio.tsx`:

```tsx
interface TaxonomyStudioProps {
  initialTab: "categories" | "tags";
}

export function TaxonomyStudio({ initialTab }: TaxonomyStudioProps) {
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Structure" title="分类与标签" description="在同一工作台中维护内容结构和标签语义。" />
      <Toolbar
        leading={
          <>
            <button type="button" onClick={() => setActiveTab("categories")}>分类</button>
            <button type="button" onClick={() => setActiveTab("tags")}>标签</button>
          </>
        }
      />
      {/* left list + right form inspector */}
    </div>
  );
}
```

Create `src/app/admin/taxonomy/page.tsx`:

```tsx
import { TaxonomyStudio } from "@/components/admin/taxonomy/TaxonomyStudio";

export default async function AdminTaxonomyPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const tab = (await searchParams).tab === "tags" ? "tags" : "categories";
  return <TaxonomyStudio initialTab={tab} />;
}
```

Redirect legacy pages:

```tsx
// src/app/admin/categories/page.tsx
import { redirect } from "next/navigation";

function buildRedirectQuery(searchParams: Record<string, string | string[] | undefined>, tab: string) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "tab" || value == null) continue;

    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
      continue;
    }

    params.set(key, value);
  }

  params.set("tab", tab);
  return params.toString();
}

export default async function AdminCategoriesRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = buildRedirectQuery(await searchParams, "categories");
  redirect(`/admin/taxonomy?${query}`);
}
```

```tsx
// src/app/admin/tags/page.tsx
import { redirect } from "next/navigation";

export default async function AdminTagsRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = buildRedirectQuery(await searchParams, "tags");
  redirect(`/admin/taxonomy?${query}`);
}
```

- [ ] **Step 4: Rerun the taxonomy-studio test**

Run: `pnpm exec vitest run src/app/admin/__tests__/taxonomy-studio.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/taxonomy/TaxonomyStudio.tsx src/app/admin/taxonomy/page.tsx src/app/admin/categories/page.tsx src/app/admin/tags/page.tsx src/app/admin/__tests__/taxonomy-studio.test.tsx src/components/admin/shell/config.ts
git commit -m "feat(admin): merge taxonomy management into studio"
```

---

### Task 7: Final Verification and Documentation Sweep

**Files:**
- Review only unless regressions are found

- [ ] **Step 1: Run targeted admin UI tests**

Run:

```bash
pnpm exec vitest run \
  src/components/admin/__tests__/admin-layout.test.tsx \
  src/app/admin/__tests__/page.test.tsx \
  src/app/admin/__tests__/admin-density.test.tsx \
  src/app/admin/__tests__/posts-workbench.test.tsx \
  src/app/admin/__tests__/admin-create-post.test.tsx \
  src/app/admin/__tests__/admin-editor.test.tsx \
  src/app/admin/__tests__/editor-publish-flow.test.tsx \
  src/app/admin/__tests__/comments-page.test.tsx \
  src/app/admin/__tests__/taxonomy-studio.test.tsx \
  src/app/admin/__tests__/taxonomy-redirects.test.tsx
```

Expected: PASS

- [ ] **Step 2: Run static verification**

Run: `pnpm lint`

Expected: PASS

Run: `pnpm build`

Expected: PASS

- [ ] **Step 3: Smoke the admin routes locally**

Run:

```bash
pnpm dev
```

Then manually verify:

1. `http://localhost:3000/admin`
2. `http://localhost:3000/admin/posts`
3. `http://localhost:3000/admin/posts/new`
4. `http://localhost:3000/admin/posts/<known-id>/edit`
5. `http://localhost:3000/admin/comments`
6. `http://localhost:3000/admin/taxonomy`

Expected:

- shell navigation matches the new grouped workbench structure
- posts list exposes status-first queue controls
- create/edit pages expose clear save/publish actions
- editor inspector switches panels below `xl` without squeezing the editor and preserves `?panel=` on refresh
- comments page reads as moderation inbox
- legacy `/admin/categories` and `/admin/tags` redirect into taxonomy studio and preserve incoming query params

- [ ] **Step 4: Commit**

```bash
git add src/components/admin src/app/admin
git commit -m "feat(admin): ship editorial workspace rewrite"
```

---

## Final Verification Sequence

1. `pnpm exec vitest run src/components/admin/__tests__/admin-layout.test.tsx src/app/admin/__tests__/page.test.tsx src/app/admin/__tests__/admin-density.test.tsx src/app/admin/__tests__/posts-workbench.test.tsx src/app/admin/__tests__/admin-create-post.test.tsx src/app/admin/__tests__/admin-editor.test.tsx src/app/admin/__tests__/editor-publish-flow.test.tsx src/app/admin/__tests__/comments-page.test.tsx src/app/admin/__tests__/taxonomy-studio.test.tsx src/app/admin/__tests__/taxonomy-redirects.test.tsx`
2. `pnpm lint`
3. `pnpm build`
4. `pnpm dev`
5. Manually smoke `/admin`, `/admin/posts`, `/admin/posts/new`, `/admin/posts/<id>/edit`, `/admin/comments`, `/admin/taxonomy`

Expected:

- targeted admin UI tests PASS
- lint PASSes
- production build PASSes
- local admin routes render with the new editorial workspace framing
- taxonomy legacy routes redirect cleanly into the new unified studio with query-param preservation
- editor workbench keeps the active inspector panel stable across refreshes on narrow screens

## Non-Goals

- No admin auth or role-model changes
- No change to AI draft write semantics
- No new publish workflow or moderation state machine
- No design-system extraction for the public blog UI
- No keyboard shortcut layer in this phase
