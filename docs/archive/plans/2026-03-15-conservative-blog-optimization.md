# Conservative Blog Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate the low-risk, high-value subset of `blog-optimization-wave1` into a clean PR branch from `main`.

**Architecture:** Recreate the selected behavior from tests first on a fresh branch. Keep scope limited to cache normalization, shared public listing/taxonomy pagination helpers, resilient public page states, and their direct tests.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma, Vitest

---

### Task 1: Add Conservative Coverage First

**Files:**
- Modify: `src/lib/__tests__/cache.test.ts`
- Modify: `src/lib/__tests__/posts.test.ts`
- Modify: `src/lib/__tests__/category-catalog.test.ts`
- Modify: `src/lib/__tests__/tag-catalog.test.ts`
- Modify: `src/app/__tests__/home-reader-flow.test.tsx`
- Modify: `src/app/__tests__/taxonomy-redirects.test.tsx`

**Step 1: Write the failing tests**

Add tests for:
- cache path normalization/deduplication
- reusable public query fragments and deterministic pagination metadata
- category/tag detail pagination behavior
- home-page load failure alert
- out-of-range taxonomy page empty state

**Step 2: Run tests to verify they fail**

Run:
`pnpm test src/lib/__tests__/cache.test.ts src/lib/__tests__/posts.test.ts src/lib/__tests__/category-catalog.test.ts src/lib/__tests__/tag-catalog.test.ts src/app/__tests__/home-reader-flow.test.tsx src/app/__tests__/taxonomy-redirects.test.tsx`

Expected: failures caused by missing conservative integration behavior.

**Step 3: Commit**

Commit the test-only changes once the failures are confirmed.

### Task 2: Implement Shared Cache and Pagination Foundations

**Files:**
- Modify: `src/lib/cache.ts`
- Modify: `src/lib/pagination.ts`
- Modify: `src/lib/posts.ts`
- Modify: `src/lib/taxonomy.ts`

**Step 1: Write the minimal implementation**

Implement:
- slug normalization before public cache revalidation
- `TAXONOMY_PAGE_SIZE`
- shared public post select/order/pagination helpers
- paginated category/tag detail loaders

**Step 2: Run targeted tests**

Run:
`pnpm test src/lib/__tests__/cache.test.ts src/lib/__tests__/posts.test.ts src/lib/__tests__/category-catalog.test.ts src/lib/__tests__/tag-catalog.test.ts`

Expected: targeted library tests pass.

**Step 3: Commit**

Commit the shared-library implementation once tests are green.

### Task 3: Implement Public Page Resilience

**Files:**
- Modify: `src/app/(public)/page.tsx`
- Modify: `src/app/(public)/posts/page.tsx`
- Modify: `src/app/(public)/categories/page.tsx`
- Modify: `src/app/(public)/categories/[slug]/page.tsx`
- Modify: `src/app/(public)/tags/page.tsx`
- Modify: `src/app/(public)/tags/[slug]/page.tsx`

**Step 1: Write the minimal implementation**

Implement:
- partial-load failure alerts on home and posts pages
- graceful loader failure states on category/tag directory pages
- taxonomy pagination parsing and out-of-range empty states on category/tag detail pages

**Step 2: Run targeted tests**

Run:
`pnpm test src/app/__tests__/home-reader-flow.test.tsx src/app/__tests__/taxonomy-redirects.test.tsx`

Expected: the public page behavior tests pass.

**Step 3: Commit**

Commit the public-page integration after targeted tests pass.

### Task 4: Run Final Verification and Prepare PR

**Files:**
- Review only; no required source edits

**Step 1: Run full verification**

Run:
- `pnpm test`
- `git diff --stat main...HEAD`

Expected:
- full suite passes
- diff contains only the conservative integration files

**Step 2: Summarize PR**

Prepare a PR summary covering:
- cache invalidation hardening
- shared public pagination/query cleanup
- public page resilience improvements

**Step 3: Commit**

Create any final cleanup commit if needed, otherwise keep the existing task commits.
