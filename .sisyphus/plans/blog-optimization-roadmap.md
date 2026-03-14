# Blog Optimization Roadmap

## Execution Artifacts
- Analysis: `docs/2026-03-14-blog-optimization-gap-analysis.md`
- P3 plan: `docs/plans/2026-03-15-blog-optimization-p3-cleanup.md`
- P3 implementation record: `docs/implementation/2026-03-15-blog-optimization-p3-implementation.md`

## TL;DR
> **Summary**: Convert the optimization analysis in `docs/2026-03-14-blog-optimization-gap-analysis.md` into a contract-first, multi-agent execution program covering P0-P2 only. Freeze shared contracts and file ownership first, then parallelize route-family and security work without allowing overlapping edits on shared chokepoints.
> **Deliverables**:
> - Shared execution contracts for error shape, cache invalidation, pagination, rate limiting, and CSP rollout
> - Public read-path optimization for listing/search and post detail
> - Public error-handling hardening
> - Cache invalidation refinement, admin pagination, taxonomy scalability
> - Security/auth/query consolidation needed for P0-P2 completion
> **Effort**: XL
> **Parallel**: YES - 5 waves
> **Critical Path**: Task 1 -> Task 2 -> Tasks 3/4/5 -> Tasks 6/7/8 -> Tasks 9/10/11 -> Final Verification

## Context
### Original Request
Turn the analysis document into a concrete TODO execution plan that supports multi-agent parallel development.

### Interview Summary
- Scope is explicitly limited to P0-P2 from `docs/2026-03-14-blog-optimization-gap-analysis.md`.
- The plan must support parallel execution, but executors must not make any judgment calls.
- The output must be a single plan file suitable for `/start-work`.

### Metis Review (gaps addressed)
- Freeze cross-cutting contracts before parallel work.
- Define single-owner boundaries by file surface, not just by theme.
- Prevent concurrent edits to `src/lib/posts.ts`, `src/lib/cache.ts`, and `src/lib/auth.ts`.
- Require rollback-safe acceptance criteria and task-local verification evidence.
- Decide edge-case behavior for invalid pagination params, empty search, unpublished content, cache invalidation after slug/category/tag changes, and rate-limit actor models.

## Work Objectives
### Core Objective
Produce and execute a zero-judgment optimization roadmap that improves public performance, public error handling, caching correctness, admin/taxonomy scalability, and security/auth foundations without allowing uncontrolled overlap between multiple agents.

### Deliverables
- A frozen shared-contract layer for P0-P2 implementation work.
- Public query/listing improvements for posts and search.
- Post detail load reduction with preserved route semantics.
- Public error behavior consistency across key public pages.
- Refined cache invalidation strategy for content mutations.
- Admin pagination and taxonomy scalability improvements.
- Security baseline improvements for CSP and rate limiting.
- Auth/query abstraction consolidation required by the new contracts.

### Definition of Done (verifiable conditions with commands)
- `pnpm test -- --run src/lib/__tests__/posts.test.ts src/app/api/search/__tests__/route.test.ts src/lib/__tests__/cache.test.ts src/lib/__tests__/security-headers.test.ts src/lib/__tests__/validation.test.ts src/__tests__/middleware.test.ts src/components/blog/__tests__/useInfinitePosts.test.tsx`
- `pnpm test`
- `pnpm build`
- `pnpm test:e2e`
- All changed tasks produce evidence under `.sisyphus/evidence/` with task-numbered artifacts.

### Must Have
- P0-P2 only; do not include P3 cleanup in this roadmap.
- One owner per shared file surface during any wave.
- Explicit contracts for error response shape, cache tags, pagination normalization, rate-limit key model, and CSP rollout mode.
- TDD-oriented task structure with baseline/gap-revealing tests before implementation.
- Rollback-safe, independently shippable tasks.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No broad refactors outside the named surfaces.
- No concurrent edits to the same shared helper in parallel tasks.
- No vague “optimize performance” tasks without explicit surfaces and proof signals.
- No manual-only verification or subjective acceptance.
- No expansion into observability platform work, Prisma schema redesign, or unrelated admin UX redesign unless explicitly required by the named tasks.

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification is agent-executed.
- Test decision: tests-after with focused characterization tests first, using existing Vitest + Playwright infrastructure.
- QA policy: Every task includes one happy path and one failure/edge path with concrete commands or test targets.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Cross-Cutting Contracts (freeze before leaf work)
These decisions are fixed for all executors in this roadmap:

1. **Public API error contract**
   - JSON error shape: `{ error: string }` for route handlers unless an existing touched route already returns `{ success: false, error: string }` and all consumers in the same task are updated together.
   - Internal exception details must never be exposed to public clients.
   - Page-level failures must use explicit failure UI, route error UI, or `notFound()`; never silently degrade to empty arrays when data fetch actually failed.

2. **Pagination contract**
   - Query params: `page`, `limit`
   - Defaults: page `1`, limit uses the route’s canonical listing constant
   - Invalid/negative page values normalize through shared validation logic.
   - Oversized limits must be clamped through shared validation logic.
   - Filtering changes reset pagination to page `1`.
   - Out-of-range pages must return an empty result set with valid pagination metadata, not a 500.

