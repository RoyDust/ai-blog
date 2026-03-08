# Anonymous Engagement and Profile Removal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace login-gated engagement with anonymous browser-based interactions, retire the public profile route, and simplify the home page UI.

**Architecture:** Introduce a shared anonymous identity helper for browser ID and IP masking, migrate likes to anonymous persistence, move bookmarks to local storage, and retire public profile surfaces through redirects and navigation cleanup.

**Tech Stack:** Next.js App Router, React, Vitest, Prisma, localStorage, NextRequest headers.

---

### Task 1: Add anonymous identity helpers

**Files:**
- Create: `src/lib/browser-id.ts`
- Create: `src/lib/__tests__/browser-id.test.ts`

**Step 1: Write failing tests**
- Cover browser ID generation and reuse.
- Cover browser ID header normalization.
- Cover IP masking for IPv4 and IPv6.

**Step 2: Run targeted tests to verify failures**
- Run: `pnpm test src/lib/__tests__/browser-id.test.ts`

**Step 3: Implement minimal helper functions**
- Export client-safe browser ID generation.
- Export server helpers for reading browser ID and masking IP.

**Step 4: Re-run targeted tests**
- Run: `pnpm test src/lib/__tests__/browser-id.test.ts`

### Task 2: Add local bookmark storage support

**Files:**
- Create: `src/lib/bookmark-store.ts`
- Create: `src/lib/__tests__/bookmark-store.test.ts`

**Step 1: Write failing tests**
- Cover add, remove, read, and dedupe behavior for bookmark records.

**Step 2: Run targeted tests to verify failures**
- Run: `pnpm test src/lib/__tests__/bookmark-store.test.ts`

**Step 3: Implement minimal bookmark storage helpers**
- Persist bookmark metadata in `localStorage`.

**Step 4: Re-run targeted tests**
- Run: `pnpm test src/lib/__tests__/bookmark-store.test.ts`

### Task 3: Switch article interactions to anonymous mode

**Files:**
- Modify: `src/components/blog/LikeButton.tsx`
- Modify: `src/components/blog/BookmarkButton.tsx`
- Modify: `src/components/CommentForm.tsx`
- Modify: `src/components/CommentAuthGate.tsx`
- Modify: `src/app/(public)/posts/[slug]/page.tsx`
- Modify: `src/app/api/posts/[slug]/like/route.ts`
- Modify: `src/app/api/comments/route.ts`

**Step 1: Write or update failing tests**
- Cover anonymous article rendering expectations.
- Cover route behavior for anonymous likes and comments.

**Step 2: Run targeted tests to verify failures**
- Run: `pnpm test src/app/posts/[slug]/__tests__/article-experience.test.tsx`

**Step 3: Implement minimal anonymous interaction flow**
- Send browser ID headers from the client.
- Remove login gating from comments.
- Persist likes by browser ID and comments by anonymous label.

**Step 4: Re-run targeted tests**
- Run: `pnpm test src/app/posts/[slug]/__tests__/article-experience.test.tsx`

### Task 4: Retire profile route and simplify entry points

**Files:**
- Modify: `src/app/profile/page.tsx`
- Modify: `src/app/profile/edit/page.tsx`
- Modify: `src/components/UserNav.tsx`
- Modify: `src/components/__tests__/dark-mode-contract.test.tsx`
- Modify: `e2e/author.spec.ts`

**Step 1: Write or update failing tests**
- Remove assumptions that the profile page is a themed surface.
- Keep write-route compatibility coverage intact.

**Step 2: Run targeted tests to verify failures**
- Run: `pnpm test src/components/__tests__/dark-mode-contract.test.tsx`

**Step 3: Implement redirects and navigation cleanup**
- Redirect `/profile` and `/profile/edit` to `/admin`.
- Remove profile links from authenticated public navigation.

**Step 4: Re-run targeted tests**
- Run: `pnpm test src/components/__tests__/dark-mode-contract.test.tsx`

### Task 5: Refresh home page and scrollbar UI

**Files:**
- Modify: `src/app/(public)/page.tsx`
- Modify: one or more global style files under `src/styles/`

**Step 1: Write or update failing tests if coverage exists**
- Update homepage structure assertions if needed.

**Step 2: Implement the UI refresh**
- Remove the welcome hero card.
- Add branded scrollbar styling using theme tokens.

**Step 3: Run targeted tests**
- Run: `pnpm test src/app/__tests__/home-reader-flow.test.tsx`

### Task 6: Verify integrated behavior

**Files:**
- Modify only as needed based on verification output.

**Step 1: Run focused test suite**
- Run: `pnpm test src/lib/__tests__/browser-id.test.ts src/lib/__tests__/bookmark-store.test.ts src/app/posts/[slug]/__tests__/article-experience.test.tsx src/components/__tests__/dark-mode-contract.test.tsx`

**Step 2: Run broader regression checks**
- Run: `pnpm test`
- Run: `pnpm lint`

**Step 3: Summarize any remaining follow-up**
- Note any database migration or manual verification steps.

