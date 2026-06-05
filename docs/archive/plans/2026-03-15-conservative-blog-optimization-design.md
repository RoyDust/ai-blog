# Conservative Blog Optimization Integration Design

**Date:** 2026-03-15

**Goal:** Safely integrate the low-risk, high-value subset of the `blog-optimization-wave1` worktree into `main` without pulling in unrelated behavior changes.

## Scope

This integration intentionally keeps only the conservative subset:

- Cache invalidation normalization and deduplication in `src/lib/cache.ts`
- Shared public post query and pagination helpers in `src/lib/posts.ts`, `src/lib/taxonomy.ts`, and `src/lib/pagination.ts`
- Public page resilience improvements for home, post listing, category pages, and tag pages
- Tests that directly cover the above changes

This integration explicitly excludes:

- Search relevance and query-surface changes
- Auth secret helper changes
- Like-rate-limit actor changes
- Middleware/auth refactors
- `.sisyphus` evidence files and other process artifacts

## Approach

Create a fresh feature branch from `main` in an isolated worktree. Recreate the desired behavior in a controlled way by bringing over tests first, verifying they fail where behavior is new, then implementing the minimal production changes needed to satisfy those tests.

This keeps the PR reviewable and makes it possible to prove that every retained behavior is intentional. It also avoids mixing conservative improvements with higher-risk feature changes still sitting in the original worktree.

## Change Groups

### 1. Data and cache foundations

Introduce normalized path invalidation in the cache helper so blank and whitespace-only slugs do not generate bad invalidation paths. Consolidate public post query fragments and offset pagination metadata so listing and taxonomy surfaces use consistent ordering, select shapes, and pagination calculations.

### 2. Public page resilience

Improve public pages to surface partial data loading failures instead of silently presenting empty content. Add safe empty-state messaging for out-of-range taxonomy pagination so readers are guided back to a valid page instead of seeing an ambiguous blank list.

### 3. Verification

Add or extend unit and page-contract tests for cache normalization, public query helpers, taxonomy pagination, home-page failure alerts, and taxonomy out-of-range empty states. Run targeted tests during implementation and then run the full `pnpm test` suite before finalizing.

## Risks and Mitigations

- Risk: Query helper refactors can subtly change list payloads.
  Mitigation: keep public select shape compatible and cover with focused tests in `src/lib/__tests__/posts.test.ts`.
- Risk: Page resilience changes can alter expected rendering in existing tests.
  Mitigation: update only the tests directly tied to the new alerts and pagination behavior.
- Risk: Taxonomy pagination can introduce edge-case empty states.
  Mitigation: cover valid-page and out-of-range-page cases in taxonomy tests.

## Success Criteria

- The branch contains only the conservative subset of blog optimization changes.
- No excluded search/auth/like behavior changes are introduced.
- Targeted tests for new behavior pass.
- Full `pnpm test` passes on the integration branch.
- The branch is ready to open as a focused PR against `main`.
