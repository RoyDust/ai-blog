# Public Blog UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the public blog UI into a content-first editorial reading experience without changing routes, data contracts, or admin/author flows.

**Architecture:** Keep the existing App Router public routes, Prisma queries, and semantic token system, then reshape the reader-facing shell, homepage, post listing, and article detail around a calmer editorial layout. Reuse current data sources and infinite loading where it still helps, but move homepage back to a curated landing page instead of a second endless feed.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, existing semantic CSS tokens, Vitest + Testing Library

---

## Scope Notes

- This plan covers public reader surfaces only: `/`, `/posts`, `/posts/[slug]`, and shared public chrome.
- Keep existing routes, API endpoints, and Prisma query contracts unless a task explicitly adds a new optional field that already exists in current payloads.
- Do not redesign `/admin`, `/write`, `/profile`, `/bookmarks`, or auth screens in this phase.
- Keep the current hue/theme system and semantic token layer. This is a composition rewrite, not a parallel design system.
- Tailwind CSS v4 changes must stay on the current CSS-first path: semantic variables live in `src/styles/theme-variables.css`, and the public token mapping continues through `@theme inline` in `src/app/globals.css`. Do not add or rely on `tailwind.config.ts`.
- Use `awesome-design-systems` as a reference source only. Do not import another system’s component library or mimic another product 1:1.
- Preserve current infinite loading on `/posts`, but remove infinite loading from the homepage.
- Homepage should become curated and finite: hero, latest, discovery, and site context.
- The public sidebar should become a discovery rail, not a duplicate primary navigation block.

## Design References

- `awesome-design-systems`: system discovery source.
- GitHub Primer: section framing, filter-chip language, restrained content chrome.
- IBM Carbon: spacing rhythm and predictable density steps.
- GOV.UK Design System: breadcrumb restraint, content-first page hierarchy.

## Acceptance Criteria

- The homepage reads like an editorial landing page, not a stack of unrelated cards.
- The homepage removes the current “核心特性” developer-facing block and replaces it with reader-facing discovery modules.
- `/posts` exposes a stronger listing header, sticky filter rail, active-filter chips, and a mixed-density feed with one featured card plus standard cards.
- Standard post cards become calmer: title, summary, metadata, and stats are easier to scan, and redundant arrow/icon theatrics are removed.
- Article detail pages gain a proper article hero with breadcrumb, summary, author/meta, and a more unified read-after zone.
- Shared public chrome uses tighter content widths and a clearer rail relationship between main content and sidebar.
- Existing targeted tests are updated, and any new UI behavior introduced by this plan is covered by focused tests.

## File Structure

- `src/styles/theme-variables.css`
  Add public editorial layout tokens such as content width, reading width, rail width, section spacing, and hero media ratio.
- `src/styles/components.css`
  Add small shared public UI utilities for section framing and editorial overlines without introducing a second token system.
- `src/components/layout/AppShell.tsx`
  Tighten the reader layout so content and rail have a clear relationship and the main flow owns the width contract.
- `src/components/layout/Navbar.tsx`
  Reduce utility-dashboard feel and strengthen content-first navigation and search placement.
- `src/components/layout/Sidebar.tsx`
  Reframe the sidebar into a discovery rail with author context, category access, tags, and archive entry.
- `src/components/layout/Footer.tsx`
  Keep utility links, but simplify the footer into a quieter editorial close.
- `src/components/blog/SectionHeader.tsx`
  New shared section-heading primitive for homepage, listing, and read-after modules.
- `src/components/blog/PostCard.tsx`
  Refactor the standard card into a calmer editorial list card.
- `src/components/blog/PostCardFeatured.tsx`
  Rebuild the featured card so it works for homepage hero support and listing-page lead story.
- `src/components/blog/HomeHero.tsx`
  New curated homepage hero with featured story and primary reader entry points.
- `src/components/blog/HomeDiscoveryGrid.tsx`
  New homepage discovery block for categories, archives, tags, and site context.
- `src/components/blog/HomeLatestPosts.tsx`
  Convert the homepage feed from infinite loading to a finite editorial latest-posts strip.
- `src/components/blog/FilterBar.tsx`
  Rebuild as a sticky rail with search, select controls, active tokens, and reset affordance.
- `src/components/blog/PostsListingClient.tsx`
  Restructure listing-page composition around editorial header, sticky filters, featured lead card, and standard feed.
- `src/components/blog/ArticleHero.tsx`
  New article header block for breadcrumb, category, title, summary, author/meta, and cover rhythm.
- `src/app/(public)/page.tsx`
  Recompose homepage from the new curated modules.
- `src/app/(public)/posts/[slug]/page.tsx`
  Recompose the article page around the new hero and unified read-after zone.
- `src/components/blog/index.ts`
  Export newly added public blog components.
- `src/app/__tests__/home-reader-flow.test.tsx`
  Update homepage contract expectations.
- `src/components/layout/__tests__/app-shell.test.tsx`
  Update public shell structure expectations.
- `src/components/layout/__tests__/public-chrome.test.tsx`
  Update rail and footer expectations.
- `src/components/blog/__tests__/PostCard.test.tsx`
  Update standard-card style contract expectations.
- `src/components/blog/__tests__/PostsListingClient.test.tsx`
  Update listing behavior expectations.
- `src/components/blog/__tests__/FilterBar.test.tsx`
  New focused test coverage for active filter chips and reset affordance.
- `src/app/posts/[slug]/__tests__/article-experience.test.tsx`
  Update article UI expectations for breadcrumb, summary, author block, and read-after zone.

## Task Order

1. Tighten the shared public shell and editorial spacing foundation.
2. Rebuild the public card primitives used by homepage and listing.
3. Rewrite the homepage into a curated editorial landing page.
4. Rebuild the posts listing header and sticky filter rail.
5. Rebuild the article hero and unify the read-after zone.
6. Run targeted verification, then lint/build/manual smoke.

---

### Task 1: Tighten the Shared Public Shell and Editorial Spacing Foundation

