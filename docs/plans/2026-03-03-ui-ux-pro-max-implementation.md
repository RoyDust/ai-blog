# UI/UX Pro Max Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver a full brand-level UI/UX rebuild across reader, author, and admin flows with a shared design system and motion foundation.

**Architecture:** Introduce tokenized styling in `globals.css`, wrap key screens in a unified application shell, then migrate feature surfaces incrementally (reader -> author -> admin). Use Server Components for content rendering and Client Components for high-interaction controls and motion.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, framer-motion, Prisma, NextAuth, ESLint, Playwright (new), Vitest + Testing Library (new).

---

### Task 1: Add UI/UX dependencies and scripts

**Files:**
- Modify: `package.json`

**Step 1: Write the failing test**

```ts
// pseudo-check for plan gate
expect(packageJson.dependencies['framer-motion']).toBeDefined()
```

**Step 2: Run test to verify it fails**

Run: `pnpm install --frozen-lockfile`  
Expected: missing lock entries or dependency mismatch before update.

**Step 3: Write minimal implementation**

- Add dependencies: `framer-motion`, `clsx`, `tailwind-merge`
- Add dev dependencies: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `playwright`
- Add scripts: `test`, `test:ui`, `test:e2e`

**Step 4: Run verification**

Run: `pnpm install`  
Expected: install succeeds and lockfile updates.

**Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add UI testing and motion dependencies"
```

### Task 2: Create design tokens and typography foundation

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

**Step 1: Write the failing test**

Create: `src/components/ui/__tests__/theme-tokens.test.tsx`

```tsx
import { render } from '@testing-library/react'
import { Button } from '@/components/ui/Button'