3. **Search/list contract**
   - Public listing excludes unpublished and soft-deleted content at the shared query-helper level.
   - Search default ordering: relevance first when an explicit relevance score exists, otherwise newest-first with deterministic tie-break on `createdAt` then `id` if needed in touched logic.
   - Blank search input must not trigger expensive broad search behavior; it must normalize to the route’s chosen empty-query contract within the touched surface.

4. **Cache invalidation contract**
   - Canonical path families: `/`, `/posts`, `/archives`, `/posts/{slug}`, `/categories/{slug}`, `/tags/{slug}`.
   - Invalidation triggers must explicitly handle: create, update, delete, publish, unpublish, slug change, category reassignment, tag add/remove.
   - If both old and new slugs/categories/tags exist during mutation, invalidate both old and new paths.
   - Comment, like, and bookmark actions are not expanded into global cache redesign unless the touched feature already depends on them.

5. **Rate-limit contract**
   - Actor model: hybrid. Prefer authenticated user identity when available; otherwise fall back to network/browser identifier model already used by the touched routes.
   - Rate-limit key format must be structured by scope first, then actor identity.
   - Separate scopes must remain distinct for auth, interaction, upload, and any new admin-sensitive actions added by this roadmap.

6. **CSP contract**
   - Scope for this roadmap: tighten existing policy without redesigning the whole asset pipeline.
   - Rollout mode: enforce policy in code, but only after the task inventories currently required origins already present in touched flows.
   - Login, theme, images, and approved third-party assets must remain functional after changes.

7. **Ownership rule**
   - No two parallel tasks may edit the same file in the same wave.
   - Shared chokepoints (`src/lib/posts.ts`, `src/lib/cache.ts`, `src/lib/auth.ts`, `src/lib/taxonomy.ts`, `src/app/(public)/posts/[slug]/page.tsx`) each have exactly one owning task per wave.

### File Collision Matrix
| File | Owning Task | Concurrent Edit Rule | Downstream Dependents |
|---|---|---|---|
| `src/lib/posts.ts` | Task 3, then Task 10 | No parallel edits while owner active | Tasks 7, 10 |
| `src/app/api/search/route.ts` | Task 3 | No parallel edits | Task 7 |
| `src/app/(public)/posts/[slug]/page.tsx` | Task 4, then Task 11 | No parallel edits while owner active | Task 11 |
| `src/lib/cache.ts` | Task 2, then Task 6 | No parallel edits while owner active | Task 6 |
| `src/lib/security-headers.ts` | Task 2 | No parallel edits | Final verification |
| `src/lib/rate-limit.ts` | Task 2 | No parallel edits | Task 9 |
| `src/lib/taxonomy.ts` | Task 8, then Task 10 | No parallel edits while owner active | Task 10 |
| `src/lib/auth.ts` | Task 9 | No parallel edits | Final verification |
| `middleware.ts` | Task 9 | No parallel edits | Final verification |

### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.

Wave 1: shared contracts + low-conflict foundation
- Task 1: Freeze contracts and characterization tests
- Task 2: Security baseline hardening foundation
- Task 5: Public error-handling migration

Wave 2: public performance leaf work
- Task 3: Listing/search query optimization
- Task 4: Post detail load reduction

Wave 3: scalability work on isolated surfaces
- Task 6: Cache invalidation refinement
- Task 7: Admin pagination normalization
- Task 8: Taxonomy scalability and pagination

Wave 4: integration/convergence wave
- Task 9: Auth and rate-limit consolidation
- Task 10: Shared Prisma query/select consolidation
- Task 11: Post-detail and static-generation convergence checks

Wave 5: final verification wave
- F1 through F4 parallel review agents

### Dependency Matrix (full, all tasks)
| Task | Depends On | Blocks |
|---|---|---|
| 1 | none | 3, 4, 5, 6, 7, 8, 9 |
| 2 | 1 | 9 |
| 3 | 1 | 6, 10 |
| 4 | 1 | 11 |
| 5 | 1 | final verification |
| 6 | 1, 3 | 10, 11, final verification |
| 7 | 1 | final verification |
| 8 | 1 | 10, final verification |
| 9 | 1, 2 | final verification |
| 10 | 3, 6, 8 | final verification |
| 11 | 4, 6 | final verification |

