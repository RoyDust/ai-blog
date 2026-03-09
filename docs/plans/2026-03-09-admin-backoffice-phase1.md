# Admin Backoffice Gap Phase 1 Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Land the first batch of admin backoffice improvements from the gap-analysis document with minimal, test-backed changes.

**Architecture:** Tighten admin-only write paths by moving admin create flows onto `/api/admin/*`, add explicit comment moderation state and bulk actions in the admin panel, and align the dashboard summary copy with the data it actually shows. Deletion workflow upgrades are staged after these foundations because they touch Prisma schema and multiple read paths.

**Tech Stack:** Next.js App Router, React 19, Prisma, Vitest, Testing Library.

---

### Task 1: Tighten admin post creation boundary

**Files:**
- Modify: `src/components/posts/CreatePostWorkspace.tsx`
- Modify: `src/app/api/admin/posts/route.ts`
- Modify: `src/app/admin/__tests__/admin-create-post.test.tsx`

**Step 1:** Update the failing admin create-post test to expect the admin API.

**Step 2:** Add `POST /api/admin/posts` guarded by admin session.

**Step 3:** Point the admin create workspace to the admin-only route.

**Step 4:** Run the targeted admin create-post test.

### Task 2: Add comment moderation state and bulk governance

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/app/api/comments/route.ts`
- Modify: `src/app/api/admin/comments/route.ts`
- Modify: `src/app/admin/comments/page.tsx`
- Modify: `src/app/admin/__tests__/comments-page.test.tsx`

**Step 1:** Add tests for rendering moderation status and bulk moderation affordances.

**Step 2:** Add a Prisma comment-status enum plus comment status field.

**Step 3:** Expose status in admin comment queries and add a bulk moderation PATCH path.

**Step 4:** Update the admin comments page to filter by status and perform bulk actions.

### Task 3: Fix dashboard metric wording

**Files:**
- Modify: `src/app/admin/page.tsx`
- Modify: `src/app/admin/__tests__/page.test.tsx`

**Step 1:** Add a test that locks the dashboard wording to the actual metric scope.

**Step 2:** Replace misleading “最近 30 天” copy with cumulative wording and clearer hints.

**Step 3:** Run the targeted dashboard tests.
