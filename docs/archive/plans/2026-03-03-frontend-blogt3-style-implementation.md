# Frontend BlogT3 Style Replication Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild `my-next-app` frontend UI to closely match `BlogT3` visual style and interactions while preserving existing frontend routes and backend data contracts.

**Architecture:** Introduce a BlogT3-style token and utility class system in shared CSS, then migrate frontend shell/components to those primitives under a public layout boundary. Keep existing data fetching and route paths, adding adapter mapping where component prop shapes differ. Roll out incrementally with TDD and route-level regression checks.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Vitest + Testing Library, Playwright.

---

### Task 1: Install BlogT3 Theme Foundation in Global Styles

**Files:**
- Create: `src/styles/theme-variables.css`
- Create: `src/styles/components.css`
- Create: `src/styles/animations.css`
- Modify: `src/app/globals.css`
- Test: `src/components/ui/__tests__/blogt3-theme-foundation.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render } from "@testing-library/react";
import { Button } from "@/components/ui/Button";

test("blogt3 foundation classes are consumable by UI primitives", () => {
  const { getByRole } = render(<Button className="btn-regular">Save</Button>);
  expect(getByRole("button").className).toContain("btn-regular");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/components/ui/__tests__/blogt3-theme-foundation.test.tsx`
Expected: FAIL because BlogT3 classes/tokens are not yet defined/imported.

**Step 3: Write minimal implementation**

```css
/* src/styles/theme-variables.css */
:root { --hue: 250; --page-width: 75rem; --radius-large: 1rem; }
:root.dark { --hue: 250; }

/* src/styles/components.css */
@layer components {
  .card-base { @apply rounded-[var(--radius-large)] bg-[var(--card-bg)] transition-all; }
  .btn-plain { @apply transition flex items-center justify-center; }
  .btn-regular { @apply transition flex items-center justify-center; }
}

/* src/styles/animations.css */
.onload-animation { animation: fade-in-up .3s ease-out backwards; }
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/components/ui/__tests__/blogt3-theme-foundation.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/styles src/app/globals.css src/components/ui/__tests__/blogt3-theme-foundation.test.tsx
git commit -m "feat: add BlogT3 theme foundation styles"
```

### Task 2: Add Frontend Interaction Hooks and Hue State

**Files:**
- Create: `src/hooks/useScrollHide.ts`
- Create: `src/components/ui/HuePicker.tsx`
- Modify: `src/components/ThemeProvider.tsx`
- Modify: `src/components/ThemeToggle.tsx`
- Test: `src/components/ui/__tests__/hue-picker.test.tsx`

**Step 1: Write the failing test**

```tsx
import { fireEvent, render } from "@testing-library/react";
import { HuePicker } from "@/components/ui/HuePicker";

test("hue picker writes --hue to root and localStorage", () => {
  const { getByRole } = render(<HuePicker isOpen={true} />);
  fireEvent.change(getByRole("slider"), { target: { value: "210" } });
  expect(document.documentElement.style.getPropertyValue("--hue")).toBe("210");
  expect(localStorage.getItem("theme-hue")).toBe("210");
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/components/ui/__tests__/hue-picker.test.tsx`
Expected: FAIL because `HuePicker` and hue persistence are missing.

**Step 3: Write minimal implementation**

```tsx
// HuePicker core behavior
const onHueChange = (value: string) => {
  document.documentElement.style.setProperty("--hue", value);
  localStorage.setItem("theme-hue", value);
};
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/components/ui/__tests__/hue-picker.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/hooks/useScrollHide.ts src/components/ui/HuePicker.tsx src/components/ThemeProvider.tsx src/components/ThemeToggle.tsx src/components/ui/__tests__/hue-picker.test.tsx
git commit -m "feat: add hue picker and frontend interaction hooks"
```

### Task 3: Replace Header with BlogT3-Style Navbar

