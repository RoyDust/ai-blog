# Public Blog UI Redesign Follow-up Adjustment Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the already-defined public editorial redesign so the personal intro rail stays on the left, text-only post cards look intentional, and the homepage curated area gets a stronger “编选 + 精选文章” hierarchy.

**Architecture:** Keep the current public routes, Prisma queries, and token system unchanged. Treat this as a focused follow-up patch on top of the existing public editorial redesign: restore the desktop left rail, upgrade `PostCard` to support a first-class no-image presentation, and reshape the homepage into three layers: a full-width editorial intro row, a curated featured grid, and the latest feed.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, existing semantic CSS tokens, Vitest + Testing Library

---

## Baseline

- Related baseline plan: `docs/plans/2026-04-14-public-blog-ui-redesign-implementation.md`
- This document is a delta patch, not a replacement rewrite.
- Keep all previously accepted route, API, and admin isolation constraints.

## Requested Adjustments

1. Personal intro sidebar stays on the left on desktop.
2. Post cards without cover images need a dedicated visual treatment instead of looking like “missing media”.
3. Homepage “编选” block should occupy its own full row.
4. Homepage “精选文章” should use a stronger editorial grid:
   - first row: one lead story
   - second row: two stories in one row
5. All of the above must adapt cleanly across mobile, tablet, laptop, and wide desktop.

## Non-Goals

- No `/admin`, `/write`, `/profile`, `/bookmarks`, or auth redesign.
- No API contract or Prisma schema changes.
- No new homepage infinite loading.
- No article detail layout rewrite beyond incidental spacing inheritance from shell changes.

## Acceptance Criteria

- At `xl` and above, the personal intro rail renders to the left of the main reading column and remains visually calmer than the main content.
- At `md` and below, the left rail does not force a cramped two-column layout; it stacks or collapses without overflow.
- Text-only post cards render without an empty media box and still feel balanced, scannable, and intentional.
- The homepage starts with:
  - Row 1: full-width “编选” intro block
  - Row 2: full-width featured lead story
  - Row 3: two secondary curated stories side by side when space allows
- If there are fewer than three curated posts, the layout degrades gracefully without blank slots.
- `375px`, `768px`, `1024px`, and `1440px` widths all keep readable spacing and avoid awkward card proportions.
- Light and dark themes both preserve readable contrast for left rail cards, text-only cards, and curated featured cards.

## File Structure

- `src/styles/theme-variables.css`
  Extend layout tokens for left-rail spacing, text-only card rhythm, and curated homepage row gaps.
- `src/styles/components.css`
  Add only small utilities if needed for text-only card accent treatment or curated grid rhythm.
- `src/components/layout/AppShell.tsx`
  Restore left-first rail ordering on desktop while keeping mobile stacking sane.
- `src/components/layout/Sidebar.tsx`
  Preserve the personal intro card as the leading left-rail element and refine spacing for left-side presentation.
- `src/components/layout/__tests__/app-shell.test.tsx`
  Update structure expectations so the desktop rail is asserted on the left side.
- `src/components/blog/PostCard.tsx`
  Add a dedicated no-image visual variant instead of reusing the image slot with a blank filler block.
- `src/components/blog/__tests__/PostCard.test.tsx`
  Add coverage for text-only card behavior and class contract.
- `src/components/blog/HomeHero.tsx`
  Reduce responsibility so it becomes the standalone full-width “编选” intro row.
- `src/components/blog/HomeFeaturedGrid.tsx`
  New homepage curated section that owns the 1 + 2 featured-story layout.
- `src/components/blog/HomeLatestPosts.tsx`
  Keep it as the latest section, but ensure it starts after the curated block and inherits the improved text-only cards.
- `src/components/blog/index.ts`
  Export any new homepage component added by this patch.
- `src/app/(public)/page.tsx`
  Recompose homepage data slicing and section order.
- `src/app/__tests__/home-reader-flow.test.tsx`
  Update homepage contract expectations for “编选” and the curated featured grid.

## Task Order

1. Restore the desktop left rail.
2. Upgrade text-only post cards.
3. Rebuild homepage curated hierarchy.
4. Run responsive and targeted verification.

---

### Task 1: Restore the Desktop Left Rail

**Files:**
- Modify: `src/components/layout/AppShell.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/__tests__/app-shell.test.tsx`
- Modify: `src/styles/theme-variables.css`

**Implementation Notes:**

- Keep the sidebar rail as a desktop-only rail, but swap the desktop order so the rail appears before `main` at `xl` and above.
- Preserve the current skip link, navbar sticky offset contract, and footer placement.
- Do not push the rail into small screens as a permanent narrow left column.
- Keep the personal intro card at the top of the rail. On left placement, slightly tighten internal spacing so it reads as author context, not a bulky profile billboard.
- If the desktop rail width changes, keep the main content width contract stable and readable.