**Files:**
- Create: `src/components/blog/SectionHeader.tsx`
- Modify: `src/styles/theme-variables.css`
- Modify: `src/styles/components.css`
- Modify: `src/components/layout/AppShell.tsx`
- Modify: `src/components/layout/Navbar.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/Footer.tsx`
- Modify: `src/components/layout/__tests__/app-shell.test.tsx`
- Modify: `src/components/layout/__tests__/public-chrome.test.tsx`

- [ ] **Step 1: Write the failing public-shell tests**

Update `src/components/layout/__tests__/app-shell.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { AppShell } from "@/components/layout/AppShell";

describe("app shell", () => {
  test("constrains public content with editorial main width and skip link", () => {
    const { container } = render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );

    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "跳到主要内容" })).toHaveAttribute("href", "#main-content");
    expect(container.querySelector("main > div")?.className).toContain("max-w-[var(--content-max-width)]");
    expect(container.querySelector("aside")?.className).toContain("xl:w-[var(--rail-width)]");
  });
});
```

Update `src/components/layout/__tests__/public-chrome.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { Footer } from "@/components/layout/Footer";
import { Sidebar } from "@/components/layout/Sidebar";

test("sidebar and footer expose discovery-oriented public chrome", () => {
  const { container } = render(
    <>
      <Sidebar />
      <Footer />
    </>,
  );

  expect(container.querySelectorAll(".card-base").length).toBeGreaterThan(0);
  expect(screen.getByRole("heading", { name: "继续探索" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "分类索引" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "标签地图" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "快捷导航" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /文章归档/i })).toHaveAttribute("href", "/archives");
  expect(screen.getByRole("link", { name: "RSS 订阅" })).toHaveAttribute("href", "/rss.xml");
});
```

- [ ] **Step 2: Run the public-shell tests to verify they fail**

Run:

```bash
pnpm exec vitest run src/components/layout/__tests__/app-shell.test.tsx src/components/layout/__tests__/public-chrome.test.tsx
```

Expected: FAIL because the current shell still uses the broader content wrapper and the sidebar still renders the old “快捷导航” block.

- [ ] **Step 3: Implement the editorial shell foundation**

Create `src/components/blog/SectionHeader.tsx`:

```tsx
import type { ReactNode } from "react";

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function SectionHeader({ eyebrow, title, description, action }: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="space-y-2">
        {eyebrow ? <p className="ui-kicker">{eyebrow}</p> : null}
        <div className="space-y-1">
          <h2 className="text-90 font-display text-2xl font-bold md:text-3xl">{title}</h2>
          {description ? <p className="text-75 max-w-[44rem] text-sm leading-7">{description}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}
```

Update `src/styles/theme-variables.css` with public layout tokens:

```css
:root {
  --content-max-width: 72rem;
  --reading-max-width: 48rem;
  --rail-width: 18rem;
  --section-gap: clamp(2.5rem, 4vw, 4.5rem);
  --hero-media-ratio: 1.35;
}
```

Update `src/styles/components.css`:

```css
.ui-kicker {
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--brand);
}

.ui-section {
  display: grid;
  gap: 1.5rem;
}
```

Update `src/components/layout/AppShell.tsx`:

```tsx
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--page-bg)] transition-colors">
      <a
        href="#main-content"
        className="sr-only z-[60] rounded-lg bg-[var(--primary)] px-3 py-2 font-medium text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        跳到主要内容
      </a>
      <Navbar />
      <div className="flex flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-[var(--page-width)] flex-1 gap-6 px-4 pb-8 pt-4 xl:gap-8">
          <main id="main-content" className="min-w-0 flex-1">
            <div className="mx-auto w-full max-w-[var(--content-max-width)] space-y-[var(--section-gap)]">
              {children}
            </div>
          </main>
          <aside className="hidden xl:block xl:w-[var(--rail-width)] xl:shrink-0">
            <Sidebar />
          </aside>
        </div>
        <div className="mx-auto w-full max-w-[var(--page-width)] px-4 pb-8">
          <Footer />
        </div>
      </div>
    </div>
  );
}
```

Keep the existing `--sidebar-sticky-top` offset contract driven by `Navbar`, instead of replacing it with a static `--nav-height`, because the current navbar can hide on scroll and its effective offset is dynamic.

Update `src/components/layout/Sidebar.tsx` so the sidebar becomes a discovery rail:

```tsx
<div className="card-base p-5">
  <div className="mb-3 flex items-center gap-2">
    <BookOpenText className="h-5 w-5 text-[var(--primary)]" />
    <h3 className="text-90 font-bold">继续探索</h3>
  </div>
  <div className="space-y-2">
    <Link className="text-75 block rounded-lg px-3 py-2 text-sm transition hover:bg-[var(--btn-plain-bg-hover)]" href="/posts">
      浏览全部文章
    </Link>
    <Link className="text-75 block rounded-lg px-3 py-2 text-sm transition hover:bg-[var(--btn-plain-bg-hover)]" href="/search">
      搜索主题或关键词
    </Link>
    <Link className="text-75 block rounded-lg px-3 py-2 text-sm transition hover:bg-[var(--btn-plain-bg-hover)]" href="/archives">
      按时间回看归档
    </Link>
  </div>
</div>

<div className="card-base p-6">
  <div className="mb-4 flex items-center gap-2">
    <Folder className="h-5 w-5 text-[var(--primary)]" />
    <h3 className="text-90 font-bold">分类索引</h3>
  </div>
  <div className="space-y-2">
    {categories.map((category) => (
      <Link
        key={category.id}
        className="flex items-center justify-between rounded-lg px-3 py-2 transition hover:bg-[var(--btn-plain-bg-hover)]"
        href={`/categories/${category.slug}`}
      >
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[var(--primary)]" />
          <span className="text-75 text-sm">{category.name}</span>
        </div>
        <span className="text-50 text-xs">{category._count?.posts ?? 0}</span>
      </Link>
    ))}
  </div>
</div>

<div className="card-base p-6">
  <div className="mb-4 flex items-center gap-2">
    <Tag className="h-5 w-5 text-[var(--primary)]" />
    <h3 className="text-90 font-bold">标签地图</h3>
  </div>
  <div className="flex flex-wrap gap-2">
    {tags.map((tag) => (
      <Link key={tag.id} className="ui-chip" href={`/tags/${tag.slug}`}>
        {tag.name}
      </Link>
    ))}
  </div>
</div>
```