**Files:**
- Create: `src/components/layout/Navbar.tsx`
- Modify: `src/components/layout/AppShell.tsx`
- Modify: `src/components/layout/index.ts`
- Test: `src/components/layout/__tests__/navbar-behavior.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render } from "@testing-library/react";
import { Navbar } from "@/components/layout/Navbar";

test("navbar renders search/theme/hue actions", () => {
  const { getByLabelText } = render(<Navbar />);
  expect(getByLabelText("搜索")).toBeInTheDocument();
  expect(getByLabelText("主题色设置")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/components/layout/__tests__/navbar-behavior.test.tsx`
Expected: FAIL because `Navbar` does not exist.

**Step 3: Write minimal implementation**

```tsx
export function Navbar() {
  return (
    <div id="navbar" className="onload-animation sticky top-0 z-50">
      {/* logo, nav links, search, hue picker, theme toggle */}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/components/layout/__tests__/navbar-behavior.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/layout/Navbar.tsx src/components/layout/AppShell.tsx src/components/layout/index.ts src/components/layout/__tests__/navbar-behavior.test.tsx
git commit -m "feat: implement BlogT3-style frontend navbar"
```

### Task 4: Rebuild Sidebar and Footer to BlogT3 Public Style

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/Footer.tsx`
- Test: `src/components/layout/__tests__/public-chrome.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render } from "@testing-library/react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Footer } from "@/components/layout/Footer";