test('button uses tokenized class contract', () => {
  const { getByRole } = render(<Button>Go</Button>)
  expect(getByRole('button').className).toContain('ui-btn')
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/components/ui/__tests__/theme-tokens.test.tsx`  
Expected: FAIL because `ui-btn` token class not introduced yet.

**Step 3: Write minimal implementation**

- Add global CSS variables for brand/semantic tokens (light/dark)
- Add typography variables and load `Noto Sans SC`, `Manrope`, `JetBrains Mono` in `layout.tsx`
- Add utility class aliases (e.g. `.ui-btn`, `.ui-surface`, `.ui-ring`)

**Step 4: Run verification**

Run: `pnpm test src/components/ui/__tests__/theme-tokens.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx src/components/ui/__tests__/theme-tokens.test.tsx
git commit -m "feat: add brand tokens and typography foundation"
```

### Task 3: Rebuild core UI primitives using token contract

**Files:**
- Modify: `src/components/ui/Button.tsx`
- Modify: `src/components/ui/Input.tsx`
- Modify: `src/components/ui/Card.tsx`
- Modify: `src/components/ui/Modal.tsx`
- Modify: `src/components/ui/index.ts`
- Test: `src/components/ui/__tests__/primitives.test.tsx`

**Step 1: Write the failing test**

```tsx
test('button supports variants with consistent focus ring', () => {
  const { getByRole } = render(<Button variant="primary">Save</Button>)
  expect(getByRole('button').className).toContain('focus-visible')
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/components/ui/__tests__/primitives.test.tsx`  
Expected: FAIL on missing expected tokenized class behavior.

**Step 3: Write minimal implementation**

- Refactor primitives to token-driven classes with `clsx` + `tailwind-merge`
- Normalize spacing, radius, and visual states
- Ensure consistent dark mode behavior without duplicated class noise

**Step 4: Run verification**

Run: `pnpm test src/components/ui/__tests__/primitives.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/ui src/components/ui/__tests__/primitives.test.tsx
git commit -m "feat: rebuild core UI primitives with tokenized styling"
```

### Task 4: Build new app shell (global nav, context rail, footer)

**Files:**
- Create: `src/components/layout/AppShell.tsx`
- Modify: `src/components/layout/Header.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/Footer.tsx`
- Modify: `src/app/layout.tsx`
- Test: `src/components/layout/__tests__/app-shell.test.tsx`

**Step 1: Write the failing test**

```tsx
test('app shell renders role-aware navigation landmarks', () => {
  const { getByRole } = render(<AppShell><div>Content</div></AppShell>)
  expect(getByRole('navigation')).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/components/layout/__tests__/app-shell.test.tsx`  
Expected: FAIL because `AppShell` does not exist.

**Step 3: Write minimal implementation**

- Add `AppShell` layout wrapper
- Move legacy header/footer styling to new visual language
- Keep role-based links (reader/author/admin) in top nav

**Step 4: Run verification**

Run: `pnpm test src/components/layout/__tests__/app-shell.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/layout src/app/layout.tsx
git commit -m "feat: introduce unified app shell and new navigation"
```

### Task 5: Rebuild homepage and reader listing surfaces

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/blog/PostCard.tsx`
- Create: `src/components/blog/PostCardFeatured.tsx`
- Create: `src/components/blog/FilterBar.tsx`
- Modify: `src/app/posts/page.tsx`
- Test: `src/app/__tests__/home-reader-flow.test.tsx`

**Step 1: Write the failing test**

```tsx
test('home shows featured section and latest feed', async () => {
  const ui = await Home()
  expect(ui).toBeTruthy()
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/app/__tests__/home-reader-flow.test.tsx`  
Expected: FAIL due missing featured/feed structure assertions.

**Step 3: Write minimal implementation**

- Restructure homepage: hero + featured + latest + topical rail
- Add post card variants for density contexts
- Add reader filter bar contract in posts list page

**Step 4: Run verification**

Run: `pnpm test src/app/__tests__/home-reader-flow.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/page.tsx src/app/posts/page.tsx src/components/blog
git commit -m "feat: redesign reader home and listing experiences"
```

### Task 6: Rebuild article detail reading experience

**Files:**
- Modify: `src/app/posts/[slug]/page.tsx`
- Create: `src/components/blog/ReadingProgress.tsx`
- Create: `src/components/blog/ArticleToc.tsx`
- Modify: `src/components/blog/LikeButton.tsx`
- Modify: `src/components/blog/BookmarkButton.tsx`
- Test: `src/app/posts/[slug]/__tests__/article-experience.test.tsx`

**Step 1: Write the failing test**

```tsx
test('article page includes progress and interaction rail', async () => {
  const ui = await PostPage({ params: Promise.resolve({ slug: 'x' }) })
  expect(ui).toBeTruthy()
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/app/posts/[slug]/__tests__/article-experience.test.tsx`  
Expected: FAIL on missing new reader modules.

**Step 3: Write minimal implementation**

- Add reading progress indicator
- Add TOC anchor rail
- Refine like/bookmark interaction feedback and optimistic states

**Step 4: Run verification**

Run: `pnpm test src/app/posts/[slug]/__tests__/article-experience.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/posts/[slug]/page.tsx src/components/blog
git commit -m "feat: upgrade article reading and interaction experience"
```

### Task 7: Rebuild author workflow screens

**Files:**
- Modify: `src/app/write/page.tsx`
- Modify: `src/app/posts/[slug]/edit/page.tsx`
- Create: `src/components/posts/EditorWorkspace.tsx`
- Create: `src/components/posts/PublishChecklist.tsx`
- Test: `src/app/write/__tests__/author-workflow.test.tsx`

**Step 1: Write the failing test**

```tsx
test('write page renders editor and publish settings panes', async () => {
  const ui = await WritePage()
  expect(ui).toBeTruthy()
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/app/write/__tests__/author-workflow.test.tsx`  
Expected: FAIL before dual-pane workspace implementation.

**Step 3: Write minimal implementation**

- Convert write/edit screens to dual-pane layout
- Add autosave indicator state + publish checklist module
- Improve action hierarchy (draft, publish, preview)

**Step 4: Run verification**

Run: `pnpm test src/app/write/__tests__/author-workflow.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/write/page.tsx src/app/posts/[slug]/edit/page.tsx src/components/posts
git commit -m "feat: redesign author workspace and publish flow"
```

### Task 8: Rebuild admin information-dense views

**Files:**
- Create: `src/components/admin/DataTable.tsx`
- Create: `src/components/admin/FilterBar.tsx`
- Modify: `src/app/admin/page.tsx`
- Modify: `src/app/admin/posts/page.tsx`
- Modify: `src/app/admin/comments/page.tsx`
- Modify: `src/app/admin/categories/page.tsx`
- Modify: `src/app/admin/tags/page.tsx`
- Test: `src/app/admin/__tests__/admin-density.test.tsx`

**Step 1: Write the failing test**

```tsx
test('admin list pages render data table with bulk action affordance', async () => {
  const ui = await AdminPostsPage()
  expect(ui).toBeTruthy()
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/app/admin/__tests__/admin-density.test.tsx`  
Expected: FAIL because shared table abstractions do not exist.

**Step 3: Write minimal implementation**

- Introduce reusable admin data table + filter bar
- Migrate each admin page to consistent list/density pattern
- Add clear destructive-action confirmation copy

**Step 4: Run verification**

Run: `pnpm test src/app/admin/__tests__/admin-density.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/admin src/app/admin
git commit -m "feat: redesign admin workflows with dense data table patterns"
```

### Task 9: Add motion primitives and route/list transitions

**Files:**
- Create: `src/components/motion/MotionProvider.tsx`
- Create: `src/components/motion/FadeIn.tsx`
- Create: `src/components/motion/StaggerList.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/posts/page.tsx`
- Test: `src/components/motion/__tests__/motion-safety.test.tsx`

**Step 1: Write the failing test**

```tsx
test('motion components render static fallback when reduced motion is preferred', () => {
  // expect reduced-motion safe behavior
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/components/motion/__tests__/motion-safety.test.tsx`  
Expected: FAIL because motion helpers are absent.

**Step 3: Write minimal implementation**

- Add `framer-motion` wrappers with timing token constants
- Integrate page/list transitions where they improve hierarchy
- Honor `prefers-reduced-motion`

**Step 4: Run verification**

Run: `pnpm test src/components/motion/__tests__/motion-safety.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/motion src/app/layout.tsx src/app/page.tsx src/app/posts/page.tsx
git commit -m "feat: add motion system with reduced-motion fallback"
```

### Task 10: End-to-end verification and release guardrails

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/reader.spec.ts`
- Create: `e2e/author.spec.ts`
- Create: `e2e/admin.spec.ts`
- Modify: `README.md`
- Modify: `TEST_REPORT.md`

**Step 1: Write the failing test**

```ts
test('reader can browse and open article', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('main')).toBeVisible()
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:e2e`  
Expected: FAIL before Playwright config and selectors are ready.

**Step 3: Write minimal implementation**

- Add Playwright config and three core flow specs
- Update docs with new runbook commands
- Capture known baseline in `TEST_REPORT.md`

**Step 4: Run verification**

Run: `pnpm lint`  
Expected: PASS.

Run: `pnpm build`  
Expected: PASS.

Run: `pnpm test`  
Expected: PASS.

Run: `pnpm test:e2e`  
Expected: PASS.

**Step 5: Commit**

```bash
git add playwright.config.ts e2e README.md TEST_REPORT.md
git commit -m "test: add end-to-end quality gates for UI/UX pro max rollout"
```

## Execution Notes

- Keep each task independent and shippable.
- Do not start downstream tasks before current task tests pass.
- Use frequent commits exactly as listed to preserve rollback safety.
- If task scope expands, split into new numbered task(s), do not inflate existing ones.
