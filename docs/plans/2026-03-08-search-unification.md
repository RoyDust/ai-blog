# Search Unification Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify the blog search experience behind a dedicated search route, a dedicated search API, and a reusable search form.

**Architecture:** Introduce a dedicated `GET /api/search` endpoint for public content search, then route all public search entry points to `/search?q=...`. Keep `/posts` as a browse/filter page while making `/search` the canonical search destination.

**Tech Stack:** Next.js App Router, React 19, Prisma, Vitest, Testing Library.

---

### Task 1: Add failing search API tests

**Files:**
- Create: `src/app/api/search/__tests__/route.test.ts`
- Create: `src/app/api/search/route.ts`

**Step 1:** Write a test for keyword search over post title/excerpt/content/tags/category/author.

**Step 2:** Run the test and verify it fails because the route does not exist yet.

**Step 3:** Implement the minimal route behavior.

**Step 4:** Run the test and verify it passes.

### Task 2: Add failing shared search form tests

**Files:**
- Create: `src/components/search/__tests__/SearchForm.test.tsx`
- Create: `src/components/search/SearchForm.tsx`

**Step 1:** Write a test for rendering a GET form that submits `q` to `/search`.

**Step 2:** Run the test and verify it fails because the component does not exist yet.

**Step 3:** Implement the minimal reusable form.

**Step 4:** Run the test and verify it passes.

### Task 3: Wire the form into public search entry points

**Files:**
- Modify: `src/components/layout/Navbar.tsx`
- Modify: `src/app/(public)/search/page.tsx`

**Step 1:** Add/adjust tests for the navbar search affordance.

**Step 2:** Update the navbar and search page to use the shared form.

**Step 3:** Verify the targeted component tests pass.

### Task 4: Validate the integrated behavior

**Files:**
- Modify: `src/app/api/search/route.ts`
- Modify: `src/app/(public)/search/page.tsx`

**Step 1:** Run targeted tests for API and UI.

**Step 2:** Run a broader test subset if needed.

**Step 3:** Confirm the canonical search flow is `/search?q=...`.
