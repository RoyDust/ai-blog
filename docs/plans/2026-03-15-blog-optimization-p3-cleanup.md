# Blog Optimization P3 Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the remaining `P3` items from `docs/2026-03-14-blog-optimization-gap-analysis.md` by extracting a single app-shell provider wrapper and formalizing a durable analysis -> plan -> implementation document chain for the blog optimization workstream.

**Architecture:** Keep the runtime change intentionally small: preserve the existing provider order and behavior, but move the nested provider stack out of `src/app/layout.tsx` into a single `AppProviders` boundary. Then make the optimization artifacts easier to trace by adding a dedicated implementation record document and cross-linking the analysis, execution roadmap, and implementation record with a lightweight docs contract test.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, Markdown documentation

---

## Scope Notes

- This plan intentionally covers only the two unfinished `P3` items from `docs/2026-03-14-blog-optimization-gap-analysis.md`.
- Do not reopen any `P0-P2` performance, cache, security, or query-shape work in this plan.
- Follow `@superpowers:test-driven-development` while implementing each task.
- After each task, stop and verify before continuing.
- Prefer small commits that can be reverted independently.

## Acceptance Criteria

- `src/app/layout.tsx` delegates provider composition to a single `AppProviders` component while preserving the existing provider order and `Toaster` placement.
- The blog optimization workstream has an explicit document chain:
  - analysis: `docs/2026-03-14-blog-optimization-gap-analysis.md`
  - execution roadmap: `.sisyphus/plans/blog-optimization-roadmap.md`
  - implementation plan: `docs/plans/2026-03-15-blog-optimization-p3-cleanup.md`
  - implementation record: `docs/implementation/2026-03-15-blog-optimization-p3-implementation.md`
- Targeted verification passes for both the provider extraction and the documentation chain.
- `pnpm build` still succeeds after the provider refactor.

## Task Order

1. Extract `AppProviders` and lock the provider contract in tests.
2. Add the blog optimization implementation record and wire the document chain together.
3. Run final targeted verification for both P3 tasks.

---

### Task 1: Extract `AppProviders` from `RootLayout`

**Files:**
- Create: `src/components/AppProviders.tsx`
- Create: `src/components/__tests__/app-providers-contract.test.tsx`
- Modify: `src/app/layout.tsx`
- Review: `src/components/AuthProvider.tsx`
- Review: `src/components/ThemeProvider.tsx`
- Review: `src/components/motion/MotionProvider.tsx`
- Review: `src/components/ui/Toaster.tsx`