### Agent Dispatch Summary
| Wave | Task Count | Recommended Categories |
|---|---:|---|
| Wave 1 | 3 | deep, unspecified-high, quick |
| Wave 2 | 2 | deep, unspecified-high |
| Wave 3 | 3 | unspecified-high, quick |
| Wave 4 | 3 | unspecified-high, deep |
| Wave 5 | 4 | oracle, unspecified-high, deep |

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Freeze shared contracts and add characterization coverage

  **What to do**: Define the executable contract layer for this roadmap by updating or adding focused tests and shared helpers that lock public error behavior, pagination normalization, cache invalidation expectations, and rate-limit key assumptions before any leaf migration begins. This task owns the baseline test contracts only; it must not rewrite route behavior beyond what is necessary to establish shared expectations used by later tasks.
  **Must NOT do**: Do not optimize query logic, do not restructure post detail loading, do not change CSP yet, and do not introduce broad abstractions.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: This task defines contracts that all later waves depend on.
  - Skills: [`personal-writing-plans`] — Required to keep contract decisions explicit and exhaustive.
  - Omitted: [`personal-test-driven-development`] — Use existing project TDD habits inside the task, but do not expand scope into generic test refactors.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [2, 3, 4, 5, 6, 7, 8, 9] | Blocked By: []

  **References**:
  - Pattern: `src/lib/__tests__/validation.test.ts` — Shared normalization and invalid-input test style.
  - Pattern: `src/lib/__tests__/cache.test.ts` — Cache helper verification pattern.
  - Pattern: `src/lib/__tests__/security-headers.test.ts` — Header contract assertion style.
  - Pattern: `src/app/api/search/__tests__/route.test.ts` — API route error response testing.
  - Pattern: `src/__tests__/middleware.test.ts` — Middleware contract verification.
  - Source: `docs/2026-03-14-blog-optimization-gap-analysis.md` — Prioritized optimization scope.

  **Acceptance Criteria**:
  - [ ] Running `pnpm test -- --run src/lib/__tests__/validation.test.ts src/lib/__tests__/cache.test.ts src/lib/__tests__/security-headers.test.ts src/app/api/search/__tests__/route.test.ts src/__tests__/middleware.test.ts` passes with assertions covering the frozen contracts used by later tasks.
  - [ ] Contract tests explicitly cover invalid page/limit normalization, public error response shape, cache invalidation for old/new slug-like paths, and structured rate-limit scope behavior.

  **QA Scenarios**:
  ```
  Scenario: Contract baseline passes before leaf work starts
    Tool: Bash
    Steps: Run `pnpm test -- --run src/lib/__tests__/validation.test.ts src/lib/__tests__/cache.test.ts src/lib/__tests__/security-headers.test.ts src/app/api/search/__tests__/route.test.ts src/__tests__/middleware.test.ts`
    Expected: All targeted tests pass; output shows no failing contract assertions.
    Evidence: .sisyphus/evidence/task-1-contract-baseline.txt

  Scenario: Invalid pagination and error-shape edge cases are covered
    Tool: Bash
    Steps: Run the same command and verify the targeted test names/assertions include invalid page/limit and API error payload cases.
    Expected: Test output or test file diff demonstrates explicit edge-case coverage; no contract remains implicit.
    Evidence: .sisyphus/evidence/task-1-contract-edge.txt
  ```

  **Commit**: YES | Message: `test(contracts): freeze optimization execution contracts` | Files: [`src/lib/__tests__/validation.test.ts`, `src/lib/__tests__/cache.test.ts`, `src/lib/__tests__/security-headers.test.ts`, `src/app/api/search/__tests__/route.test.ts`, `src/__tests__/middleware.test.ts`]

- [x] 2. Harden security baseline for CSP and shared rate-limit foundations

  **What to do**: Tighten the existing security baseline by updating `src/lib/security-headers.ts` and `src/lib/rate-limit.ts` to match the frozen contracts. Inventory currently required sources in touched flows, preserve login/theme/image behavior, and introduce the structured hybrid actor model for rate-limit keys without migrating unrelated routes.
  **Must NOT do**: Do not refactor auth helpers, do not redesign all handler wrappers, and do not touch `src/lib/auth.ts` or `middleware.ts` in this task.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: Security-sensitive but bounded to two core helpers.
  - Skills: [`personal-writing-plans`] — Needed to avoid accidental surface expansion.
  - Omitted: [`personal-systematic-debugging`] — Use only if breakage appears during verification; do not make debugging the primary mode.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [9] | Blocked By: [1]

  **References**:
  - Pattern: `src/lib/security-headers.ts` — Existing CSP and header source of truth.
  - Pattern: `src/lib/rate-limit.ts` — Existing scope-based limiter layout.
  - Test: `src/lib/__tests__/security-headers.test.ts` — Security header assertions.
  - Test: `src/lib/__tests__/rate-limit.test.ts` — Rate-limit helper test pattern.
  - Test: `src/__tests__/middleware.test.ts` — Auth-adjacent route protection regression coverage.

  **Acceptance Criteria**:
  - [ ] `pnpm test -- --run src/lib/__tests__/security-headers.test.ts src/lib/__tests__/rate-limit.test.ts src/__tests__/middleware.test.ts` passes.
  - [ ] The updated CSP remains compatible with existing approved assets in touched public/auth flows.
  - [ ] Rate-limit helper tests prove structured scope behavior and hybrid actor fallback logic.

  **QA Scenarios**:
  ```
  Scenario: Security helper changes preserve test contracts
    Tool: Bash
    Steps: Run `pnpm test -- --run src/lib/__tests__/security-headers.test.ts src/lib/__tests__/rate-limit.test.ts src/__tests__/middleware.test.ts`
    Expected: All tests pass; middleware protections remain intact after helper changes.
    Evidence: .sisyphus/evidence/task-2-security-tests.txt

  Scenario: CSP tightening does not break approved auth/public surfaces
    Tool: Bash
    Steps: Run `pnpm build`
    Expected: Build succeeds with no CSP-related config/runtime compilation failures.
    Evidence: .sisyphus/evidence/task-2-security-build.txt
  ```

  **Commit**: YES | Message: `security(core): tighten csp and rate limit contracts` | Files: [`src/lib/security-headers.ts`, `src/lib/rate-limit.ts`, `src/lib/__tests__/security-headers.test.ts`, `src/lib/__tests__/rate-limit.test.ts`]