**Responsive Rules:**

- `< xl`: single-column flow
- `xl+`: left rail + main content
- no horizontal overflow at any breakpoint

**Verification:**

- `app-shell` test should assert the desktop rail container appears before the main content container in DOM order or layout contract.
- Manually confirm the left rail still respects `--sidebar-sticky-top`.

---

### Task 2: Upgrade Text-Only Post Cards

**Files:**
- Modify: `src/components/blog/PostCard.tsx`
- Modify: `src/components/blog/__tests__/PostCard.test.tsx`
- Modify: `src/styles/components.css`
- Modify: `src/styles/theme-variables.css`

**Implementation Notes:**

- Replace the current no-image fallback block with a dedicated text-only layout.
- When `coverImage` is missing:
  - remove the empty media area entirely
  - let text content span the full card width
  - add a subtle editorial accent so the card still has a visual anchor
- The accent should stay restrained:
  - top border accent
  - kicker-style eyebrow line
  - soft gradient corner
  - or similar lightweight treatment
- Do not add loud icons or placeholder illustrations.
- Keep metadata, title, excerpt, and stats hierarchy intact.
- The text-only variant must also look good when used in homepage secondary curated rows.

**Verification:**

- Add a test for a no-image post asserting:
  - no empty media filler block
  - full-width text layout
  - no broken spacing regression
- Manually confirm cards with and without images still align nicely inside mixed lists.

---

### Task 3: Rebuild Homepage Curated Hierarchy

**Files:**
- Modify: `src/components/blog/HomeHero.tsx`
- Create: `src/components/blog/HomeFeaturedGrid.tsx`
- Modify: `src/components/blog/HomeLatestPosts.tsx`
- Modify: `src/components/blog/index.ts`
- Modify: `src/app/(public)/page.tsx`
- Modify: `src/app/__tests__/home-reader-flow.test.tsx`

**Implementation Notes:**

- Split homepage top area into three parts:

1. `HomeHero`
   - only the “编选” intro
   - full-width row
   - no longer shares a row with the lead featured story

2. `HomeFeaturedGrid`
   - owns the curated story layout
   - consumes the first three curated posts
   - layout:
     - lead story: first row, full width
     - secondary stories: second row, two columns

3. `HomeLatestPosts`
   - begins after curated stories
   - continues to show recent posts
   - benefits from improved text-only card treatment

- Data slicing in `page.tsx` should become:
  - `editorialLead = posts[0]`
  - `secondaryFeatured = posts[1..2]`
  - `latestPosts = posts[3..]`
- Graceful degradation:
  - 0 posts: intro-only fallback
  - 1 post: intro + lead only
  - 2 posts: intro + lead + one secondary below
  - 3+ posts: full 1 + 2 curated layout

**Responsive Rules:**

- Mobile:
  - intro row
  - lead story
  - secondary stories stacked vertically
- Tablet:
  - intro row
  - lead story
  - secondary stories in two columns if width permits
- Desktop:
  - intro row
  - lead story full width
  - second row two columns with matched card heights when practical

**Verification:**

- Homepage test should assert:
  - “编选” block exists
  - “精选文章” section exists
  - “核心特性” still absent
- Manual check should confirm the second-row two-card layout looks balanced with mixed image availability.

---

### Task 4: Responsive Polish and Final Verification

**Files:**
- Review only unless regressions are found

**Responsive Checklist:**

- `375px`
  - no overflow
  - text-only cards remain readable
  - curated homepage stacks cleanly
- `768px`
  - homepage featured rows transition without awkward half-empty columns
  - card padding remains balanced
- `1024px`
  - no cramped pseudo-two-column shell
  - homepage secondary featured cards stay visually matched
- `1440px`
  - left rail clearly anchors the page
  - main content does not drift too wide

**Targeted Verification:**

- `pnpm exec vitest run src/components/layout/__tests__/app-shell.test.tsx src/components/blog/__tests__/PostCard.test.tsx src/app/__tests__/home-reader-flow.test.tsx`
- `pnpm lint`
- `pnpm build`

**Manual Verification:**

- `/`
  - “编选”独占一行
  - “精选文章”第一行单篇、第二行双列
- `/posts`
  - no-image cards visually complete
- desktop shell
  - personal intro rail stays on the left
- light/dark themes
  - no-image cards and curated rows remain readable

---

## Delivery Notes

- Implement this as a follow-up patch after the current editorial redesign branch, not as a parallel rewrite.
- Prefer focused commits by task:
  - `feat(blog): restore left editorial rail`
  - `feat(blog): refine text-only post cards`
  - `feat(blog): restructure curated home featured grid`
  - `chore(blog): verify follow-up editorial adjustments`