test("sidebar and footer use blogt3 card shell", () => {
  const { container } = render(<><Sidebar /><Footer /></>);
  expect(container.querySelectorAll(".card-base").length).toBeGreaterThan(0);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/components/layout/__tests__/public-chrome.test.tsx`
Expected: FAIL because current components still use legacy UI class contracts.

**Step 3: Write minimal implementation**

```tsx
// Sidebar/Footer should move to card-base, text-75, btn-plain, dashed separators.
<aside id="sidebar" className="onload-animation w-[17.5rem] shrink-0">...</aside>
<footer id="footer" className="onload-animation mt-auto">...</footer>
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/components/layout/__tests__/public-chrome.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/layout/Sidebar.tsx src/components/layout/Footer.tsx src/components/layout/__tests__/public-chrome.test.tsx
git commit -m "feat: migrate sidebar and footer to BlogT3 frontend style"
```

### Task 5: Rebuild Home and Posts Listing Surfaces

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/posts/page.tsx`
- Modify: `src/components/blog/PostCard.tsx`
- Create: `src/components/blog/PostMeta.tsx`
- Test: `src/app/__tests__/frontend-listing-style.test.tsx`

**Step 1: Write the failing test**

```tsx
import HomePage from "@/app/page";

test("home renders stagger list container and blogt3 card post items", async () => {
  const ui = await HomePage();
  expect(ui).toBeTruthy();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/app/__tests__/frontend-listing-style.test.tsx`
Expected: FAIL on missing listing structure assertions.

**Step 3: Write minimal implementation**

```tsx
<main className="stagger-children">
  {posts.map((post) => <PostCard key={post.id} post={post} />)}
</main>
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/app/__tests__/frontend-listing-style.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/page.tsx src/app/posts/page.tsx src/components/blog/PostCard.tsx src/components/blog/PostMeta.tsx src/app/__tests__/frontend-listing-style.test.tsx
git commit -m "feat: align home and listing UI with BlogT3"
```

### Task 6: Restyle Article Detail Experience to BlogT3 Tone

**Files:**
- Modify: `src/app/posts/[slug]/page.tsx`
- Modify: `src/components/blog/ArticleToc.tsx`
- Modify: `src/components/blog/ReadingProgress.tsx`
- Test: `src/app/posts/[slug]/__tests__/article-blogt3-style.test.tsx`

**Step 1: Write the failing test**

```tsx
import PostPage from "@/app/posts/[slug]/page";

test("article page includes toc/progress shell with blogt3 classes", async () => {
  const ui = await PostPage({ params: Promise.resolve({ slug: "demo" }) });
  expect(ui).toBeTruthy();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/app/posts/[slug]/__tests__/article-blogt3-style.test.tsx`
Expected: FAIL because article shell style contract is not yet migrated.

**Step 3: Write minimal implementation**

```tsx
<section className="card-base p-6 md:p-9">
  {/* article header + metadata + markdown + toc/progress integration */}
</section>
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/app/posts/[slug]/__tests__/article-blogt3-style.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/posts/[slug]/page.tsx src/components/blog/ArticleToc.tsx src/components/blog/ReadingProgress.tsx src/app/posts/[slug]/__tests__/article-blogt3-style.test.tsx
git commit -m "feat: migrate article detail UI to BlogT3 style"
```

### Task 7: Isolate Frontend Shell Without Affecting Admin/Author Surfaces

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/app/(public)/layout.tsx`
- Move: `src/app/page.tsx` -> `src/app/(public)/page.tsx`
- Move: `src/app/posts/page.tsx` -> `src/app/(public)/posts/page.tsx`
- Move: `src/app/posts/[slug]/page.tsx` -> `src/app/(public)/posts/[slug]/page.tsx`
- Move: `src/app/categories/page.tsx` -> `src/app/(public)/categories/page.tsx`
- Move: `src/app/categories/[slug]/page.tsx` -> `src/app/(public)/categories/[slug]/page.tsx`
- Move: `src/app/tags/page.tsx` -> `src/app/(public)/tags/page.tsx`
- Move: `src/app/tags/[slug]/page.tsx` -> `src/app/(public)/tags/[slug]/page.tsx`
- Move: `src/app/search/page.tsx` -> `src/app/(public)/search/page.tsx`
- Move: `src/app/bookmarks/page.tsx` -> `src/app/(public)/bookmarks/page.tsx`
- Test: `src/app/__tests__/frontend-route-group.test.tsx`

**Step 1: Write the failing test**

```tsx
import { AppShell } from "@/components/layout/AppShell";

test("public layout composes navbar + sidebar + footer", () => {
  expect(AppShell).toBeDefined();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/app/__tests__/frontend-route-group.test.tsx`
Expected: FAIL before route-group migration.

**Step 3: Write minimal implementation**

```tsx
// src/app/(public)/layout.tsx
import { AppShell } from "@/components/layout/AppShell";
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/app/__tests__/frontend-route-group.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/layout.tsx src/app/(public) src/app/__tests__/frontend-route-group.test.tsx
git commit -m "refactor: isolate BlogT3 shell to frontend route group"
```

### Task 8: Verify Frontend Regression and Document New UI Conventions

**Files:**
- Modify: `src/components/layout/__tests__/app-shell.test.tsx`
- Modify: `src/app/__tests__/home-reader-flow.test.tsx`
- Modify: `README.md`
- Modify: `TEST_REPORT.md`

**Step 1: Write the failing test**

```tsx
test("frontend shell keeps reduced-motion-safe class behavior", () => {
  document.documentElement.classList.add("dark");
  expect(document.documentElement.classList.contains("dark")).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/components/layout/__tests__/app-shell.test.tsx src/app/__tests__/home-reader-flow.test.tsx`
Expected: FAIL until tests are updated for new class/layout contracts.

**Step 3: Write minimal implementation**

```md
# README additions
- Frontend uses BlogT3-style tokens in `src/styles/*`.
- Public pages are isolated in `src/app/(public)`.
- Hue value persists via `localStorage` key `theme-hue`.
```

**Step 4: Run verification suite**

Run: `pnpm lint`
Expected: PASS.

Run: `pnpm test`
Expected: PASS.

Run: `pnpm build`
Expected: PASS.

Run: `pnpm test:e2e`
Expected: PASS for reader-facing flows.

**Step 5: Commit**

```bash
git add src/components/layout/__tests__/app-shell.test.tsx src/app/__tests__/home-reader-flow.test.tsx README.md TEST_REPORT.md
git commit -m "test: update frontend regression coverage for BlogT3 style migration"
```

## Execution Notes
- Apply `@superpowers/test-driven-development` for each task.
- Apply `@superpowers/verification-before-completion` before any completion claim.
- Keep commits task-scoped and avoid touching admin/author route behavior.
- If route-group migration introduces conflicts, split Task 7 into additional micro-tasks instead of broad edits.