- [x] 3. Optimize public listing and search query surfaces

  **What to do**: Own `src/lib/posts.ts` and `src/app/api/search/route.ts`. Reduce heavy-field loading on public list/search surfaces, preserve the frozen pagination and error contracts, and keep public content filtering consistent at the shared helper level. If search ranking behavior is touched, keep it deterministic and constrained to the current route contract.
  **Must NOT do**: Do not modify taxonomy helpers, do not touch cache invalidation helpers, and do not attempt broad Prisma abstraction cleanup.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: This is the most important public data-path optimization and owns a shared query chokepoint.
  - Skills: [`personal-writing-plans`] — Needed to keep helper ownership and regression boundaries explicit.
  - Omitted: [`personal-systematic-debugging`] — Not primary unless query regressions appear during tests.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [6, 10] | Blocked By: [1]

  **References**:
  - Pattern: `src/lib/posts.ts:34-81` — Current listing query contract.
  - Pattern: `src/app/api/search/route.ts:66-123` — Current search route implementation.
  - Test: `src/lib/__tests__/posts.test.ts` — Listing query helper expectations.
  - Test: `src/app/api/search/__tests__/route.test.ts` — Search route contract and error testing.
  - Test: `src/components/blog/__tests__/useInfinitePosts.test.tsx` — Pagination/infinite-scroll client expectations.

  **Acceptance Criteria**:
  - [ ] `pnpm test -- --run src/lib/__tests__/posts.test.ts src/app/api/search/__tests__/route.test.ts src/components/blog/__tests__/useInfinitePosts.test.tsx` passes.
  - [ ] Listing/search tests prove that heavy content fields are not unnecessarily loaded on list/search surfaces in touched code paths.
  - [ ] Search and listing still normalize invalid pagination/search inputs according to the shared contract.

  **QA Scenarios**:
  ```
  Scenario: Public listing and search stay contract-compatible after optimization
    Tool: Bash
    Steps: Run `pnpm test -- --run src/lib/__tests__/posts.test.ts src/app/api/search/__tests__/route.test.ts src/components/blog/__tests__/useInfinitePosts.test.tsx`
    Expected: All tests pass; pagination metadata and error shape remain stable.
    Evidence: .sisyphus/evidence/task-3-query-tests.txt

  Scenario: Blank or invalid search inputs do not trigger broken behavior
    Tool: Bash
    Steps: Run `pnpm test -- --run src/app/api/search/__tests__/route.test.ts`
    Expected: Route tests cover blank query and invalid parameter cases with explicit status/response assertions.
    Evidence: .sisyphus/evidence/task-3-query-edge.txt
  ```

  **Commit**: YES | Message: `perf(public): optimize listing and search queries` | Files: [`src/lib/posts.ts`, `src/app/api/search/route.ts`, `src/lib/__tests__/posts.test.ts`, `src/app/api/search/__tests__/route.test.ts`, `src/components/blog/__tests__/useInfinitePosts.test.tsx`]

- [x] 4. Reduce post-detail route load without changing route semantics

  **What to do**: Own `src/app/(public)/posts/[slug]/page.tsx` and any tightly coupled tests for the duration of this task. Separate critical article rendering from secondary data where appropriate, preserve anonymous/unpublished behavior, and keep user-visible route semantics stable while reducing unnecessary request-time work.
  **Must NOT do**: Do not modify shared listing/search helpers, do not expand into taxonomy or admin routes, and do not perform cache invalidation redesign here.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: High-risk leaf route with multiple data sources and rendering concerns.
  - Skills: [`personal-writing-plans`] — Needed to preserve behavior while restructuring the load path.
  - Omitted: [`personal-systematic-debugging`] — Reserve only for regressions discovered during verification.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [11] | Blocked By: [1]

  **References**:
  - Pattern: `src/app/(public)/posts/[slug]/page.tsx:39-123` — Current data loading path.
  - Pattern: `src/app/(public)/posts/[slug]/page.tsx:279-328` — Markdown rendering and image handling path.
  - Test: `src/app/posts/[slug]/__tests__/article-experience.test.tsx` — Reader experience contract.
  - Test: `src/app/posts/[slug]/__tests__/article-metadata.test.tsx` — Metadata expectations.
  - Test: `src/app/posts/[slug]/__tests__/article-dark-markdown-contract.test.tsx` — Markdown rendering contract.
  - Test: `src/app/posts/[slug]/__tests__/article-blogt3-style.test.tsx` — Presentation regression coverage.

  **Acceptance Criteria**:
  - [ ] `pnpm test -- --run src/app/posts/[slug]/__tests__/article-experience.test.tsx src/app/posts/[slug]/__tests__/article-metadata.test.tsx src/app/posts/[slug]/__tests__/article-dark-markdown-contract.test.tsx src/app/posts/[slug]/__tests__/article-blogt3-style.test.tsx` passes.
  - [ ] Unpublished or missing posts still resolve according to the existing touched route contract.
  - [ ] Article page tests prove that markdown, metadata, and reader interactions remain intact after the load-path changes.

  **QA Scenarios**:
  ```
  Scenario: Article route keeps reader-facing behavior after load reduction
    Tool: Bash
    Steps: Run `pnpm test -- --run src/app/posts/[slug]/__tests__/article-experience.test.tsx src/app/posts/[slug]/__tests__/article-metadata.test.tsx src/app/posts/[slug]/__tests__/article-dark-markdown-contract.test.tsx src/app/posts/[slug]/__tests__/article-blogt3-style.test.tsx`
    Expected: All article route tests pass with no metadata/markdown regressions.
    Evidence: .sisyphus/evidence/task-4-article-tests.txt

  Scenario: Build remains valid after post-detail restructuring
    Tool: Bash
    Steps: Run `pnpm build`
    Expected: Build succeeds; route-level data loading changes do not introduce compile/runtime build errors.
    Evidence: .sisyphus/evidence/task-4-article-build.txt
  ```

  **Commit**: YES | Message: `perf(article): reduce post detail load path` | Files: [`src/app/(public)/posts/[slug]/page.tsx`, `src/app/posts/[slug]/__tests__/article-experience.test.tsx`, `src/app/posts/[slug]/__tests__/article-metadata.test.tsx`, `src/app/posts/[slug]/__tests__/article-dark-markdown-contract.test.tsx`, `src/app/posts/[slug]/__tests__/article-blogt3-style.test.tsx`]

