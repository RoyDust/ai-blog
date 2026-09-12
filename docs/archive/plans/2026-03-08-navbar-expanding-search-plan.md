# Navbar Expanding Search Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a compact desktop navbar search that expands on focus and submits on Enter.

**Architecture:** Keep native form submission so search navigation remains simple and robust. Extend the shared `SearchForm` with a navbar-specific compact mode rather than duplicating search markup in `Navbar`.

**Tech Stack:** Next.js, React, Tailwind utility classes, Vitest, Testing Library.

---

### Task 1: Add regression tests for navbar search

**Files:**
- Modify: `src/components/layout/__tests__/navbar-behavior.test.tsx`
- Modify: `src/components/search/__tests__/SearchForm.test.tsx`

**Step 1: Write the failing test**
- Assert the desktop navbar renders a search field with an animated width contract.
- Assert the shared search form keeps native GET submission semantics and uses `type="search"`.

**Step 2: Run test to verify it fails**
- Run: `npm test -- "src/components/layout/__tests__/navbar-behavior.test.tsx" "src/components/search/__tests__/SearchForm.test.tsx"`
- Expected: FAIL because navbar search does not yet expose the new class contract.

**Step 3: Write minimal implementation**
- Add a navbar presentation mode to `SearchForm`.
- Update `Navbar` to use the new mode and remove the desktop submit button.

**Step 4: Run test to verify it passes**
- Run the same targeted test command.
- Expected: PASS.

### Task 2: Verify no regression in public search behavior

**Files:**
- Verify: `src/app/(public)/search/__tests__/page.test.tsx`

**Step 1: Run targeted verification**
- Run: `npm test -- "src/app/(public)/search/__tests__/page.test.tsx"`
- Expected: PASS.
