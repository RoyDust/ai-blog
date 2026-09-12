# Admin Soft Delete Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert post, comment, category, and tag deletion from physical delete to hidden soft delete across admin and public surfaces.

**Architecture:** Add a shared `deletedAt` column to the four content models, then make all public and default admin reads exclude deleted records. Switch delete handlers to timestamp updates so data remains recoverable later without exposing any recycle-bin UI now.

**Tech Stack:** Next.js App Router, React 19, Prisma, PostgreSQL, Vitest.

---

### Task 1: Add shared soft-delete fields

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1:** Add nullable `deletedAt` to `Post`, `Comment`, `Category`, and `Tag`.
**Step 2:** Regenerate Prisma client.
**Step 3:** Push schema changes to the development database.

### Task 2: Hide deleted records from reads

**Files:**
- Modify: `src/lib/posts.ts`
- Modify: `src/app/(public)/page.tsx`
- Modify: `src/app/(public)/posts/page.tsx`
- Modify: `src/app/(public)/posts/[slug]/page.tsx`
- Modify: `src/app/(public)/archives/page.tsx`
- Modify: `src/app/api/posts/[slug]/route.ts`
- Modify: `src/app/api/search/route.ts`
- Modify: `src/app/api/categories/route.ts`
- Modify: `src/app/api/tags/route.ts`
- Modify: `src/app/api/admin/posts/route.ts`
- Modify: `src/app/api/admin/posts/[id]/route.ts`
- Modify: `src/app/api/admin/posts/publish/route.ts`
- Modify: `src/app/api/admin/comments/route.ts`
- Modify: `src/app/api/admin/categories/route.ts`
- Modify: `src/app/api/admin/tags/route.ts`
- Modify: `src/app/admin/page.tsx`

**Step 1:** Add `deletedAt: null` filters to default read paths.
**Step 2:** Prevent deleted posts from public detail access and indexing paths.
**Step 3:** Keep admin dashboards/lists scoped to non-deleted records.

### Task 3: Convert delete endpoints to soft delete

**Files:**
- Modify: `src/app/api/admin/posts/route.ts`
- Modify: `src/app/api/admin/comments/route.ts`
- Modify: `src/app/api/admin/categories/route.ts`
- Modify: `src/app/api/admin/tags/route.ts`
- Modify: `src/app/api/posts/[slug]/route.ts`
- Modify: `src/app/api/comments/route.ts`

**Step 1:** Replace physical deletes with `deletedAt` updates.
**Step 2:** Ensure ownership/admin checks still run before soft delete.
**Step 3:** Keep API responses stable for the UI.

### Task 4: Align admin UI copy

**Files:**
- Modify: `src/app/admin/posts/page.tsx`
- Modify: `src/app/admin/comments/page.tsx`
- Modify: `src/app/admin/categories/page.tsx`
- Modify: `src/app/admin/tags/page.tsx`

**Step 1:** Update confirm copy to reflect hiding instead of permanent removal.
**Step 2:** Keep default lists showing only non-deleted items.