- [x] 5. Replace silent public-page fallbacks with explicit failure behavior

  **What to do**: Own the public pages currently swallowing fetch failures and replace silent `catch -> []` behavior with explicit, contract-aligned failure handling. Preserve legitimate empty states where data is genuinely absent, but make true load failures observable and testable.
  **Must NOT do**: Do not redesign data fetching beyond failure handling, do not optimize query shape, and do not touch cache invalidation or security helpers.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: Multiple pages, low shared-helper risk, high UX/correctness value.
  - Skills: [`personal-writing-plans`] — Needed to keep page-level behavior explicit and limited.
  - Omitted: [`personal-systematic-debugging`] — Use only if route failure behavior becomes unclear during tests.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [final verification] | Blocked By: [1]

  **References**:
  - Pattern: `src/app/(public)/page.tsx:19-39` — Current homepage silent fallback.
  - Pattern: `src/app/(public)/posts/page.tsx:10-19` — Current posts listing fallback.
  - Pattern: `src/app/(public)/categories/page.tsx:15-18` — Current categories fallback.
  - Pattern: `src/app/(public)/tags/page.tsx:15-18` — Current tags fallback.
  - Test: `src/app/__tests__/home-reader-flow.test.tsx` — Homepage behavior coverage.
  - Test: `src/app/__tests__/frontend-listing-style.test.tsx` — Public listing route coverage.
  - Test: `src/app/__tests__/archives-page.test.tsx` — Public page regression style.

  **Acceptance Criteria**:
  - [ ] `pnpm test -- --run src/app/__tests__/home-reader-flow.test.tsx src/app/__tests__/frontend-listing-style.test.tsx src/app/__tests__/archives-page.test.tsx` passes.
  - [ ] Touched pages distinguish genuine empty content from load failure behavior in testable output.

  **QA Scenarios**:
  ```
  Scenario: Public pages keep valid empty states while exposing real load failures
    Tool: Bash
    Steps: Run `pnpm test -- --run src/app/__tests__/home-reader-flow.test.tsx src/app/__tests__/frontend-listing-style.test.tsx src/app/__tests__/archives-page.test.tsx`
    Expected: Tests pass; failure handling and empty-state behavior are both asserted in touched coverage.
    Evidence: .sisyphus/evidence/task-5-public-error-tests.txt

  Scenario: Public route group still builds after error-handling changes
    Tool: Bash
    Steps: Run `pnpm build`
    Expected: Build succeeds; page-level failure handling changes do not break route compilation.
    Evidence: .sisyphus/evidence/task-5-public-error-build.txt
  ```

  **Commit**: YES | Message: `fix(public): make page load failures explicit` | Files: [`src/app/(public)/page.tsx`, `src/app/(public)/posts/page.tsx`, `src/app/(public)/categories/page.tsx`, `src/app/(public)/tags/page.tsx`, `src/app/__tests__/home-reader-flow.test.tsx`, `src/app/__tests__/frontend-listing-style.test.tsx`]

- [x] 6. Refine cache invalidation rules for content mutations

  **What to do**: Own `src/lib/cache.ts` and the mutation paths that must call it in touched surfaces. Implement the frozen invalidation rules for create/update/delete/publish/unpublish/slug/category/tag transitions, including invalidating both old and new paths where necessary.
  **Must NOT do**: Do not redesign all route caching in the app, do not change public list/search query contracts here, and do not broaden into unrelated engagement cache strategy unless touched by required content flows.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: Shared infrastructure with clear mutation boundaries.
  - Skills: [`personal-writing-plans`] — Required to keep invalidation ordering explicit and exhaustive.
  - Omitted: [`personal-systematic-debugging`] — Use only if regression tests expose stale-path issues.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: [10, 11, final verification] | Blocked By: [1, 3]

  **References**:
  - Pattern: `src/lib/cache.ts:23-44` — Current invalidation helper.
  - Pattern: `src/app/api/posts/route.ts:71-77` — Current publish invalidation call site.
  - Pattern: related admin post mutation routes under `src/app/api/admin/posts/**` — Additional mutation surfaces to align if touched.
  - Test: `src/lib/__tests__/cache.test.ts` — Cache helper verification pattern.
  - Test: `src/lib/__tests__/validation.test.ts` — Shared normalization expectations where query params are involved.

  **Acceptance Criteria**:
  - [ ] `pnpm test -- --run src/lib/__tests__/cache.test.ts` passes with coverage for old/new slug and taxonomy path invalidation in touched helper logic.
  - [ ] Content mutation paths touched by this task invoke invalidation consistently with the frozen contract.

  **QA Scenarios**:
  ```
  Scenario: Cache helper invalidates the full required public path set
    Tool: Bash
    Steps: Run `pnpm test -- --run src/lib/__tests__/cache.test.ts`
    Expected: Tests pass and cover invalidation for current and previous slug/category/tag combinations.
    Evidence: .sisyphus/evidence/task-6-cache-tests.txt

  Scenario: Build stays valid after cache utility and mutation wiring changes
    Tool: Bash
    Steps: Run `pnpm build`
    Expected: Build succeeds with no invalid imports or route compilation errors from updated invalidation wiring.
    Evidence: .sisyphus/evidence/task-6-cache-build.txt
  ```

  **Commit**: YES | Message: `feat(cache): refine content invalidation rules` | Files: [`src/lib/cache.ts`, `src/app/api/posts/route.ts`, `src/app/api/admin/posts/route.ts`, `src/app/api/admin/posts/[id]/route.ts`, `src/app/api/admin/posts/publish/route.ts`, `src/lib/__tests__/cache.test.ts`]

