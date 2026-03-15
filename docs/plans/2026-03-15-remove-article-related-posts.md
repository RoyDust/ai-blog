# Remove Article Related Posts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the related-posts section from article detail pages while preserving previous/next article navigation.

**Architecture:** Narrow the change to the article detail continuation flow. Update the article experience test first so it defines the new behavior, then simplify the continuation component and page data loading to stop querying and rendering related posts.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, Testing Library

---

### Task 1: Lock the new article detail behavior with a failing test

**Files:**
- Modify: `src/app/posts/[slug]/__tests__/article-experience.test.tsx`

**Step 1: Write the failing test**

Change the existing article experience test so it expects:
- the `相关文章` heading is absent
- the related article link is absent
- `findMany` is not called during article detail rendering

**Step 2: Run test to verify it fails**

Run: `pnpm test src/app/posts/[slug]/__tests__/article-experience.test.tsx`
Expected: FAIL because the page still renders related content and still calls `findMany`

### Task 2: Remove the related-post continuation flow

**Files:**
- Modify: `src/components/blog/ArticleContinuation.tsx`
- Modify: `src/app/(public)/posts/[slug]/page.tsx`

**Step 1: Write minimal implementation**

Simplify `ArticleContinuation` so it only accepts and renders `previousPost` and `nextPost`.

Simplify `getContinuationData()` in the article page so it only queries adjacent posts and no longer selects or slices related posts.

Update the `ArticleContinuation` invocation accordingly.

**Step 2: Run test to verify it passes**

Run: `pnpm test src/app/posts/[slug]/__tests__/article-experience.test.tsx`
Expected: PASS

### Task 3: Verify and review

**Files:**
- Review: `src/components/blog/ArticleContinuation.tsx`
- Review: `src/app/(public)/posts/[slug]/page.tsx`
- Review: `src/app/posts/[slug]/__tests__/article-experience.test.tsx`

**Step 1: Run focused verification**

Run: `pnpm test src/app/posts/[slug]/__tests__/article-experience.test.tsx`
Expected: PASS with 0 failures

**Step 2: Review diff**

Run: `git diff -- src/components/blog/ArticleContinuation.tsx src/app/(public)/posts/[slug]/page.tsx src/app/posts/[slug]/__tests__/article-experience.test.tsx docs/plans/2026-03-15-remove-article-related-posts.md`
Expected: Only the approved related-posts removal and test/doc updates appear
