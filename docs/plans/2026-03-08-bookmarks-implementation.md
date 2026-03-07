# Bookmarks Minimal Luxury Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the public bookmarks page into a private-library style reading archive with premium minimal presentation.

**Architecture:** Keep the existing server-side bookmarks data flow and authentication redirect intact, but replace the generic grid/card presentation with a dedicated bookmarks layout and a purpose-built bookmark item component. The new UI should separate page-level structure from item rendering so the page stays readable and future enhancements remain localized.

**Tech Stack:** Next.js App Router, React 19, Prisma, Tailwind utility classes, Vitest, Testing Library.

---

### Task 1: Add failing tests for the new bookmarks page structure

**Files:**
- Modify: `src/app/(public)/bookmarks/page.tsx`
- Create: `src/app/(public)/bookmarks/__tests__/page.test.tsx`

**Step 1: Write the failing test**

Add a test that renders the bookmarks page with mocked session/data and expects:
- the heading `我的收藏`
- a supporting description line
- a saved count label
- bookmark items rendered in archive/list format rather than a generic blog grid card stub

**Step 2: Run test to verify it fails**

Run: `npm test -- 'src/app/(public)/bookmarks/__tests__/page.test.tsx'`
Expected: FAIL because the current page still renders the old layout.

**Step 3: Write minimal implementation**

Refactor the page structure to include the new header and list container while keeping data fetching unchanged.

**Step 4: Run test to verify it passes**

Run: `npm test -- 'src/app/(public)/bookmarks/__tests__/page.test.tsx'`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/(public)/bookmarks/page.tsx src/app/(public)/bookmarks/__tests__/page.test.tsx
git commit -m "test: cover bookmarks archive layout"
```

### Task 2: Add failing tests for a dedicated bookmark item component

**Files:**
- Create: `src/components/bookmarks/BookmarkShelfItem.tsx`
- Create: `src/components/bookmarks/__tests__/BookmarkShelfItem.test.tsx`

**Step 1: Write the failing test**

Add tests that expect the component to show:
- category/date metadata
- strong title hierarchy
- excerpt/snippet text
- a refined article CTA
- understated stats or reading metadata

**Step 2: Run test to verify it fails**

Run: `npm test -- 'src/components/bookmarks/__tests__/BookmarkShelfItem.test.tsx'`
Expected: FAIL because the component does not exist yet.

**Step 3: Write minimal implementation**

Create the component and map the bookmark post data into a premium reading-entry layout.

**Step 4: Run test to verify it passes**

Run: `npm test -- 'src/components/bookmarks/__tests__/BookmarkShelfItem.test.tsx'`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/bookmarks/BookmarkShelfItem.tsx src/components/bookmarks/__tests__/BookmarkShelfItem.test.tsx
git commit -m "feat: add bookmark shelf item"
```

### Task 3: Replace the old grid with the new reading archive presentation

**Files:**
- Modify: `src/app/(public)/bookmarks/page.tsx`
- Modify: `src/components/bookmarks/BookmarkShelfItem.tsx`

**Step 1: Write/adjust the failing test**

Extend the page test to verify:
- list spacing and narrow container classes
- empty state CTA links to `/posts`
- the old `PostCard`-style grid is no longer the primary layout

**Step 2: Run test to verify it fails**

Run: `npm test -- 'src/app/(public)/bookmarks/__tests__/page.test.tsx' 'src/components/bookmarks/__tests__/BookmarkShelfItem.test.tsx'`
Expected: FAIL until the old grid is removed.

**Step 3: Write minimal implementation**

Render bookmarks through the new component in a refined single-column archive layout, and replace the empty state with premium minimalist copy.

**Step 4: Run test to verify it passes**

Run: `npm test -- 'src/app/(public)/bookmarks/__tests__/page.test.tsx' 'src/components/bookmarks/__tests__/BookmarkShelfItem.test.tsx'`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/(public)/bookmarks/page.tsx src/components/bookmarks/BookmarkShelfItem.tsx
git commit -m "feat: redesign bookmarks as reading archive"
```

### Task 4: Validate the redesign against surrounding UI expectations

**Files:**
- Modify: `src/app/(public)/bookmarks/page.tsx`
- Modify: `src/components/bookmarks/BookmarkShelfItem.tsx`

**Step 1: Run targeted tests**

Run: `npm test -- 'src/app/(public)/bookmarks/__tests__/page.test.tsx' 'src/components/bookmarks/__tests__/BookmarkShelfItem.test.tsx'`
Expected: PASS.

**Step 2: Run full tests**

Run: `npm test`
Expected: PASS with no unrelated regressions.

**Step 3: Final visual sanity review**

Check the page in the browser for:
- generous whitespace
- readable hierarchy
- premium empty state
- responsive integrity at mobile and desktop widths

**Step 4: Commit**

```bash
git add src/app/(public)/bookmarks/page.tsx src/components/bookmarks/BookmarkShelfItem.tsx src/app/(public)/bookmarks/__tests__/page.test.tsx src/components/bookmarks/__tests__/BookmarkShelfItem.test.tsx
git commit -m "polish: refine bookmarks luxury layout"
```