- [x] 7. Add deterministic admin pagination and route-level bounds

  **What to do**: Own the admin posts/comments listing routes and their closest consumer expectations. Add explicit server-side pagination, preserve stable sorting, normalize invalid params through shared validation logic, and ensure filtered views reset to page 1 in touched flows.
  **Must NOT do**: Do not redesign admin UI beyond pagination behavior required for this task, and do not modify shared public query helpers.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: Bounded API/admin listing work with strong existing patterns.
  - Skills: [`personal-writing-plans`] — Needed to keep route contracts deterministic.
  - Omitted: [`personal-brainstorming`] — Scope is already fixed by contract.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: [final verification] | Blocked By: [1]

  **References**:
  - Pattern: `src/app/api/admin/posts/route.ts` — Current admin posts listing path.
  - Pattern: `src/app/api/admin/comments/route.ts` — Current admin comments listing path.
  - Test: `src/lib/__tests__/validation.test.ts` — Pagination clamping expectations.
  - Test: `src/app/api/admin/comments/__tests__/route.test.ts` — Admin route verification style.
  - Test: `src/app/admin/__tests__/comments-page.test.tsx` — Admin page behavior pattern.
  - Test: `src/app/admin/__tests__/page.test.tsx` — Admin dashboard regression pattern.

  **Acceptance Criteria**:
  - [ ] `pnpm test -- --run src/lib/__tests__/validation.test.ts src/app/api/admin/comments/__tests__/route.test.ts src/app/admin/__tests__/comments-page.test.tsx src/app/admin/__tests__/page.test.tsx` passes.
  - [ ] Admin routes touched by this task return deterministic pagination metadata for invalid, oversized, and out-of-range page inputs.

  **QA Scenarios**:
  ```
  Scenario: Admin pagination works with valid and invalid inputs
    Tool: Bash
    Steps: Run `pnpm test -- --run src/lib/__tests__/validation.test.ts src/app/api/admin/comments/__tests__/route.test.ts src/app/admin/__tests__/comments-page.test.tsx src/app/admin/__tests__/page.test.tsx`
    Expected: Tests pass; pagination bounds and stable ordering are asserted.
    Evidence: .sisyphus/evidence/task-7-admin-pagination-tests.txt

  Scenario: Admin routes remain build-safe after pagination changes
    Tool: Bash
    Steps: Run `pnpm build`
    Expected: Build succeeds; touched admin route/page wiring still compiles.
    Evidence: .sisyphus/evidence/task-7-admin-pagination-build.txt
  ```

  **Commit**: YES | Message: `feat(admin): add deterministic pagination contracts` | Files: [`src/app/api/admin/posts/route.ts`, `src/app/api/admin/comments/route.ts`, `src/app/admin/comments/page.tsx`, `src/app/admin/posts/page.tsx`, `src/app/api/admin/comments/__tests__/route.test.ts`, `src/app/admin/__tests__/comments-page.test.tsx`]

