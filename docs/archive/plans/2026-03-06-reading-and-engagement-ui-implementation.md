# Reading And Engagement UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve article readability and raise engagement clarity without breaking the current BlogT3-based visual system.

**Architecture:** Keep existing component boundaries and design tokens, then apply focused layout/typography/accessibility updates in `AppShell`, `Navbar`, `Sidebar`, and article detail page. Use test-first verification for each behavior change to avoid silent regressions.

**Tech Stack:** Next.js App Router, React 19, Tailwind CSS v4, Vitest, Testing Library

---

### Task 1: Add Failing UI Behavior Tests

**Files:**
- Modify: `src/app/posts/[slug]/__tests__/article-experience.test.tsx`
- Modify: `src/components/layout/__tests__/app-shell.test.tsx`

**Step 1: Write failing tests**
- Assert article page exposes a comments anchor target (`id="comments"`), and interaction section contains a clear comment CTA.
- Assert `AppShell` renders a keyboard skip link to `#main-content`.

**Step 2: Run tests to verify failures**
- Run: `pnpm test src/app/posts/[slug]/__tests__/article-experience.test.tsx`
- Run: `pnpm test src/components/layout/__tests__/app-shell.test.tsx`
- Expected: at least one new assertion fails in each updated test file.

### Task 2: Implement Minimal UI Changes

**Files:**
- Modify: `src/app/(public)/posts/[slug]/page.tsx`
- Modify: `src/components/layout/AppShell.tsx`
- Modify: `src/components/layout/Navbar.tsx`
- Modify: `src/components/layout/Sidebar.tsx`

**Step 1: Article readability and interaction**
- Add readable line-height and narrower prose measure on article content.
- Add `id="comments"` on comments section.
- Add a clear `Link href="#comments"` CTA in interaction section.

**Step 2: App shell accessibility**
- Add a visible-on-focus skip link targeting `#main-content`.

**Step 3: Navbar polish**
- Reduce motion-heavy classes on nav actions where appropriate.
- Keep clear hover/focus feedback and sticky readability.

**Step 4: Sidebar task-oriented structure**
- Add quick navigation card near top for core reader tasks.
- Keep taxonomy cards but improve section semantics.

### Task 3: Verify and Stabilize

**Files:**
- Verify: `src/app/posts/[slug]/__tests__/article-experience.test.tsx`
- Verify: `src/components/layout/__tests__/app-shell.test.tsx`
- Verify: `src/components/layout/__tests__/public-chrome.test.tsx`

**Step 1: Run updated tests**
- Run: `pnpm test src/app/posts/[slug]/__tests__/article-experience.test.tsx`
- Run: `pnpm test src/components/layout/__tests__/app-shell.test.tsx`
- Run: `pnpm test src/components/layout/__tests__/public-chrome.test.tsx`
- Expected: all pass.

**Step 2: Sanity check diff**
- Run: `git diff -- src/app/(public)/posts/[slug]/page.tsx src/components/layout/AppShell.tsx src/components/layout/Navbar.tsx src/components/layout/Sidebar.tsx src/app/posts/[slug]/__tests__/article-experience.test.tsx src/components/layout/__tests__/app-shell.test.tsx`
- Expected: only intended UI/readability/accessibility changes.