Update `src/components/layout/Navbar.tsx` and `src/components/layout/Footer.tsx` to reduce utility-dashboard weight:

```tsx
<div className="card-base mx-auto flex h-[4.5rem] max-w-[var(--page-width)] items-center justify-between gap-3 !overflow-visible !rounded-t-none px-4 backdrop-blur-lg !bg-[color:color-mix(in_oklab,var(--card-bg)_88%,transparent)]">
```

```tsx
<div className="card-base p-6 md:p-7">
  <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
    <div className="space-y-2">
      <p className="ui-kicker">My Blog</p>
      <p className="text-75 text-sm leading-7">围绕技术主题、实践记录和长期积累组织阅读入口。</p>
    </div>
    <div className="text-75 flex flex-wrap items-center gap-4 text-sm">
      <Link href="/posts">文章</Link>
      <Link href="/categories">分类</Link>
      <Link href="/archives">归档</Link>
      <a href="/rss.xml">RSS 订阅</a>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Rerun the public-shell tests**

Run:

```bash
pnpm exec vitest run src/components/layout/__tests__/app-shell.test.tsx src/components/layout/__tests__/public-chrome.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/blog/SectionHeader.tsx src/styles/theme-variables.css src/styles/components.css src/components/layout/AppShell.tsx src/components/layout/Navbar.tsx src/components/layout/Sidebar.tsx src/components/layout/Footer.tsx src/components/layout/__tests__/app-shell.test.tsx src/components/layout/__tests__/public-chrome.test.tsx
git commit -m "feat(blog): tighten public editorial shell"
```

---

### Task 2: Rebuild the Public Card Primitives Used by Homepage and Listing

**Files:**
- Modify: `src/components/blog/PostCard.tsx`
- Modify: `src/components/blog/PostCardFeatured.tsx`
- Modify: `src/components/blog/PostMeta.tsx`
- Modify: `src/components/blog/index.ts`
- Modify: `src/components/blog/__tests__/PostCard.test.tsx`
- Modify: `src/app/__tests__/frontend-listing-style.test.tsx`
- Create: `src/components/blog/__tests__/PostCardFeatured.test.tsx`

- [ ] **Step 1: Write the failing card tests**

Update `src/components/blog/__tests__/PostCard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, test, vi } from "vitest";
import { PostCard } from "../PostCard";

const imageMock = vi.fn(() => null);

vi.mock("next/image", () => ({
  default: (props: React.ComponentProps<"img"> & { fill?: boolean; quality?: number }) => imageMock(props),
}));

describe("PostCard", () => {
  test("renders an editorial card without duplicate chevron CTA treatment", () => {
    imageMock.mockClear();

    render(
      <PostCard
        post={{
          id: "post-1",
          title: "Post with cover",
          slug: "post-with-cover",
          excerpt: "Excerpt",
          coverImage: "https://images.unsplash.com/photo-1",
          createdAt: "2026-03-01T00:00:00.000Z",
          author: { id: "u1", name: "Ada", image: null },
          category: { name: "Tech", slug: "tech" },
          tags: [{ name: "Next", slug: "next" }],
          _count: { comments: 1, likes: 2 },
          viewCount: 10,
        }}
      />,
    );

    const card = screen.getByRole("article");
    expect(card.className).toContain("md:grid-cols-[minmax(0,1fr)_15rem]");
    expect(screen.queryByTestId("post-card-chevron")).not.toBeInTheDocument();
    expect(screen.getByText("Excerpt").className).toContain("line-clamp-3");
    expect(imageMock.mock.calls[0][0].sizes).toBe("(max-width: 768px) 100vw, 15rem");
  });
});
```

Create `src/components/blog/__tests__/PostCardFeatured.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import React from "react";
import { expect, test, vi } from "vitest";
import { PostCardFeatured } from "../PostCardFeatured";

vi.mock("next/image", () => ({
  default: (props: React.ComponentProps<"img"> & { fill?: boolean }) => {
    const imageProps = { ...props };
    delete imageProps.fill;
    return React.createElement("img", { ...imageProps, alt: imageProps.alt ?? "" });
  },
}));