- [x] 8. Make taxonomy detail routes scalable and contract-aligned

  **What to do**: Own `src/lib/taxonomy.ts` plus taxonomy detail pages. Replace hardcoded detail-page limits with explicit pagination or incremental-loading behavior that follows the frozen pagination rules and preserves valid empty-state behavior.
  **Must NOT do**: Do not edit `src/lib/posts.ts`, do not perform shared query consolidation yet, and do not redesign taxonomy visual language beyond what is required by the new pagination behavior.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: Shared helper work with public route impact but bounded ownership.
  - Skills: [`personal-writing-plans`] — Needed to keep taxonomy semantics explicit.
  - Omitted: [`personal-brainstorming`] — Scope is already fixed.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: [10, final verification] | Blocked By: [1]

  **References**:
  - Pattern: `src/lib/taxonomy.ts` — Current taxonomy query behavior.
  - Pattern: `src/app/(public)/categories/[slug]/page.tsx` — Category detail route.
  - Pattern: `src/app/(public)/tags/[slug]/page.tsx` — Tag detail route.
  - Test: `src/app/__tests__/taxonomy-redirects.test.tsx` — Taxonomy route behavior pattern.
  - Test: `src/lib/__tests__/category-catalog.test.ts` — Category helper expectations.
  - Test: `src/lib/__tests__/tag-catalog.test.ts` — Tag helper expectations.

  **Acceptance Criteria**:
  - [ ] `pnpm test -- --run src/app/__tests__/taxonomy-redirects.test.tsx src/lib/__tests__/category-catalog.test.ts src/lib/__tests__/tag-catalog.test.ts` passes.
  - [ ] Touched taxonomy routes handle empty, single-page, and out-of-range pagination states without 500s.

  **QA Scenarios**:
  ```
  Scenario: Taxonomy routes scale without losing empty-state correctness
    Tool: Bash
    Steps: Run `pnpm test -- --run src/app/__tests__/taxonomy-redirects.test.tsx src/lib/__tests__/category-catalog.test.ts src/lib/__tests__/tag-catalog.test.ts`
    Expected: Tests pass and cover valid taxonomy route behavior after pagination/scalability changes.
    Evidence: .sisyphus/evidence/task-8-taxonomy-tests.txt

  Scenario: Taxonomy route compilation remains valid
    Tool: Bash
    Steps: Run `pnpm build`
    Expected: Build succeeds; touched taxonomy pages compile without route errors.
    Evidence: .sisyphus/evidence/task-8-taxonomy-build.txt
  ```

  **Commit**: YES | Message: `feat(taxonomy): add scalable detail pagination` | Files: [`src/lib/taxonomy.ts`, `src/app/(public)/categories/[slug]/page.tsx`, `src/app/(public)/tags/[slug]/page.tsx`, `src/lib/__tests__/category-catalog.test.ts`, `src/lib/__tests__/tag-catalog.test.ts`]

- [x] 9. Consolidate auth and rate-limit execution order on touched server surfaces

  **What to do**: Own `src/lib/auth.ts`, `middleware.ts`, and any newly introduced auth/rate-limit wrappers or helpers needed by this roadmap. Ensure touched server surfaces apply auth, permission, validation, and rate limiting in a consistent order matching the frozen contracts.
  **Must NOT do**: Do not migrate every route in the repository, do not redesign the entire auth architecture, and do not touch `src/lib/posts.ts` or taxonomy helpers.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: Shared auth/security surface with regression risk.
  - Skills: [`personal-writing-plans`] — Needed to keep consolidation bounded and explicit.
  - Omitted: [`personal-brainstorming`] — Do not reopen architecture choices already frozen by the plan.

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: [final verification] | Blocked By: [1, 2]

  **References**:
  - Pattern: `src/lib/auth.ts` — Existing NextAuth config.
  - Pattern: `middleware.ts` — Existing admin route enforcement.
  - Test: `src/__tests__/middleware.test.ts` — Middleware regression contract.
  - Test: `src/lib/__tests__/rate-limit.test.ts` — Rate-limit helper contract.
  - Test: `src/app/api/posts/[slug]/like/__tests__/route.test.ts` — Route auth/interaction testing style.

  **Acceptance Criteria**:
  - [ ] `pnpm test -- --run src/__tests__/middleware.test.ts src/lib/__tests__/rate-limit.test.ts src/app/api/posts/[slug]/like/__tests__/route.test.ts` passes.
  - [ ] Touched auth/rate-limit surfaces use one consistent ordering model for auth, permission, validation, and throttling.

  **QA Scenarios**:
  ```
  Scenario: Auth and rate-limit ordering remains correct after consolidation
    Tool: Bash
    Steps: Run `pnpm test -- --run src/__tests__/middleware.test.ts src/lib/__tests__/rate-limit.test.ts src/app/api/posts/[slug]/like/__tests__/route.test.ts`
    Expected: All tests pass; admin/interaction protection semantics remain intact.
    Evidence: .sisyphus/evidence/task-9-auth-tests.txt

  Scenario: Build remains valid after auth helper and middleware changes
    Tool: Bash
    Steps: Run `pnpm build`
    Expected: Build succeeds; middleware/auth imports resolve cleanly.
    Evidence: .sisyphus/evidence/task-9-auth-build.txt
  ```

  **Commit**: YES | Message: `refactor(auth): align auth and rate limit execution order` | Files: [`src/lib/auth.ts`, `middleware.ts`, `src/__tests__/middleware.test.ts`, `src/lib/__tests__/rate-limit.test.ts`, `src/app/api/posts/[slug]/like/__tests__/route.test.ts`]