**Step 1: Write the failing provider contract test**

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("app providers contract", () => {
  test("root layout delegates provider wiring to AppProviders", () => {
    const layoutSource = readSource("src/app/layout.tsx");

    expect(layoutSource).toContain('import { AppProviders } from "@/components/AppProviders"');
    expect(layoutSource).toContain("<AppProviders>");
    expect(layoutSource).not.toContain("<AuthProvider>");
    expect(layoutSource).not.toContain("<ThemeProvider>");
    expect(layoutSource).not.toContain("<MotionProvider>");
  });

  test("AppProviders preserves provider order and toaster placement", () => {
    const providersSource = readSource("src/components/AppProviders.tsx");

    expect(providersSource).toContain("<AuthProvider>");
    expect(providersSource).toContain("<ThemeProvider>");
    expect(providersSource).toContain("<MotionProvider>");
    expect(providersSource).toContain("{children}");
    expect(providersSource).toContain("<Toaster />");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/components/__tests__/app-providers-contract.test.tsx`
Expected: FAIL because `src/components/AppProviders.tsx` does not exist yet and `src/app/layout.tsx` still nests providers inline.

**Step 3: Write the minimal implementation**

Create `src/components/AppProviders.tsx`:

```tsx
"use client";

import { AuthProvider } from "@/components/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { MotionProvider } from "@/components/motion";
import { Toaster } from "@/components/ui/Toaster";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <MotionProvider>
          {children}
          <Toaster />
        </MotionProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
```

Then update `src/app/layout.tsx` so the body becomes:

```tsx
<body className={`${alibabaPuHuiTi.variable} antialiased`}>
  <AppProviders>{children}</AppProviders>
</body>
```

Do not change metadata, fonts, HTML attributes, or provider order in this task.

**Step 4: Run tests to verify it passes**

Run: `pnpm exec vitest run src/components/__tests__/app-providers-contract.test.tsx`
Expected: PASS

Run: `pnpm build`
Expected: PASS with the app shell compiling successfully after the provider extraction.

**Step 5: Commit**

```bash
git add src/components/AppProviders.tsx src/components/__tests__/app-providers-contract.test.tsx src/app/layout.tsx
git commit -m "refactor(app): extract app providers wrapper"
```

---

### Task 2: Formalize the blog optimization document chain

**Files:**
- Create: `docs/implementation/2026-03-15-blog-optimization-p3-implementation.md`
- Create: `src/lib/__tests__/blog-optimization-docs-contract.test.ts`
- Modify: `docs/2026-03-14-blog-optimization-gap-analysis.md`
- Modify: `.sisyphus/plans/blog-optimization-roadmap.md`
- Review: `docs/plans/2026-03-15-blog-optimization-p3-cleanup.md`

**Step 1: Write the failing docs contract test**

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

function readDoc(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("blog optimization docs chain", () => {
  test("gap analysis links to roadmap and implementation record", () => {
    const source = readDoc("docs/2026-03-14-blog-optimization-gap-analysis.md");

    expect(source).toContain(".sisyphus/plans/blog-optimization-roadmap.md");
    expect(source).toContain("docs/implementation/2026-03-15-blog-optimization-p3-implementation.md");
  });

  test("roadmap links to analysis, plan, and implementation record", () => {
    const source = readDoc(".sisyphus/plans/blog-optimization-roadmap.md");

    expect(source).toContain("docs/2026-03-14-blog-optimization-gap-analysis.md");
    expect(source).toContain("docs/plans/2026-03-15-blog-optimization-p3-cleanup.md");
    expect(source).toContain("docs/implementation/2026-03-15-blog-optimization-p3-implementation.md");
  });

  test("implementation record starts with the standard execution sections", () => {
    const source = readDoc("docs/implementation/2026-03-15-blog-optimization-p3-implementation.md");

    expect(source).toContain("## Status Summary");
    expect(source).toContain("## Validation Record");
    expect(source).toContain("## Task Log");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/__tests__/blog-optimization-docs-contract.test.ts`
Expected: FAIL because the implementation record does not exist yet and the backlinks have not been added.

**Step 3: Write the minimal implementation**

Create `docs/implementation/2026-03-15-blog-optimization-p3-implementation.md` with this starter structure:

```md
# Blog Optimization P3 Implementation Record

**Related analysis:** `docs/2026-03-14-blog-optimization-gap-analysis.md`
**Related roadmap:** `.sisyphus/plans/blog-optimization-roadmap.md`
**Related plan:** `docs/plans/2026-03-15-blog-optimization-p3-cleanup.md`

## Status Summary

- [ ] Task 1: Extract `AppProviders`
- [ ] Task 2: Formalize the document chain
- [ ] Final verification

## Validation Record

### Run 1

- Date:
- Commands:
- Results:
- Notes:

## Task Log

### Task 1

- Files changed:
- Tests run:
- Notes:

### Task 2

- Files changed:
- Tests run:
- Notes:
```

Then update:

- `docs/2026-03-14-blog-optimization-gap-analysis.md` with a short `执行链路` or `相关文档` section linking forward to the roadmap and implementation record.
- `.sisyphus/plans/blog-optimization-roadmap.md` with an `Execution Artifacts` section linking the analysis document, this plan, and the implementation record.

Keep the wording short and factual. Do not rewrite the existing P0-P2 task content in the roadmap.

**Step 4: Run tests to verify it passes**

Run: `pnpm exec vitest run src/lib/__tests__/blog-optimization-docs-contract.test.ts`
Expected: PASS

Run: `rg --line-number "2026-03-15-blog-optimization-p3-cleanup|2026-03-15-blog-optimization-p3-implementation" docs .sisyphus/plans/blog-optimization-roadmap.md`
Expected: Multiple hits from the analysis doc, roadmap, plan, and implementation record.

**Step 5: Commit**

```bash
git add docs/implementation/2026-03-15-blog-optimization-p3-implementation.md src/lib/__tests__/blog-optimization-docs-contract.test.ts docs/2026-03-14-blog-optimization-gap-analysis.md .sisyphus/plans/blog-optimization-roadmap.md
git commit -m "docs(blog): formalize optimization execution chain"
```

---

### Task 3: Run final P3 verification

**Files:**
- Review only unless regressions are found

**Step 1: Run the targeted verification suite**

Run: `pnpm exec vitest run src/components/__tests__/app-providers-contract.test.tsx src/lib/__tests__/blog-optimization-docs-contract.test.ts`
Expected: PASS

**Step 2: Run build verification**

Run: `pnpm build`
Expected: PASS

**Step 3: Update the implementation record**

Mark completed items in `docs/implementation/2026-03-15-blog-optimization-p3-implementation.md`, add the final command outputs to `## Validation Record`, and summarize any residual follow-up items.

**Step 4: Commit**

```bash
git add docs/implementation/2026-03-15-blog-optimization-p3-implementation.md
git commit -m "docs(blog): record p3 cleanup verification"
```

---

## Final Verification Sequence

1. `pnpm exec vitest run src/components/__tests__/app-providers-contract.test.tsx src/lib/__tests__/blog-optimization-docs-contract.test.ts`
2. `pnpm build`
3. `rg --line-number "AppProviders|2026-03-15-blog-optimization-p3-implementation" src docs .sisyphus/plans/blog-optimization-roadmap.md`

Expected:

- targeted Vitest suites PASS
- production build PASSes
- source and documentation references show one clear provider boundary and one clear document chain

## Non-Goals

- No provider behavior changes beyond moving composition into `AppProviders`.
- No new runtime context, theme logic, auth logic, or motion behavior changes.
- No expansion of the roadmap back into unfinished `P0-P2` work.
- No new documentation system beyond the explicit links and implementation record required for this cleanup.