test("featured card exposes editorial lead-story framing", () => {
  render(
    <PostCardFeatured
      post={{
        title: "Lead story",
        slug: "lead-story",
        excerpt: "Longer summary for the lead story.",
        coverImage: "https://images.unsplash.com/photo-2",
        createdAt: "2026-03-01T00:00:00.000Z",
        category: { name: "Engineering", slug: "engineering" },
      }}
    />,
  );

  expect(screen.getByText("精选文章")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Lead story" })).toHaveAttribute("href", "/posts/lead-story");
  expect(screen.getByText("Engineering")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the card tests to verify they fail**

Run:

```bash
pnpm exec vitest run src/components/blog/__tests__/PostCard.test.tsx src/components/blog/__tests__/PostCardFeatured.test.tsx src/app/__tests__/frontend-listing-style.test.tsx
```

Expected: FAIL because the current standard card still uses the older chevron-heavy framing and the featured card still uses the previous generic surface treatment.

- [ ] **Step 3: Implement calmer editorial card primitives**

Update `src/components/blog/PostMeta.tsx` to normalize chips:

```tsx
<div className={`text-50 flex flex-wrap items-center gap-2 text-xs ${className}`}>
  {category ? (
    <Link className="ui-chip" href={`/categories/${category.slug}`}>
      {category.name}
    </Link>
  ) : null}
  <span>{new Date(publishedAt).toLocaleDateString("zh-CN")}</span>
  {!hideUpdateDate && updatedAt ? <span>更新于 {new Date(updatedAt).toLocaleDateString("zh-CN")}</span> : null}
  {tags.map((tag) => (
    <Link
      key={tag.slug}
      className={`${hideTagsForMobile ? "hidden md:inline-flex" : "inline-flex"} ui-chip`}
      href={`/tags/${tag.slug}`}
    >
      #{tag.name}
    </Link>
  ))}
</div>
```

Update `src/components/blog/PostCard.tsx`:

```tsx
export function PostCard({ post }: PostCardProps) {
  const hasCover = Boolean(post.coverImage);

  return (
    <article className="card-base grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_15rem] md:items-start md:p-6">
      <div className="space-y-3">
        <PostMeta
          category={post.category}
          hideTagsForMobile={true}
          hideUpdateDate={true}
          publishedAt={post.createdAt}
          tags={post.tags}
        />

        <Link href={`/posts/${post.slug}`} className="group block">
          <h3 className="text-90 text-[1.65rem] font-bold leading-tight transition group-hover:text-[var(--primary)]">
            {post.title}
          </h3>
        </Link>

        <p className="text-75 line-clamp-3 text-sm leading-7">{post.excerpt ?? "暂无摘要"}</p>

        <div className="text-50 flex flex-wrap items-center gap-3 text-sm">
          <span>{post._count.comments} 评论</span>
          <span>{post._count.likes} 点赞</span>
          {(post.viewCount ?? 0) > 0 ? <span>{post.viewCount} 阅读</span> : null}
        </div>
      </div>

      <Link
        href={`/posts/${post.slug}`}
        aria-label={post.title}
        className="theme-media relative order-first aspect-[4/3] overflow-hidden rounded-2xl md:order-none"
      >
        {hasCover ? (
          <FallbackImage
            alt={post.title}
            className="theme-media-image object-cover"
            fill
            loading="lazy"
            quality={70}
            sizes="(max-width: 768px) 100vw, 15rem"
            src={post.coverImage!}
          />
        ) : (
          <div className="h-full w-full bg-[var(--surface-alt)]" />
        )}
      </Link>
    </article>
  );
}
```

Update `src/components/blog/PostCardFeatured.tsx`:

```tsx
export function PostCardFeatured({ post }: PostCardFeaturedProps) {
  return (
    <article className="card-base overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[1.15fr_minmax(18rem,0.85fr)]">
        <Link href={`/posts/${post.slug}`} className="theme-media relative min-h-[22rem]">
          {post.coverImage ? (
            <FallbackImage alt={post.title} className="theme-media-image object-cover" fill priority src={post.coverImage} />
          ) : (
            <div className="h-full w-full bg-[var(--surface-alt)]" />
          )}
        </Link>

        <div className="flex flex-col justify-between gap-6 p-6 md:p-8">
          <div className="space-y-4">
            <span className="ui-chip">精选文章</span>
            <div className="space-y-3">
              <Link href={`/posts/${post.slug}`}>
                <h2 className="text-90 font-display text-3xl font-bold leading-tight transition hover:text-[var(--primary)]">
                  {post.title}
                </h2>
              </Link>
              {post.excerpt ? <p className="text-75 text-sm leading-7">{post.excerpt}</p> : null}
            </div>
          </div>

          <div className="text-50 flex flex-wrap items-center gap-3 text-sm">
            <span>{post.category?.name ?? "未分类"}</span>
            <span>{new Date(post.createdAt).toLocaleDateString("zh-CN")}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
```

Update `src/components/blog/index.ts`:

```ts
export { SectionHeader } from "./SectionHeader";
export { PostCard } from "./PostCard";
export { PostCardFeatured } from "./PostCardFeatured";
```

- [ ] **Step 4: Rerun the card tests**

Run:

```bash
pnpm exec vitest run src/components/blog/__tests__/PostCard.test.tsx src/components/blog/__tests__/PostCardFeatured.test.tsx src/app/__tests__/frontend-listing-style.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/blog/PostCard.tsx src/components/blog/PostCardFeatured.tsx src/components/blog/PostMeta.tsx src/components/blog/SectionHeader.tsx src/components/blog/index.ts src/components/blog/__tests__/PostCard.test.tsx src/components/blog/__tests__/PostCardFeatured.test.tsx src/app/__tests__/frontend-listing-style.test.tsx
git commit -m "feat(blog): calm public editorial cards"
```

---

### Task 3: Rewrite the Homepage into a Curated Editorial Landing Page

**Files:**
- Create: `src/components/blog/HomeHero.tsx`
- Create: `src/components/blog/HomeDiscoveryGrid.tsx`
- Modify: `src/components/blog/HomeLatestPosts.tsx`
- Modify: `src/components/blog/index.ts`
- Modify: `src/app/(public)/page.tsx`
- Modify: `src/app/__tests__/home-reader-flow.test.tsx`

- [ ] **Step 1: Write the failing homepage test**

Update `src/app/__tests__/home-reader-flow.test.tsx`:

```tsx
test("home shows curated hero, latest feed, and discovery modules", async () => {
  const { default: Home } = await import("../(public)/page");
  const ui = await Home();
  render(ui as React.ReactElement);

  expect(screen.getByRole("heading", { name: "围绕主题，而不是时间线，浏览这座博客。" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "最新发布" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "继续探索" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "核心特性" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "开始阅读" })).toHaveAttribute("href", "/posts");
});
```

- [ ] **Step 2: Run the homepage test to verify it fails**

Run:

```bash
pnpm exec vitest run src/app/__tests__/home-reader-flow.test.tsx
```

Expected: FAIL because the current homepage still renders the generic latest/categories/features stack.

- [ ] **Step 3: Implement the curated homepage modules**

Create `src/components/blog/HomeHero.tsx`:

```tsx
import Link from "next/link";
import { PostCardFeatured } from "./PostCardFeatured";

interface HomeHeroProps {
  featuredPost: {
    title: string;
    slug: string;
    excerpt: string | null;
    coverImage?: string | null;
    createdAt: Date | string;
    category: { name: string; slug: string } | null;
  } | null;
}

export function HomeHero({ featuredPost }: HomeHeroProps) {
  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <div className="card-base flex flex-col justify-between gap-8 p-6 md:p-8">
        <div className="space-y-4">
          <p className="ui-kicker">编选</p>
          <h1 className="text-90 font-display text-4xl font-bold leading-tight md:text-5xl">
            围绕主题，而不是时间线，浏览这座博客。
          </h1>
          <p className="text-75 max-w-[40rem] text-base leading-8">
            从工程实践、前端体系、工具记录到长期归档，把零散文章收成可持续阅读的内容入口。
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link className="ui-btn rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white" href="/posts">
            开始阅读
          </Link>
          <Link className="btn-plain rounded-xl px-5 py-3 text-sm font-semibold" href="/archives">
            查看归档
          </Link>
        </div>
      </div>

      {featuredPost ? (
        <PostCardFeatured post={featuredPost} />
      ) : (
        <div className="card-base flex min-h-[22rem] flex-col justify-between gap-6 p-8">
          <div className="space-y-3">
            <p className="ui-kicker">欢迎</p>
            <h2 className="text-90 font-display text-3xl font-bold leading-tight">从最新文章、归档或关键词开始。</h2>
            <p className="text-75 text-sm leading-7">
              当前还没有单独置顶的精选文章，先从文章索引和归档入口进入也能完整浏览本站内容。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="ui-btn rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white" href="/posts">
              浏览文章索引
            </Link>
            <Link className="btn-plain rounded-xl px-5 py-3 text-sm font-semibold" href="/search">
              搜索关键词
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
```

Create `src/components/blog/HomeDiscoveryGrid.tsx`:

```tsx
import Link from "next/link";
import { FolderOpen, Tags, Archive } from "lucide-react";
import { SectionHeader } from "./SectionHeader";

interface HomeDiscoveryGridProps {
  categories: Array<{ id: string; name: string; slug: string; _count: { posts: number } }>;
}

export function HomeDiscoveryGrid({ categories }: HomeDiscoveryGridProps) {
  return (
    <section className="ui-section">
      <SectionHeader
        eyebrow="发现"
        title="继续探索"
        description="按分类、标签和归档把阅读从单篇文章扩展成主题路径。"
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_repeat(2,minmax(0,0.95fr))]">
        <div className="card-base p-6">
          <h3 className="text-90 mb-4 flex items-center gap-2 text-lg font-bold">
            <FolderOpen className="h-5 w-5 text-[var(--primary)]" />
            热门分类
          </h3>
          <div className="flex flex-wrap gap-2">
            {categories.slice(0, 8).map((category) => (
              <Link key={category.id} href={`/categories/${category.slug}`} className="ui-chip">
                {category.name} ({category._count.posts})
              </Link>
            ))}
          </div>
        </div>

        <Link href="/tags" className="card-base flex flex-col justify-between p-6 transition hover:bg-[var(--btn-card-bg-hover)]">
          <div className="space-y-2">
            <h3 className="text-90 flex items-center gap-2 text-lg font-bold">
              <Tags className="h-5 w-5 text-[var(--primary)]" />
              标签地图
            </h3>
            <p className="text-75 text-sm leading-7">从更细的关键词切入，找到同一语义下的文章集合。</p>
          </div>
          <span className="text-50 text-sm">进入标签页</span>
        </Link>

        <Link href="/archives" className="card-base flex flex-col justify-between p-6 transition hover:bg-[var(--btn-card-bg-hover)]">
          <div className="space-y-2">
            <h3 className="text-90 flex items-center gap-2 text-lg font-bold">
              <Archive className="h-5 w-5 text-[var(--primary)]" />
              时间归档
            </h3>
            <p className="text-75 text-sm leading-7">按月份回看内容节奏，适合系统梳理旧文和阶段记录。</p>
          </div>
          <span className="text-50 text-sm">浏览归档</span>
        </Link>
      </div>
    </section>
  );
}
```

Update `src/components/blog/HomeLatestPosts.tsx` so it becomes finite and editorial:

```tsx
import Link from "next/link";
import { getListRevealAnimationProps } from "./listAnimation";
import { PostCard } from "./PostCard";
import { SectionHeader } from "./SectionHeader";

interface HomeLatestPostsProps {
  posts: HomeLatestPost[];
}

export function HomeLatestPosts({ posts }: HomeLatestPostsProps) {
  return (
    <section className="ui-section">
      <SectionHeader
        eyebrow="最新"
        title="最新发布"
        description="保留最近更新的内容入口，但把持续浏览交给文章列表页。"
        action={
          <Link href="/posts" className="btn-plain rounded-xl px-4 py-2 text-sm font-medium">
            查看全部
          </Link>
        }
      />

      <div className="space-y-4">
        {posts.slice(0, 4).map((post, index) => (
          <div key={post.id} {...getListRevealAnimationProps(index)}>
            <PostCard post={post} />
          </div>
        ))}
      </div>
    </section>
  );
}
```

Update `src/app/(public)/page.tsx`:

```tsx
export default async function Home() {
  const { posts, categories, hasLoadError } = await getData();
  const [featuredPost, ...latestPosts] = posts as HomePost[];

  return (
    <div className="space-y-[var(--section-gap)]">
      {hasLoadError ? (
        <section role="alert" className="card-base border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          首页部分内容加载失败，请稍后重试。
        </section>
      ) : null}

      <HomeHero featuredPost={featuredPost ?? null} />
      <HomeLatestPosts posts={latestPosts.length > 0 ? latestPosts : featuredPost ? [featuredPost] : []} />
      <HomeDiscoveryGrid categories={categories as HomeCategory[]} />
    </div>
  );
}
```

Update `src/components/blog/index.ts`:

```ts
export { HomeHero } from "./HomeHero";
export { HomeDiscoveryGrid } from "./HomeDiscoveryGrid";
export { HomeLatestPosts } from "./HomeLatestPosts";
```

- [ ] **Step 4: Rerun the homepage test**

Run:

```bash
pnpm exec vitest run src/app/__tests__/home-reader-flow.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/blog/HomeHero.tsx src/components/blog/HomeDiscoveryGrid.tsx src/components/blog/HomeLatestPosts.tsx src/components/blog/index.ts src/app/(public)/page.tsx src/app/__tests__/home-reader-flow.test.tsx
git commit -m "feat(blog): rewrite homepage as editorial landing"
```

---

### Task 4: Rebuild the Posts Listing Header and Sticky Filter Rail

**Files:**
- Create: `src/components/blog/__tests__/FilterBar.test.tsx`
- Modify: `src/components/blog/FilterBar.tsx`
- Modify: `src/components/blog/PostsListingClient.tsx`
- Modify: `src/components/blog/__tests__/PostsListingClient.test.tsx`
- Modify: `src/app/(public)/posts/page.tsx`

- [ ] **Step 1: Write the failing listing/filter tests**

Create `src/components/blog/__tests__/FilterBar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { FilterBar } from "../FilterBar";

test("filter bar renders active chips and a reset entry when filters are present", () => {
  render(
    <FilterBar
      search="react"
      category="frontend"
      tag="nextjs"
      categories={[{ name: "Frontend", slug: "frontend" }]}
      tags={[{ name: "Next.js", slug: "nextjs" }]}
    />,
  );

  expect(screen.getByDisplayValue("react")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "关键词: react" })).toHaveAttribute("href", "/posts?category=frontend&tag=nextjs");
  expect(screen.getByRole("link", { name: "清空筛选" })).toHaveAttribute("href", "/posts");
});
```

Update `src/components/blog/__tests__/PostsListingClient.test.tsx` with a stronger hero assertion:

```tsx
expect(screen.getByRole("heading", { name: "文章索引" })).toBeInTheDocument();
expect(screen.getByText("按主题、标签和关键词探索全部内容。")).toBeInTheDocument();
```

- [ ] **Step 2: Run the listing/filter tests to verify they fail**

Run:

```bash
pnpm exec vitest run src/components/blog/__tests__/FilterBar.test.tsx src/components/blog/__tests__/PostsListingClient.test.tsx
```

Expected: FAIL because the current filter bar is still a plain form without active tokens, and the listing header still renders the older “博客文章” surface.

- [ ] **Step 3: Implement the listing hero and sticky filter rail**

Update `src/components/blog/FilterBar.tsx`:

```tsx
import Link from "next/link";

function buildFilterHref({
  search,
  category,
  tag,
}: {
  search?: string;
  category?: string;
  tag?: string;
}) {
  const params = new URLSearchParams();

  if (search) params.set("q", search);
  if (category) params.set("category", category);
  if (tag) params.set("tag", tag);

  const query = params.toString();
  return query ? `/posts?${query}` : "/posts";
}

export function FilterBar({ search, category, tag, categories, tags }: FilterBarProps) {
  const hasActiveFilters = Boolean(search || category || tag);

  return (
    <form
      className="card-base sticky z-30 space-y-4 p-4"
      method="get"
      style={{ top: "calc(var(--sidebar-sticky-top, 0px) + 1rem)" }}
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,0.8fr))_auto]">
        <input
          name="q"
          defaultValue={search}
          placeholder="搜索文章、摘要或主题词"
          className="ui-ring rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]"
        />
        <select name="category" defaultValue={category ?? ""} className="ui-ring rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]">
          <option value="">全部分类</option>
          {categories.map((item) => (
            <option key={item.slug} value={item.slug}>{item.name}</option>
          ))}
        </select>
        <select name="tag" defaultValue={tag ?? ""} className="ui-ring rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]">
          <option value="">全部标签</option>
          {tags.map((item) => (
            <option key={item.slug} value={item.slug}>{item.name}</option>
          ))}
        </select>
        <button className="ui-btn rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white" type="submit">
          应用筛选
        </button>
      </div>

      {hasActiveFilters ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3">
          {search ? <Link className="ui-chip" href={buildFilterHref({ category, tag })}>关键词: {search}</Link> : null}
          {category ? <Link className="ui-chip" href={buildFilterHref({ search, tag })}>分类: {category}</Link> : null}
          {tag ? <Link className="ui-chip" href={buildFilterHref({ search, category })}>标签: {tag}</Link> : null}
          <Link className="text-sm font-medium text-[var(--brand)]" href="/posts">清空筛选</Link>
        </div>
      ) : null}
    </form>
  );
}
```

Keep the public layering explicit: `Navbar` stays at `z-50`, the sticky filter rail stays below it at `z-30`, and no other public floating panel should sit between them unless it has a deliberate higher-priority interaction.

Update `src/components/blog/PostsListingClient.tsx`:

```tsx
import Link from "next/link";

const isInitialLoading = isLoading && posts.length === 0;
const visibleTotal = isInitialLoading ? "加载中…" : String(pagination.total);

return (
  <div className="space-y-6">
    <header className="card-base space-y-5 p-6 md:p-8">
      <nav aria-label="Breadcrumb" className="text-50 text-sm">
        <Link href="/">首页</Link>
        <span className="mx-2">/</span>
        <span>文章</span>
      </nav>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="ui-kicker">浏览</p>
          <h1 className="text-90 font-display text-3xl font-bold md:text-4xl">文章索引</h1>
          <p className="text-75 max-w-[42rem] text-sm leading-7">按主题、标签和关键词探索全部内容。</p>
        </div>
        <div className="rounded-2xl bg-[var(--surface-alt)] px-4 py-3 text-sm text-[var(--text-body)]">
          共 {visibleTotal} 篇文章
        </div>
      </div>
    </header>

    <FilterBar category={category} categories={categories} search={search} tag={tag} tags={tags} />

    <div className="space-y-4">
      {isInitialLoading ? (
        Array.from({ length: 6 }).map((_, index) => (
          <div key={`skeleton-${index}`}>
            <PostCardSkeleton />
          </div>
        ))
      ) : posts.length > 0 ? (
        <>
          <PostCardFeatured post={posts[0]} />
          {posts.slice(1).map((post, index) => (
            <div key={post.id} {...getListRevealAnimationProps(index)}>
              <PostCard post={post} />
            </div>
          ))}
        </>
      ) : (
        <div className="card-base p-8 text-sm text-[var(--muted)]">未找到匹配内容，请尝试调整筛选条件。</div>
      )}
    </div>
  </div>
);
```

Keep `src/app/(public)/posts/page.tsx` server-side loading unchanged except for any import changes needed by the updated listing client.

- [ ] **Step 4: Rerun the listing/filter tests**

Run:

```bash
pnpm exec vitest run src/components/blog/__tests__/FilterBar.test.tsx src/components/blog/__tests__/PostsListingClient.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/blog/FilterBar.tsx src/components/blog/PostsListingClient.tsx src/components/blog/__tests__/FilterBar.test.tsx src/components/blog/__tests__/PostsListingClient.test.tsx src/app/(public)/posts/page.tsx
git commit -m "feat(blog): rebuild listing header and filter rail"
```

---

### Task 5: Rebuild the Article Hero and Unify the Read-After Zone

**Files:**
- Create: `src/components/blog/ArticleHero.tsx`
- Modify: `src/components/blog/index.ts`
- Modify: `src/app/(public)/posts/[slug]/page.tsx`
- Modify: `src/app/posts/[slug]/__tests__/article-experience.test.tsx`

- [ ] **Step 1: Write the failing article-experience test**

Update `src/app/posts/[slug]/__tests__/article-experience.test.tsx`:

```tsx
expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
expect(screen.getByText("Excerpt")).toBeInTheDocument();
expect(screen.getByText("Author")).toBeInTheDocument();
expect(screen.getByRole("heading", { level: 2, name: "读后操作" })).toBeInTheDocument();
expect(screen.queryByRole("heading", { level: 2, name: "与我互动" })).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the article-experience test to verify it fails**

Run:

```bash
pnpm exec vitest run src/app/posts/[slug]/__tests__/article-experience.test.tsx
```

Expected: FAIL because the current article page still hides author info in the header, lacks breadcrumb treatment, and splits the read-after modules more harshly.

- [ ] **Step 3: Implement the article hero and unified read-after zone**

Create `src/components/blog/ArticleHero.tsx`:

```tsx
import Link from "next/link";

interface ArticleHeroProps {
  title: string;
  excerpt: string | null;
  category: { name: string; slug: string } | null;
  author: { name: string | null };
  createdAt: Date | string;
  viewCount: number;
  readingTimeMinutes: number;
}

export function ArticleHero({
  title,
  excerpt,
  category,
  author,
  createdAt,
  viewCount,
  readingTimeMinutes,
}: ArticleHeroProps) {
  return (
    <header className="space-y-5 border-b border-[var(--border)] pb-8">
      <nav aria-label="Breadcrumb" className="text-50 text-sm">
        <Link href="/">首页</Link>
        <span className="mx-2">/</span>
        {category ? (
          <>
            <Link href={`/categories/${category.slug}`}>{category.name}</Link>
            <span className="mx-2">/</span>
          </>
        ) : null}
        <span>{title}</span>
      </nav>

      {category ? (
        <div>
          <Link className="ui-chip" href={`/categories/${category.slug}`}>
            {category.name}
          </Link>
        </div>
      ) : null}

      <div className="space-y-3">
        <h1 className="text-90 font-display text-4xl font-extrabold leading-tight md:text-5xl">{title}</h1>
        {excerpt ? <p className="text-75 max-w-[var(--reading-max-width)] text-base leading-8">{excerpt}</p> : null}
      </div>

      <div className="text-50 flex flex-wrap items-center gap-3 text-sm">
        <span>{author.name ?? "匿名作者"}</span>
        <span>{new Date(createdAt).toLocaleDateString("zh-CN")}</span>
        <span>{viewCount} 阅读</span>
        <span>预计阅读 {readingTimeMinutes} 分钟</span>
      </div>
    </header>
  );
}
```

Update `src/app/(public)/posts/[slug]/page.tsx`:

```tsx
<div className="mx-auto w-full max-w-[980px] xl:min-w-[880px]">
  <article className="card-base overflow-hidden">
    {post.coverImage ? (
      <div className="theme-media relative h-64 w-full md:h-[28rem]">
        <FallbackImage alt={post.title} className="theme-media-image object-cover" fill priority src={post.coverImage} />
      </div>
    ) : null}

    <div className="space-y-8 p-8">
      <ArticleHero
        title={post.title}
        excerpt={post.excerpt}
        category={post.category}
        author={post.author}
        createdAt={post.createdAt}
        viewCount={post.viewCount}
        readingTimeMinutes={post.readingTimeMinutes}
      />

      <div className="max-w-[var(--reading-max-width)]">
        <article className="prose prose-zinc max-w-none prose-headings:font-display prose-headings:scroll-mt-28 prose-headings:mt-10 prose-headings:mb-4 prose-headings:text-[var(--foreground)] prose-p:my-5 prose-p:leading-8 prose-p:text-[var(--text-body)] prose-a:text-[var(--brand)] prose-a:no-underline hover:prose-a:underline prose-strong:text-[var(--foreground)] prose-li:text-[var(--text-body)] prose-li:marker:text-[var(--text-faint)] prose-blockquote:border-[var(--border-strong)] prose-blockquote:border-l-[3px] prose-blockquote:text-[var(--text-body)] prose-blockquote:font-medium prose-hr:border-[var(--border)] prose-img:rounded-xl prose-pre:rounded-xl prose-pre:border prose-pre:border-[var(--border)] prose-pre:bg-[var(--surface-elevated)] prose-pre:text-[var(--foreground)] prose-code:rounded prose-code:bg-[color-mix(in_oklab,var(--surface-contrast)_82%,black_18%)] prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[color-mix(in_oklab,var(--foreground)_92%,white_8%)] prose-code:font-[var(--font-code)] prose-code:before:content-none prose-code:after:content-none prose-table:w-full prose-th:bg-[var(--surface-contrast)] prose-th:text-[var(--foreground)] prose-td:border-[var(--border)] prose-th:border-[var(--border)] dark:prose-invert">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={{
              h1: ({ children, ...props }) => (
                <h1 id={slugify(nodeText(children))} {...props}>
                  {children}
                </h1>
              ),
              h2: ({ children, ...props }) => (
                <h2 id={slugify(nodeText(children))} {...props}>
                  {children}
                </h2>
              ),
              h3: ({ children, ...props }) => (
                <h3 id={slugify(nodeText(children))} {...props}>
                  {children}
                </h3>
              ),
              h4: ({ children, ...props }) => (
                <h4 id={slugify(nodeText(children))} {...props}>
                  {children}
                </h4>
              ),
              h5: ({ children, ...props }) => (
                <h5 id={slugify(nodeText(children))} {...props}>
                  {children}
                </h5>
              ),
              img: ({ src, alt }) => {
                const imageSrc = typeof src === "string" ? src : null;
                if (!imageSrc) return null;

                return (
                  <span className="my-8 block overflow-hidden rounded-xl">
                    <FallbackImage
                      alt={alt ?? ""}
                      className="theme-media-image h-auto w-full"
                      height={900}
                      src={imageSrc}
                      unoptimized
                      width={1600}
                    />
                  </span>
                );
              },
            }}
          >
            {post.content}
          </ReactMarkdown>
        </article>
      </div>

      {post.tags.length > 0 ? (
        <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-8">
          {post.tags.map((tag) => (
            <Link key={tag.slug} className="ui-chip" href={`/tags/${tag.slug}`}>
              #{tag.name}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  </article>
</div>

<section className="card-base mx-auto w-full max-w-[980px] space-y-6 p-6 xl:min-w-[880px]">
  <SectionHeader
    eyebrow="读后"
    title="读后操作"
    description="保存、分享、继续阅读，或直接跳到评论区。"
  />

  <div className="flex flex-wrap items-center gap-3">
    <LikeButton initialCount={post._count.likes} initialLiked={false} slug={post.slug} />
    <BookmarkButton excerpt={post.excerpt} initialBookmarked={false} slug={post.slug} title={post.title} />
    <ShareButton slug={post.slug} title={post.title} />
    <Link className="ui-btn rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white" href="#comments">
      发表评论
    </Link>
  </div>

  <ArticleContinuation nextPost={nextPost} previousPost={previousPost} />
</section>
```

Update `src/components/blog/index.ts`:

```ts
export { ArticleHero } from "./ArticleHero";
```

- [ ] **Step 4: Rerun the article-experience test**

Run:

```bash
pnpm exec vitest run src/app/posts/[slug]/__tests__/article-experience.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/blog/ArticleHero.tsx src/components/blog/index.ts src/app/(public)/posts/[slug]/page.tsx src/app/posts/[slug]/__tests__/article-experience.test.tsx
git commit -m "feat(blog): rebuild article hero and read-after zone"
```

---

### Task 6: Final Verification and Manual UI Sweep

**Files:**
- Review only unless regressions are found

- [ ] **Step 1: Run targeted public UI tests**

Run:

```bash
pnpm exec vitest run \
  src/components/layout/__tests__/app-shell.test.tsx \
  src/components/layout/__tests__/public-chrome.test.tsx \
  src/app/__tests__/home-reader-flow.test.tsx \
  src/app/__tests__/frontend-listing-style.test.tsx \
  src/components/blog/__tests__/PostCard.test.tsx \
  src/components/blog/__tests__/PostCardFeatured.test.tsx \
  src/components/blog/__tests__/FilterBar.test.tsx \
  src/components/blog/__tests__/PostsListingClient.test.tsx \
  src/app/posts/[slug]/__tests__/article-experience.test.tsx
```

Expected: PASS

- [ ] **Step 2: Run static verification**

Run: `pnpm lint`

Expected: PASS

Run: `pnpm build`

Expected: PASS

- [ ] **Step 3: Smoke the public routes locally**

Run:

```bash
pnpm dev
```

Then manually verify:

1. `http://localhost:3000/`
2. `http://localhost:3000/posts`
3. `http://localhost:3000/posts/<known-slug>`
4. `http://localhost:3000/categories`
5. `http://localhost:3000/tags`
6. `http://localhost:3000/archives`

Expected:

- homepage reads as a curated landing page and no longer shows “核心特性”
- sidebar feels like a discovery rail rather than a duplicate nav stack
- `/posts` keeps URL-driven filters and renders active chips plus reset affordance
- first listing item renders as the lead card and subsequent items use calmer standard cards
- article page shows breadcrumb, summary, author/meta, and unified read-after block
- `375px`, `768px`, and `1440px` widths all keep readable horizontal spacing and avoid overflow
- light and dark themes both keep card borders, shadows, and text contrast readable after the layout rewrite

- [ ] **Step 4: Commit**

```bash
git add src/styles/theme-variables.css src/styles/components.css src/components/layout/AppShell.tsx src/components/layout/Navbar.tsx src/components/layout/Sidebar.tsx src/components/layout/Footer.tsx src/components/layout/__tests__/app-shell.test.tsx src/components/layout/__tests__/public-chrome.test.tsx src/components/blog/SectionHeader.tsx src/components/blog/PostCard.tsx src/components/blog/PostCardFeatured.tsx src/components/blog/PostMeta.tsx src/components/blog/HomeHero.tsx src/components/blog/HomeDiscoveryGrid.tsx src/components/blog/HomeLatestPosts.tsx src/components/blog/FilterBar.tsx src/components/blog/PostsListingClient.tsx src/components/blog/ArticleHero.tsx src/components/blog/index.ts src/components/blog/__tests__/PostCard.test.tsx src/components/blog/__tests__/PostCardFeatured.test.tsx src/components/blog/__tests__/FilterBar.test.tsx src/components/blog/__tests__/PostsListingClient.test.tsx src/app/(public)/page.tsx src/app/(public)/posts/page.tsx src/app/(public)/posts/[slug]/page.tsx src/app/__tests__/home-reader-flow.test.tsx src/app/__tests__/frontend-listing-style.test.tsx src/app/posts/[slug]/__tests__/article-experience.test.tsx
git commit -m "feat(blog): ship public editorial ui redesign"
```

---

## Final Verification Sequence

1. `pnpm exec vitest run src/components/layout/__tests__/app-shell.test.tsx src/components/layout/__tests__/public-chrome.test.tsx src/app/__tests__/home-reader-flow.test.tsx src/app/__tests__/frontend-listing-style.test.tsx src/components/blog/__tests__/PostCard.test.tsx src/components/blog/__tests__/PostCardFeatured.test.tsx src/components/blog/__tests__/FilterBar.test.tsx src/components/blog/__tests__/PostsListingClient.test.tsx src/app/posts/[slug]/__tests__/article-experience.test.tsx`
2. `pnpm lint`
3. `pnpm build`
4. `pnpm dev`
5. Manually smoke `/`, `/posts`, `/posts/<slug>`, `/categories`, `/tags`, `/archives`

Expected:

- targeted public UI tests PASS
- lint PASSes
- production build PASSes
- homepage, listing, and article detail all share the same editorial rhythm
- no admin, author, or data-contract regressions are introduced

## Non-Goals

- No admin or author UI changes
- No schema or Prisma model changes
- No search API rewrite
- No interaction-state backend rewrite for likes/bookmarks/comments
- No additional animation system beyond the current lightweight reveal pattern