- [x] 10. Consolidate shared public Prisma select and query shapes after migrations stabilize

  **What to do**: After Tasks 3, 6, and 8 land, own `src/lib/posts.ts` and `src/lib/taxonomy.ts` to consolidate duplicated public select/query structures required by the implemented roadmap. This is a convergence task, not a fresh optimization theme.
  **Must NOT do**: Do not reopen search behavior, do not change route semantics, and do not touch auth or middleware in this task.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: Shared-query consolidation after multiple upstream migrations.
  - Skills: [`personal-writing-plans`] — Needed to keep convergence scoped and non-disruptive.
  - Omitted: [`personal-brainstorming`] — This task is implementation convergence only.

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: [final verification] | Blocked By: [3, 6, 8]

  **References**:
  - Pattern: `src/lib/posts.ts` — Public listing query source.
  - Pattern: `src/lib/taxonomy.ts` — Taxonomy query source.
  - Test: `src/lib/__tests__/posts.test.ts` — Public post query contract.
  - Test: `src/lib/__tests__/category-catalog.test.ts` — Category query contract.
  - Test: `src/lib/__tests__/tag-catalog.test.ts` — Tag query contract.

  **Acceptance Criteria**:
  - [ ] `pnpm test -- --run src/lib/__tests__/posts.test.ts src/lib/__tests__/category-catalog.test.ts src/lib/__tests__/tag-catalog.test.ts` passes.
  - [ ] No duplicate public select/query shape remains within the touched `posts.ts` / `taxonomy.ts` surfaces that this roadmap directly required.

  **QA Scenarios**:
  ```
  Scenario: Shared public query helpers converge without regression
    Tool: Bash
    Steps: Run `pnpm test -- --run src/lib/__tests__/posts.test.ts src/lib/__tests__/category-catalog.test.ts src/lib/__tests__/tag-catalog.test.ts`
    Expected: All tests pass; consolidated helper behavior matches established route contracts.
    Evidence: .sisyphus/evidence/task-10-query-convergence-tests.txt

  Scenario: Build remains stable after helper consolidation
    Tool: Bash
    Steps: Run `pnpm build`
    Expected: Build succeeds with no helper import/type regressions.
    Evidence: .sisyphus/evidence/task-10-query-convergence-build.txt
  ```

  **Commit**: YES | Message: `refactor(data): consolidate shared public query shapes` | Files: [`src/lib/posts.ts`, `src/lib/taxonomy.ts`, `src/lib/__tests__/posts.test.ts`, `src/lib/__tests__/category-catalog.test.ts`, `src/lib/__tests__/tag-catalog.test.ts`]

- [x] 11. Converge post-detail and static generation behavior after cache work lands

  **What to do**: Revisit `src/app/(public)/posts/[slug]/page.tsx` after Tasks 4 and 6 to ensure static generation coverage, route semantics, and cache behavior remain coherent. Only adjust `generateStaticParams` or related route-level generation behavior if the convergence review shows it is required by the implemented roadmap.
  **Must NOT do**: Do not turn this into a new SEO initiative or broad route redesign.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: Final route convergence and guardrail task after heavier leaf work.
  - Skills: [`personal-writing-plans`] — Needed to keep this as a bounded convergence pass.
  - Omitted: [`personal-brainstorming`] — Scope is fixed.

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: [final verification] | Blocked By: [4, 6]

  **References**:
  - Pattern: `src/app/(public)/posts/[slug]/page.tsx:125-138` — Existing `generateStaticParams` behavior.
  - Test: `src/app/posts/[slug]/__tests__/article-metadata.test.tsx` — Route metadata/static behavior proxy.
  - Test: `src/lib/__tests__/cache.test.ts` — Cache helper expectations.

  **Acceptance Criteria**:
  - [ ] `pnpm test -- --run src/app/posts/[slug]/__tests__/article-metadata.test.tsx src/lib/__tests__/cache.test.ts` passes.
  - [ ] Route-level generation behavior remains internally consistent with the cache invalidation model implemented in this roadmap.

  **QA Scenarios**:
  ```
  Scenario: Post-detail convergence preserves route generation behavior
    Tool: Bash
    Steps: Run `pnpm test -- --run src/app/posts/[slug]/__tests__/article-metadata.test.tsx src/lib/__tests__/cache.test.ts`
    Expected: Tests pass; route generation/cache assumptions stay coherent.
    Evidence: .sisyphus/evidence/task-11-generation-convergence-tests.txt

  Scenario: Full application build succeeds after convergence changes
    Tool: Bash
    Steps: Run `pnpm build`
    Expected: Build succeeds; no static generation regression in the post route.
    Evidence: .sisyphus/evidence/task-11-generation-convergence-build.txt
  ```

  **Commit**: YES | Message: `fix(article): align generation with cache behavior` | Files: [`src/app/(public)/posts/[slug]/page.tsx`, `src/app/posts/[slug]/__tests__/article-metadata.test.tsx`, `src/lib/__tests__/cache.test.ts`]

## Final Verification Wave (4 parallel agents, ALL must APPROVE)
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy
- Create one commit per task; never combine two numbered tasks into one commit.
- For each task, prefer a test-first split if the implementation is large:
  - Commit A: characterization or failing/gap-revealing tests
  - Commit B: implementation satisfying the tests
  - Commit C: bounded cleanup only if required
- No mixed-surface commits across `posts.ts`, `taxonomy.ts`, `cache.ts`, `auth.ts`, or `posts/[slug]/page.tsx`.
- Every commit must revert cleanly without requiring changes from another active wave.

## Success Criteria
- Shared contracts are frozen before any parallel migration begins.
- No parallel task edits the same owned file surface in the same wave.
- P0-P2 work completes without uncontrolled overlap on `src/lib/posts.ts`, `src/lib/cache.ts`, `src/lib/auth.ts`, `src/lib/taxonomy.ts`, or `src/app/(public)/posts/[slug]/page.tsx`.
- Public read paths, admin pagination, taxonomy behavior, security headers, rate limiting, and cache invalidation all pass automated verification.
- The final integrated branch passes `pnpm test`, `pnpm build`, and `pnpm test:e2e`.
