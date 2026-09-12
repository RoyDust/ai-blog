# Article Reading Time Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persist article reading time in the `Post` model, keep it updated on create/edit, and display it in the article header while removing author avatar/name from the detail page.

**Architecture:** Add a shared reading-time utility in `src/lib`, persist its output through the admin create/edit routes, and expose the stored field in the public article query. A migration plus a one-off backfill script handles existing rows so the UI can rely on a non-null stored value.

**Tech Stack:** Next.js App Router, Prisma, PostgreSQL, TypeScript, Vitest, Testing Library

---

### Task 1: Lock the new article header behavior with failing tests

**Files:**
- Modify: `src/app/posts/[slug]/__tests__/article-experience.test.tsx`

**Step 1: Write the failing test**

Update the article detail test so it expects:
- `预计阅读 1 分钟` is rendered for the mocked article
- the author name is not rendered in the header

**Step 2: Run test to verify it fails**

Run: `pnpm test src/app/posts/[slug]/__tests__/article-experience.test.tsx`
Expected: FAIL because the page does not yet render stored reading time and still shows the author row

### Task 2: Lock the shared reading-time calculation with failing tests

**Files:**
- Create: `src/lib/__tests__/reading-time.test.ts`
- Create: `src/lib/reading-time.ts`

**Step 1: Write the failing test**

Add tests that expect:
- empty or whitespace content returns `1`
- short markdown content returns `1`
- longer content returns a value greater than `1`

**Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/__tests__/reading-time.test.ts`
Expected: FAIL because the utility does not exist yet

### Task 3: Lock create/edit persistence with failing API tests

**Files:**
- Create: `src/app/api/admin/posts/__tests__/route.test.ts`
- Create: `src/app/api/admin/posts/[id]/__tests__/route.test.ts`

**Step 1: Write the failing tests**

Add route tests that expect:
- create uses the shared calculator and writes `readingTimeMinutes`
- edit recomputes and updates `readingTimeMinutes`

**Step 2: Run tests to verify they fail**

Run: `pnpm test src/app/api/admin/posts/__tests__/route.test.ts src/app/api/admin/posts/[id]/__tests__/route.test.ts`
Expected: FAIL because the routes do not yet write the new field

### Task 4: Implement the persisted reading-time flow

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_post_reading_time/migration.sql`
- Create: `src/lib/reading-time.ts`
- Modify: `src/app/api/admin/posts/route.ts`
- Modify: `src/app/api/admin/posts/[id]/route.ts`
- Modify: `src/app/(public)/posts/[slug]/page.tsx`
- Create: `scripts/backfill-reading-time.ts`

**Step 1: Write minimal implementation**

- Add `readingTimeMinutes` to `Post`
- Implement the shared reading-time calculator
- Use it during post create and edit
- Select and render the stored field in the article page
- Remove the author identity row from the article header
- Add the backfill script for existing posts

**Step 2: Run focused tests to verify they pass**

Run: `pnpm test src/lib/__tests__/reading-time.test.ts src/app/api/admin/posts/__tests__/route.test.ts src/app/api/admin/posts/[id]/__tests__/route.test.ts src/app/posts/[slug]/__tests__/article-experience.test.tsx`
Expected: PASS

### Task 5: Verify the integrated change

**Files:**
- Review: `prisma/schema.prisma`
- Review: `src/lib/reading-time.ts`
- Review: `src/app/api/admin/posts/route.ts`
- Review: `src/app/api/admin/posts/[id]/route.ts`
- Review: `src/app/(public)/posts/[slug]/page.tsx`
- Review: `scripts/backfill-reading-time.ts`

**Step 1: Run verification**

Run: `pnpm test`
Expected: PASS

Run: `pnpm lint`
Expected: PASS

**Step 2: Review diff**

Run: `git diff -- prisma/schema.prisma src/lib/reading-time.ts src/lib/__tests__/reading-time.test.ts src/app/api/admin/posts/route.ts src/app/api/admin/posts/__tests__/route.test.ts src/app/api/admin/posts/[id]/route.ts src/app/api/admin/posts/[id]/__tests__/route.test.ts src/app/(public)/posts/[slug]/page.tsx src/app/posts/[slug]/__tests__/article-experience.test.tsx scripts/backfill-reading-time.ts docs/plans/2026-03-15-article-reading-time-design.md docs/plans/2026-03-15-article-reading-time.md`
Expected: Only persisted reading-time and article-header changes appear
