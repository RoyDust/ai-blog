# Backend Remediation Multi-Agent Execution Plan

## TL;DR

> **Quick Summary**: This plan turns the backend remediation findings into a parallel execution program for multiple agents. It prioritizes authorization correctness, validation consistency, production-grade rate limiting, transaction safety, and backend hardening while minimizing cross-task overlap.
>
> **Deliverables**:
> - Corrected authorization model for post creation/publishing and admin guards
> - Unified validation layer across backend mutation routes
> - Shared production-ready rate limiting strategy for critical endpoints
> - Safer anonymous interaction identity handling and transaction-backed batch mutations
> - Follow-up automated tests and agent-executed verification for all changed areas
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 4 implementation waves + final verification wave
> **Critical Path**: Task 1 → Task 2 → Task 7 → Task 11 → Task 14

---

## Context

### Original Request
Create a multi-agent parallel execution document based on the backend remediation checklist for this Next.js blog backend.

### Interview Summary
**Key Discussions**:
- The work should be planning only; no implementation in this session.
- The plan must support multiple agents executing independent tasks in parallel.
- Test strategy is **tests-after**, not TDD.
- Output should be a full work plan under `.sisyphus/plans/*.md`.

**Research Findings**:
- Authorization drift exists between public post creation/publishing and admin-only backend expectations.
- Backend mutation validation is inconsistent across admin and account APIs.
- Current rate limiting is explicitly in-memory and only suitable for single-instance deployments.
- Anonymous interaction identity relies too heavily on client-provided browser identifiers.
- Several batch mutation flows lack transaction boundaries.
- Admin guard logic is duplicated and should be centralized.

### Metis Review
**Identified Gaps** (addressed in this plan):
- Guardrails added to prevent scope creep into full architecture rewrite or frontend redesign.
- Acceptance criteria strengthened to require route-level verification and explicit negative-path checks.
- Verification strategy clarified to combine tests-after with agent-executed API validation.

---

## Work Objectives

### Core Objective
Execute the backend remediation work in a way that allows multiple agents to operate safely in parallel while preserving clear boundaries, measurable verification, and minimal cross-task interference.

### Concrete Deliverables
- A corrected and explicitly defined authorization model for content creation, publishing, and admin APIs
- A consistent server-side validation layer for backend mutation routes
- A production-appropriate rate limiting design and implementation for critical backend endpoints
- Safer anonymous interaction identity handling for likes/comments or equivalent bounded fallback strategy
- Transaction-backed batch mutation flows for admin moderation and taxonomy/content cleanup operations
- Consolidated admin guard utilities, backend hardening cleanup, and regression coverage

### Definition of Done
- [ ] All targeted backend routes have clear and consistent authorization behavior
- [ ] All targeted mutation endpoints use explicit server-side validation rules
- [ ] Critical rate-limited endpoints no longer depend on process-local state alone
- [ ] Batch mutation flows identified in scope execute atomically or with explicit safe-failure handling
- [ ] Tests added after implementation cover the highest-risk backend behaviors
- [ ] Agent-executed QA scenarios pass for happy path and failure path behavior

### Must Have
- Authorization fixes for post creation/publishing and admin-only backend behavior
- Centralized validation coverage for risky mutation endpoints
- Shared-rate-limit approach for production-relevant endpoints
- Explicit agent wave structure with dependencies and verification

### Must NOT Have (Guardrails)
- No full backend rewrite or framework migration
- No redesign of unrelated frontend/admin UI beyond what verification minimally requires
- No replacement of NextAuth/Auth.js or Prisma unless strictly necessary for the scoped fixes
- No broad refactor of all route handlers outside the identified remediation scope
- No expansion into unrelated performance optimization, search improvements, or SEO changes

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — all verification must be agent-executed.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: Tests-after
- **Framework**: Existing project test stack (`pnpm test` plus route-focused targeted tests as added by executors)

### QA Policy
Every task includes agent-executed QA scenarios and, where appropriate, post-implementation automated tests.

- **API/Backend**: Use Bash with HTTP requests or route-level test commands
- **Auth / session behaviors**: Use API calls or existing test framework with mocked session states
- **Code-level validation behaviors**: Use focused automated tests and direct route assertions
- **Evidence path**: `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`

### Scope Guardrails for Verification
- Verify only the routes and backend concerns listed in this plan.
- Do not mark a task complete based only on static reading; each task must have executable evidence.
- Every task must include at least one happy path and one negative path.

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Start Immediately — foundation rules + shared building blocks):
├── Task 1: Authorization policy contract and route inventory [quick]
├── Task 2: Shared admin/session guard utility [quick]
├── Task 3: Validation schema expansion for backend mutations [quick]
├── Task 4: Shared rate-limit abstraction design + integration seam [deep]
├── Task 5: Anonymous interaction identity strategy [deep]
└── Task 6: Transaction boundary inventory for batch writes [quick]

Wave 2 (After Wave 1 — core backend remediations, max parallel):
├── Task 7: Fix post creation/publishing authorization flow (depends: 1, 2, 3) [deep]
├── Task 8: Refactor admin mutation routes onto shared validation/guard utilities (depends: 2, 3) [unspecified-high]
├── Task 9: Replace or adapt critical endpoint rate limits to shared-safe backend (depends: 4) [deep]
├── Task 10: Harden anonymous likes/comments identity handling (depends: 5, 3) [unspecified-high]
└── Task 11: Add transaction-backed admin batch mutation flows (depends: 6) [unspecified-high]

Wave 3 (After Wave 2 — secondary hardening and consistency):
├── Task 12: Harden profile/account update validation and error mapping (depends: 3, 8) [quick]
├── Task 13: Remove or permanently decommission set-admin HTTP path and related assumptions (depends: 1, 2) [quick]
├── Task 14: Unify backend error semantics for 401/403/400/conflict cases (depends: 7, 8, 11, 12) [unspecified-high]
└── Task 15: Add `/api/admin/*` protection fallback or equivalent guardrail tests (depends: 2, 8) [unspecified-high]

Wave 4 (After Wave 3 — tests-after + regression coverage):
├── Task 16: Authorization regression tests (depends: 7, 8, 14, 15) [deep]
├── Task 17: Validation and error-handling regression tests (depends: 8, 10, 12, 14) [quick]
├── Task 18: Rate-limit and identity regression tests (depends: 9, 10) [deep]
└── Task 19: Transaction/integrity regression tests (depends: 11, 14) [deep]

Wave FINAL (After ALL tasks — independent review, 4 parallel):
├── Task F1: Plan compliance audit [oracle]
├── Task F2: Backend code quality review [unspecified-high]
├── Task F3: Real API QA execution [unspecified-high]
└── Task F4: Scope fidelity check [deep]

### Dependency Matrix

- **1**: — → 7, 13
- **2**: — → 7, 8, 13, 15
- **3**: — → 7, 8, 10, 12
- **4**: — → 9
- **5**: — → 10
- **6**: — → 11
- **7**: 1, 2, 3 → 14, 16
- **8**: 2, 3 → 12, 14, 15, 16, 17
- **9**: 4 → 18
- **10**: 3, 5 → 17, 18
- **11**: 6 → 14, 19
- **12**: 3, 8 → 14, 17
- **13**: 1, 2 → —
- **14**: 7, 8, 11, 12 → 16, 17, 19
- **15**: 2, 8 → 16
- **16**: 7, 8, 14, 15 → FINAL
- **17**: 8, 10, 12, 14 → FINAL
- **18**: 9, 10 → FINAL
- **19**: 11, 14 → FINAL

### Agent Dispatch Summary

- **Wave 1**: T1 quick, T2 quick, T3 quick, T4 deep, T5 deep, T6 quick
- **Wave 2**: T7 deep, T8 unspecified-high, T9 deep, T10 unspecified-high, T11 unspecified-high
- **Wave 3**: T12 quick, T13 quick, T14 unspecified-high, T15 unspecified-high
- **Wave 4**: T16 deep, T17 quick, T18 deep, T19 deep
- **FINAL**: F1 oracle, F2 unspecified-high, F3 unspecified-high, F4 deep

---

## TODOs

- [ ] 1. Authorization policy contract and route inventory

  **What to do**:
  - Enumerate all scoped backend mutation routes and classify required permission level: public, authenticated, owner-or-admin, admin-only.
  - Convert the current remediation conclusions into an explicit route authorization contract that executors can implement against.
  - Lock the rule for whether non-admin users may create drafts, create unpublished posts only, or are fully blocked from post creation.

  **Must NOT do**:
  - Do not redesign unrelated product roles.
  - Do not expand into frontend permission UX changes.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Narrow inventory/documented policy task with low implementation complexity.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `git-master`: No git/history work needed.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 7, 13
  - **Blocked By**: None

  **References**:
  - `src/app/api/posts/route.ts` - Current public post creation behavior and use of client-provided `published` flag.
  - `src/app/api/posts/[slug]/route.ts` - Existing owner-or-admin mutation model for post update/delete.
  - `src/app/api/admin/posts/route.ts` - Current admin-only content management pattern.
  - `src/app/api/admin/comments/route.ts` - Admin-only moderation example.

  **Acceptance Criteria**:
  - [ ] Route authorization matrix exists in plan notes or implementation notes used by executors.
  - [ ] Every scoped route is classified with an expected permission model.

  **QA Scenarios**:
  ```
  Scenario: Authorization matrix complete
    Tool: Bash (test or verification script if added)
    Preconditions: Route inventory available from scoped files
    Steps:
      1. Cross-check scoped route files against the authorization matrix
      2. Verify no scoped mutation route is missing a permission category
    Expected Result: Every targeted route is covered exactly once
    Failure Indicators: Missing route, conflicting permission rule, or undocumented exception
    Evidence: .sisyphus/evidence/task-1-authorization-matrix.txt

  Scenario: Negative coverage check
    Tool: Bash
    Preconditions: Matrix drafted
    Steps:
      1. Check whether `/api/posts` create behavior is explicitly classified
      2. Check whether admin routes are explicitly classified as admin-only
    Expected Result: High-risk routes have explicit rules, not implied rules
    Evidence: .sisyphus/evidence/task-1-high-risk-route-check.txt
  ```

  **Commit**: NO

- [ ] 2. Shared admin/session guard utility

  **What to do**:
  - Define a shared backend guard utility for admin-only routes and, if needed, authenticated-user routes.
  - Replace duplicated admin guard logic in scoped admin endpoints with a consistent utility contract.
  - Standardize whether unauthorized vs forbidden should return 401 vs 403 across backend routes.

  **Must NOT do**:
  - Do not refactor unrelated public read routes.
  - Do not migrate auth libraries.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Focused consolidation of repeated route-guard logic.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `playwright`: No browser interaction needed for core implementation.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 7, 8, 13, 15
  - **Blocked By**: None

  **References**:
  - `src/app/api/admin/posts/route.ts` - Example duplicated `assertAdmin()` implementation.
  - `src/app/api/admin/comments/route.ts` - Another duplicated guard pattern to normalize.
  - `src/app/api/admin/categories/route.ts` - Admin guard usage in taxonomy mutation route.
  - `src/lib/auth.ts` - Session and role population into token/session.

  **Acceptance Criteria**:
  - [ ] Shared guard utility or equivalent shared pattern exists for scoped admin routes.
  - [ ] Scoped admin routes no longer each define bespoke admin guard logic.
  - [ ] 401/403 semantics are explicitly consistent in changed routes.

  **QA Scenarios**:
  ```
  Scenario: Admin route rejects unauthenticated caller
    Tool: Bash (curl)
    Preconditions: Dev server running; target admin API route available
    Steps:
      1. Send request to a scoped `/api/admin/*` mutation endpoint without session cookies
      2. Capture status code and JSON body
    Expected Result: Request is rejected with the configured unauthenticated response
    Failure Indicators: 200 response or inconsistent error format
    Evidence: .sisyphus/evidence/task-2-admin-no-session.txt

  Scenario: Non-admin caller rejected consistently
    Tool: Bash (curl)
    Preconditions: Non-admin authenticated session available
    Steps:
      1. Send request to a scoped admin mutation endpoint with non-admin session
      2. Capture status code and body
    Expected Result: Request is rejected with the configured forbidden response
    Evidence: .sisyphus/evidence/task-2-non-admin-forbidden.txt
  ```

  **Commit**: NO

- [ ] 3. Validation schema expansion for backend mutations

  **What to do**:
  - Extend the centralized validation layer to cover currently weak or inconsistent backend mutation payloads.
  - Add schemas/parsers for admin post patch/publish, admin category/tag create/update, profile update, and any scoped anonymous-interaction payloads.
  - Standardize trimming, length limits, format checks, enum checks, and optional field behavior.

  **Must NOT do**:
  - Do not introduce unrelated validation for out-of-scope frontend forms.
  - Do not silently change product behavior without documenting the rule.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Centralized input contract work, small surface area with high leverage.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `systematic-debugging`: This is planned hardening, not live bug reproduction.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 7, 8, 10, 12
  - **Blocked By**: None

  **References**:
  - `src/lib/validation.ts` - Existing parser style and reusable input handling patterns.
  - `src/app/api/admin/posts/[id]/route.ts` - Example mutation currently using raw body access.
  - `src/app/api/admin/categories/route.ts` - Example taxonomy mutation needing stronger validation.
  - `src/app/api/users/me/route.ts` - Weak account update validation target.

  **Acceptance Criteria**:
  - [ ] Centralized validation covers all scoped weak mutation endpoints.
  - [ ] Invalid payloads for these endpoints fail as 400-level validation errors.
  - [ ] Optional fields have explicit normalization rules.

  **QA Scenarios**:
  ```
  Scenario: Valid payload accepted through centralized validation
    Tool: Bash (test command or route verification)
    Preconditions: Validation helpers wired into scoped route
    Steps:
      1. Submit a known-valid payload to one scoped route
      2. Observe successful processing
    Expected Result: Valid payload passes without schema-related error
    Failure Indicators: Route rejects valid shaped input
    Evidence: .sisyphus/evidence/task-3-valid-payload.txt

  Scenario: Invalid payload rejected as validation error
    Tool: Bash (curl)
    Preconditions: Route updated to use centralized validation
    Steps:
      1. Submit malformed payload such as invalid email or invalid slug
      2. Capture status code and error body
    Expected Result: Route returns 400-style validation failure, not 500
    Evidence: .sisyphus/evidence/task-3-invalid-payload.txt
  ```

  **Commit**: NO

- [ ] 4. Shared rate-limit abstraction design plus integration seam

  **What to do**:
  - Define the replacement strategy for process-local rate limiting in scoped critical endpoints.
  - Create a shared interface so scoped routes can move off direct in-memory dependency.
  - Keep fallback behavior explicit if local development still needs in-memory support.

  **Must NOT do**:
  - Do not broaden this into a full infrastructure migration beyond scoped endpoints.
  - Do not leave the production path implicitly process-local.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: This is architectural hardening with deployment implications.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: No UI work involved.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 9
  - **Blocked By**: None

  **References**:
  - `src/lib/rate-limit.ts` - Current in-memory limiter implementation and scope-specific helper API.
  - `src/app/api/auth/register/route.ts` - Auth endpoint currently protected by local limiter.
  - `src/app/api/posts/[slug]/like/route.ts` - Interaction endpoint using the same local pattern.
  - External best-practice finding - Production deployments should use shared backend rate limiting, not per-process memory.

  **Acceptance Criteria**:
  - [ ] A shared-safe rate-limit abstraction is defined for scoped endpoints.
  - [ ] Development fallback behavior is explicit and separated from production behavior.

  **QA Scenarios**:
  ```
  Scenario: Scoped route uses shared limiter integration path
    Tool: Bash (test command or route-level assertion)
    Preconditions: Abstraction integrated into at least one scoped route
    Steps:
      1. Inspect or test configured limiter path for the route
      2. Verify it no longer depends solely on direct process-local calls in production path
    Expected Result: Route goes through shared limiter abstraction
    Failure Indicators: Direct local-only limiter remains the only path
    Evidence: .sisyphus/evidence/task-4-shared-rate-limit.txt

  Scenario: Negative path on rate-limit exhaustion
    Tool: Bash (curl loop or test)
    Preconditions: Limiter configured with deterministic threshold for test
    Steps:
      1. Trigger repeated requests past threshold
      2. Capture limiting response
    Expected Result: Endpoint rejects excess requests with clear 429 behavior
    Evidence: .sisyphus/evidence/task-4-rate-limit-exhausted.txt
  ```

  **Commit**: NO

- [ ] 5. Anonymous interaction identity strategy

  **What to do**:
  - Define the permitted trust model for anonymous likes and anonymous comment ownership signals.
  - Replace or bound direct trust in raw client-provided browser identifiers.
  - Ensure the resulting strategy still supports scoped anonymous interaction features without pretending to provide strong identity guarantees.

  **Must NOT do**:
  - Do not expand this into a full anti-abuse platform.
  - Do not redesign authenticated bookmark behavior.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: The task touches security assumptions, abuse resistance, and product behavior boundaries.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `playwright`: Route-level behavior matters more than browser automation here.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 10
  - **Blocked By**: None

  **References**:
  - `src/lib/browser-id.ts` - Current `x-browser-id` trust boundary.
  - `src/app/api/posts/[slug]/like/route.ts` - Anonymous like behavior and uniqueness assumptions.
  - `src/app/api/comments/route.ts` - Anonymous comment creation path and author labeling logic.
  - `prisma/schema.prisma` - Current nullable `authorId`, `browserId`, and interaction uniqueness constraints.

  **Acceptance Criteria**:
  - [ ] Anonymous identity strategy is explicitly defined and implementable.
  - [ ] Raw client-provided browser identifiers are either validated, bounded, or replaced with a safer server-controlled mechanism.
  - [ ] The plan for anonymous comment/like behavior is internally consistent.

  **QA Scenarios**:
  ```
  Scenario: Anonymous interaction uses bounded identity path
    Tool: Bash (curl)
    Preconditions: Updated identity strategy implemented for one scoped endpoint
    Steps:
      1. Perform anonymous interaction using the supported mechanism
      2. Capture resulting status and payload
    Expected Result: Interaction succeeds through the intended bounded identity path
    Failure Indicators: Route still blindly trusts arbitrary caller-provided identity without checks
    Evidence: .sisyphus/evidence/task-5-anon-identity-happy.txt

  Scenario: Invalid or spoofed anonymous identifier rejected or neutralized
    Tool: Bash (curl)
    Preconditions: Endpoint updated with validation/bounded identity handling
    Steps:
      1. Send request with malformed or spoofed identity input
      2. Observe resulting behavior
    Expected Result: Route rejects invalid input or treats it safely without granting trusted identity semantics
    Evidence: .sisyphus/evidence/task-5-anon-identity-negative.txt
  ```

  **Commit**: NO

- [ ] 6. Transaction boundary inventory for batch writes

  **What to do**:
  - Identify all scoped batch mutation flows that currently execute as multiple database writes without a transaction.
  - Document the atomicity requirements for each flow.
  - Provide the exact list of endpoints that must move to transaction-backed writes.

  **Must NOT do**:
  - Do not expand into every route in the repository.
  - Do not redesign unrelated data models.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Focused inventory task with clear output feeding later implementation.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `ultrabrain`: Not needed for this bounded inventory task.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 11
  - **Blocked By**: None

  **References**:
  - `src/app/api/admin/posts/route.ts` - Batch delete/hide flow spanning posts and comments.
  - `src/app/api/admin/categories/route.ts` - Category soft-delete plus post detachment.
  - `src/app/api/admin/comments/route.ts` - Moderation/delete flows affecting parent and replies.

  **Acceptance Criteria**:
  - [ ] All scoped multi-write batch flows are explicitly listed.
  - [ ] Each listed flow has an atomicity requirement documented.

  **QA Scenarios**:
  ```
  Scenario: Batch write inventory complete
    Tool: Bash or test note generation
    Preconditions: Scoped admin mutation routes reviewed
    Steps:
      1. Compare transaction inventory against scoped admin multi-write routes
      2. Verify no known multi-write flow is omitted
    Expected Result: Inventory covers every scoped batch mutation flow
    Failure Indicators: Missing endpoint or undocumented partial-failure risk
    Evidence: .sisyphus/evidence/task-6-transaction-inventory.txt

  Scenario: Negative atomicity check prepared
    Tool: Bash
    Preconditions: Inventory exists
    Steps:
      1. Verify each listed flow includes a stated partial-failure concern
      2. Verify each concern maps to a future transaction remediation
    Expected Result: Inventory is actionable, not just descriptive
    Evidence: .sisyphus/evidence/task-6-atomicity-negative-check.txt
  ```

  **Commit**: NO

- [ ] 7. Fix post creation and publishing authorization flow

  **What to do**:
  - Implement the authorization policy decided in Task 1 for `/api/posts` creation and related publish behavior.
  - Ensure non-admin users cannot bypass content governance by client-provided flags.
  - Align create, update, delete, and publish semantics across public post APIs and admin post APIs.

  **Must NOT do**:
  - Do not redesign the entire post lifecycle beyond scoped authorization corrections.
  - Do not alter unrelated read APIs.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Highest-risk access-control change with cross-route behavior implications.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `git-master`: No history work needed for execution.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 14, 16
  - **Blocked By**: 1, 2, 3

  **References**:
  - `src/app/api/posts/route.ts` - Current create behavior and direct use of `published` from input.
  - `src/app/api/posts/[slug]/route.ts` - Existing owner-or-admin mutation behavior.
  - `src/app/api/admin/posts/route.ts` - Admin create/delete expectations.
  - `src/app/api/admin/posts/publish/route.ts` - Dedicated admin publish toggle endpoint.

  **Acceptance Criteria**:
  - [ ] Non-admin callers cannot directly publish content unless explicitly allowed by the decided policy.
  - [ ] `/api/posts` create behavior matches the documented authorization contract.
  - [ ] Publish-related semantics are consistent across public and admin routes.

  **QA Scenarios**:
  ```
  Scenario: Admin can create/publish as intended
    Tool: Bash (curl)
    Preconditions: Admin session available
    Steps:
      1. Submit post creation payload including publish intent through the supported route
      2. Query resulting post state
    Expected Result: Admin path succeeds and final publish state matches policy
    Failure Indicators: Admin path blocked unexpectedly or publish state mismatched
    Evidence: .sisyphus/evidence/task-7-admin-post-publish.txt

  Scenario: Non-admin cannot bypass publish governance
    Tool: Bash (curl)
    Preconditions: Non-admin session available
    Steps:
      1. Submit post creation payload attempting to set publish state directly
      2. Query response and resulting state if created
    Expected Result: Request is blocked or coerced to allowed non-admin state per policy
    Evidence: .sisyphus/evidence/task-7-non-admin-publish-blocked.txt
  ```

  **Commit**: YES
  - Message: `fix(posts): align create and publish authorization`

- [ ] 8. Refactor admin mutation routes onto shared validation and guard utilities

  **What to do**:
  - Update scoped admin mutation routes to use the shared guard and validation layers from Tasks 2 and 3.
  - Remove per-route drift in auth checks and input parsing behavior.
  - Keep route-specific business logic only where needed.

  **Must NOT do**:
  - Do not refactor unrelated public GET routes.
  - Do not broaden into a generic route framework abstraction.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Multi-file backend consistency work with moderate risk.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: Not relevant to backend route refactoring.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 12, 14, 15, 16, 17
  - **Blocked By**: 2, 3

  **References**:
  - `src/app/api/admin/posts/[id]/route.ts` - Raw body mutation route to normalize.
  - `src/app/api/admin/categories/route.ts` - Taxonomy mutation route with hand-rolled validation.
  - `src/app/api/admin/tags/route.ts` - Same pattern for tag writes.
  - `src/app/api/admin/comments/route.ts` - Moderation route with custom body parsing.

  **Acceptance Criteria**:
  - [ ] Scoped admin mutation routes use shared guard logic.
  - [ ] Scoped admin mutation routes use centralized validation where applicable.
  - [ ] Behavior remains route-specific only for domain logic, not duplicated plumbing.

  **QA Scenarios**:
  ```
  Scenario: Admin mutation route accepts valid payload after refactor
    Tool: Bash (curl)
    Preconditions: Updated admin route and admin session available
    Steps:
      1. Send valid payload to one normalized admin route
      2. Capture response
    Expected Result: Route still performs domain action successfully
    Failure Indicators: Valid request fails due to regression in shared plumbing
    Evidence: .sisyphus/evidence/task-8-admin-valid-route.txt

  Scenario: Invalid admin payload fails consistently after refactor
    Tool: Bash (curl)
    Preconditions: Updated admin route available
    Steps:
      1. Send malformed payload to one normalized admin route
      2. Capture status and error body
    Expected Result: Route rejects invalid payload consistently with validation error
    Evidence: .sisyphus/evidence/task-8-admin-invalid-route.txt
  ```

  **Commit**: YES
  - Message: `refactor(api): unify admin guards and validation`

- [ ] 9. Replace or adapt critical endpoint rate limits to shared-safe backend

  **What to do**:
  - Implement the shared-safe rate limit approach selected in Task 4 for scoped critical endpoints.
  - Update auth and interaction routes in scope to use the new limiter path.
  - Preserve explicit local-development fallback if required.

  **Must NOT do**:
  - Do not attempt to rate-limit every endpoint in the application.
  - Do not keep production behavior functionally equivalent to per-process memory only.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Production infrastructure-sensitive hardening work.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `playwright`: API verification is sufficient.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 18
  - **Blocked By**: 4

  **References**:
  - `src/lib/rate-limit.ts` - Existing helper surface to adapt or replace.
  - `src/app/api/auth/register/route.ts` - Auth route currently rate limited.
  - `src/app/api/auth/login/route.ts` - Another auth-sensitive limiter target.
  - `src/app/api/posts/[slug]/like/route.ts` - Interaction limiter target.

  **Acceptance Criteria**:
  - [ ] Scoped critical endpoints use the shared-safe limiter path.
  - [ ] Production path no longer relies only on local process memory.
  - [ ] 429 behavior remains consistent for callers.

  **QA Scenarios**:
  ```
  Scenario: Critical endpoint still allows requests below threshold
    Tool: Bash (curl loop)
    Preconditions: Endpoint using new limiter path
    Steps:
      1. Send requests below threshold
      2. Capture responses
    Expected Result: Requests below threshold succeed normally
    Failure Indicators: Premature throttling or broken route behavior
    Evidence: .sisyphus/evidence/task-9-below-threshold.txt

  Scenario: Critical endpoint throttles above threshold
    Tool: Bash (curl loop)
    Preconditions: Endpoint using new limiter path
    Steps:
      1. Send requests above threshold
      2. Capture throttled response
    Expected Result: Excess requests receive clear 429 behavior
    Evidence: .sisyphus/evidence/task-9-above-threshold.txt
  ```

  **Commit**: YES
  - Message: `fix(rate-limit): use shared backend limiter`

- [ ] 10. Harden anonymous likes and comments identity handling

  **What to do**:
  - Implement the bounded anonymous identity strategy from Task 5 in scoped routes.
  - Ensure anonymous likes/comments no longer rely on unbounded trust in caller-provided identity.
  - Align route behavior with validation rules from Task 3.

  **Must NOT do**:
  - Do not remove the anonymous feature set unless explicitly required by the chosen strategy.
  - Do not redesign authenticated bookmarks.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Multi-route integrity hardening with product behavior sensitivity.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `ultrabrain`: The problem is scoped and concrete.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 17, 18
  - **Blocked By**: 3, 5

  **References**:
  - `src/lib/browser-id.ts` - Current identifier extraction path.
  - `src/app/api/posts/[slug]/like/route.ts` - Like toggling behavior.
  - `src/app/api/comments/route.ts` - Anonymous comment creation behavior.
  - `prisma/schema.prisma` - Data model constraints for likes and comments.

  **Acceptance Criteria**:
  - [ ] Scoped anonymous routes enforce the chosen bounded identity strategy.
  - [ ] Invalid identity input no longer behaves like trusted valid identity.
  - [ ] Anonymous interaction behavior remains internally consistent with product rules.

  **QA Scenarios**:
  ```
  Scenario: Valid anonymous interaction still works
    Tool: Bash (curl)
    Preconditions: Updated anonymous identity strategy implemented
    Steps:
      1. Perform anonymous like or comment through the supported path
      2. Capture result
    Expected Result: Supported anonymous action succeeds
    Failure Indicators: Legitimate anonymous path broken
    Evidence: .sisyphus/evidence/task-10-anon-valid.txt

  Scenario: Spoofed identity no longer grants trusted behavior
    Tool: Bash (curl)
    Preconditions: Updated route behavior
    Steps:
      1. Send malformed/spoofed identifier input
      2. Observe route behavior
    Expected Result: Input is rejected or safely neutralized
    Evidence: .sisyphus/evidence/task-10-anon-spoofed.txt
  ```

  **Commit**: YES
  - Message: `fix(interactions): harden anonymous identity handling`

- [ ] 11. Add transaction-backed admin batch mutation flows

  **What to do**:
  - Implement transaction-backed writes for the scoped multi-write admin flows identified in Task 6.
  - Ensure partial failure does not leave content, comments, or taxonomy relationships in split states.
  - Preserve existing domain behavior while improving atomicity.

  **Must NOT do**:
  - Do not expand transaction usage to unrelated simple single-write routes.
  - Do not redesign admin moderation features.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Multi-route data integrity work with moderate operational risk.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `git-master`: Not a git/history task.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 14, 19
  - **Blocked By**: 6

  **References**:
  - `src/app/api/admin/posts/route.ts` - Post/comment multi-write delete flow.
  - `src/app/api/admin/categories/route.ts` - Category soft-delete plus post detachment.
  - `src/app/api/admin/comments/route.ts` - Comment/reply multi-write moderation or delete flow.
  - `src/lib/prisma.ts` - Prisma client entry point.

  **Acceptance Criteria**:
  - [ ] Scoped batch mutation flows execute atomically or explicitly fail without partial persistence.
  - [ ] Transaction-backed behavior is used for each scoped multi-write operation.

  **QA Scenarios**:
  ```
  Scenario: Batch admin mutation succeeds atomically
    Tool: Bash (curl)
    Preconditions: Seeded data spanning multi-write operation
    Steps:
      1. Trigger scoped admin batch mutation
      2. Query related records after completion
    Expected Result: All related writes reflect the intended final state together
    Failure Indicators: One entity updates while dependent entity remains stale
    Evidence: .sisyphus/evidence/task-11-transaction-happy.txt

  Scenario: Failed batch mutation leaves no partial state
    Tool: Bash (test or controlled failure path)
    Preconditions: Controlled failure can be induced in a scoped batch flow
    Steps:
      1. Trigger mutation with a known failing condition
      2. Query related records afterward
    Expected Result: Either all writes roll back or safe-failure behavior is confirmed
    Evidence: .sisyphus/evidence/task-11-transaction-negative.txt
  ```

  **Commit**: YES
  - Message: `fix(admin): make batch mutations transactional`

- [ ] 12. Harden profile and account update validation plus error mapping

  **What to do**:
  - Update `/api/users/me` and any scoped account mutation paths to use stronger validation and predictable error mapping.
  - Normalize email/name handling and map known conflicts to stable client-visible responses.

  **Must NOT do**:
  - Do not expand into full account settings feature work.
  - Do not change authentication provider behavior.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small, high-confidence account-route hardening task.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `systematic-debugging`: No unknown defect investigation required.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 14, 17
  - **Blocked By**: 3, 8

  **References**:
  - `src/app/api/users/me/route.ts` - Current account update logic and email uniqueness check.
  - `src/lib/validation.ts` - Parser patterns to extend.
  - `src/app/api/auth/register/route.ts` - Existing stronger credential validation example.

  **Acceptance Criteria**:
  - [ ] Profile update route rejects invalid email/name payloads as validation errors.
  - [ ] Known email conflict path returns a stable non-500 response.

  **QA Scenarios**:
  ```
  Scenario: Valid profile update succeeds
    Tool: Bash (curl)
    Preconditions: Authenticated session available
    Steps:
      1. Send valid profile update payload
      2. Capture response body
    Expected Result: Profile update succeeds with normalized stored values
    Evidence: .sisyphus/evidence/task-12-profile-valid.txt

  Scenario: Invalid profile payload rejected
    Tool: Bash (curl)
    Preconditions: Authenticated session available
    Steps:
      1. Send malformed email or invalid name payload
      2. Capture status and error body
    Expected Result: Route returns validation error, not generic 500
    Evidence: .sisyphus/evidence/task-12-profile-invalid.txt
  ```

  **Commit**: YES
  - Message: `fix(account): validate profile updates consistently`

- [ ] 13. Remove or permanently decommission set-admin HTTP path

  **What to do**:
  - Ensure the legacy `set-admin` HTTP path cannot be mistaken for a supported admin bootstrap path.
  - Remove it or harden its decommissioning with explicit documentation/tests as needed.

  **Must NOT do**:
  - Do not introduce any new online admin-privilege bootstrap route.
  - Do not weaken the current README guidance.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Narrow cleanup/hardening task.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `writing`: This is primarily backend cleanup with minor documentation alignment.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: 1, 2

  **References**:
  - `src/app/api/admin/set-admin/route.ts` - Current disabled endpoint.
  - `README.md` - Existing guidance against HTTP admin initialization.

  **Acceptance Criteria**:
  - [ ] No supported HTTP path exists for admin bootstrap.
  - [ ] Repo guidance is consistent with the code reality.

  **QA Scenarios**:
  ```
  Scenario: Legacy admin bootstrap route unusable
    Tool: Bash (curl)
    Preconditions: Dev server running
    Steps:
      1. Send request to legacy set-admin route
      2. Capture response
    Expected Result: Route is absent or clearly unusable for privilege escalation
    Evidence: .sisyphus/evidence/task-13-set-admin-disabled.txt

  Scenario: Negative regression check
    Tool: Bash
    Preconditions: Route cleanup implemented
    Steps:
      1. Search changed backend files for any new admin bootstrap HTTP entrypoint
      2. Verify none exists
    Expected Result: No replacement online privilege-escalation path introduced
    Evidence: .sisyphus/evidence/task-13-no-bootstrap-route.txt
  ```

  **Commit**: YES
  - Message: `chore(admin): remove legacy bootstrap route`

- [ ] 14. Unify backend error semantics for auth, validation, and conflict cases

  **What to do**:
  - Normalize backend responses across scoped routes for unauthenticated, unauthorized, validation-failed, not-found, and conflict/error cases.
  - Replace generic 500s where a more precise, expected error category is known.

  **Must NOT do**:
  - Do not enforce a whole-app response contract outside scoped remediation routes.
  - Do not leak sensitive server internals in production responses.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Cross-cutting backend consistency work touching multiple routes.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `artistry`: Conventional backend hardening, not unconventional design work.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 16, 17, 19
  - **Blocked By**: 7, 8, 11, 12

  **References**:
  - `src/app/api/admin/posts/route.ts` - Example generic catch path.
  - `src/app/api/admin/posts/publish/route.ts` - Another generic mutation error path.
  - `src/app/api/users/me/route.ts` - Account update conflict handling.
  - `src/app/api/admin/categories/route.ts` and `src/app/api/admin/tags/route.ts` - Existing P2002 conflict handling examples.

  **Acceptance Criteria**:
  - [ ] Scoped routes distinguish expected client errors from internal server errors.
  - [ ] 401/403/400/conflict semantics are consistent in changed routes.
  - [ ] Known validation and conflict scenarios no longer collapse into generic 500s.

  **QA Scenarios**:
  ```
  Scenario: Known client error returns precise status
    Tool: Bash (curl)
    Preconditions: Scoped route updated with explicit error mapping
    Steps:
      1. Trigger known validation or conflict scenario
      2. Capture status and error body
    Expected Result: Route returns intended non-500 status with stable error shape
    Evidence: .sisyphus/evidence/task-14-precise-client-error.txt

  Scenario: Unexpected failure still handled safely
    Tool: Bash (test or controlled error path)
    Preconditions: Controlled unexpected failure path available
    Steps:
      1. Trigger unexpected error path
      2. Capture response
    Expected Result: Route returns safe server error without leaking internals
    Evidence: .sisyphus/evidence/task-14-safe-server-error.txt
  ```

  **Commit**: YES
  - Message: `refactor(api): normalize backend error semantics`

- [ ] 15. Add `/api/admin/*` protection fallback or equivalent guardrail tests

  **What to do**:
  - Add an extra protection layer for admin APIs via middleware coverage or, if implementation chooses not to, add explicit regression guardrail tests proving every scoped admin route is protected.
  - Ensure future admin route additions are less likely to bypass required checks.

  **Must NOT do**:
  - Do not rely only on informal convention.
  - Do not broaden middleware matching in a way that breaks unrelated public APIs.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Cross-route safety net work with behavioral risk if done carelessly.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `playwright`: API-level protection checks are the priority.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 16
  - **Blocked By**: 2, 8

  **References**:
  - `middleware.ts` - Current matcher only covering `/admin/*` pages.
  - `src/app/api/admin/posts/route.ts` - Admin API pattern to keep protected.
  - `src/app/api/admin/comments/route.ts` - Another representative admin API.

  **Acceptance Criteria**:
  - [ ] Scoped admin APIs have an explicit fallback protection strategy beyond duplicated route-local convention.
  - [ ] Regression proof exists that unauthenticated/non-admin callers are blocked from scoped admin APIs.

  **QA Scenarios**:
  ```
  Scenario: Admin API fallback protection works
    Tool: Bash (curl)
    Preconditions: Protection fallback or test harness implemented
    Steps:
      1. Request representative scoped admin API without admin privileges
      2. Capture response
    Expected Result: Access denied consistently
    Evidence: .sisyphus/evidence/task-15-admin-fallback-happy.txt

  Scenario: Negative coverage regression
    Tool: Bash (test command)
    Preconditions: Guardrail tests exist
    Steps:
      1. Run regression tests or route coverage check for scoped admin APIs
      2. Verify all targeted routes are covered
    Expected Result: No scoped admin route lacks protection evidence
    Evidence: .sisyphus/evidence/task-15-admin-coverage.txt
  ```

  **Commit**: YES
  - Message: `test(api): add admin protection guardrails`

- [ ] 16. Authorization regression tests

  **What to do**:
  - Add post-implementation automated tests covering authorization behavior for post creation/publishing and protected admin APIs.
  - Include unauthenticated, non-admin, owner, and admin paths where applicable.

  **Must NOT do**:
  - Do not write excessively broad end-to-end suites outside scoped authorization behavior.
  - Do not rely only on manual verification.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: High-risk regression coverage for access control.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `playwright`: Route-level automated tests are sufficient unless the executor determines otherwise.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: Final wave
  - **Blocked By**: 7, 8, 14, 15

  **References**:
  - `src/__tests__/middleware.test.ts` - Existing protection-oriented testing pattern.
  - Scoped route handlers changed in Tasks 7, 8, 14, and 15.

  **Acceptance Criteria**:
  - [ ] Automated tests cover representative authorization success and failure cases.
  - [ ] Tests fail if non-admin or unauthenticated callers regain forbidden access.

  **QA Scenarios**:
  ```
  Scenario: Authorization regression tests pass
    Tool: Bash
    Preconditions: New auth regression tests added
    Steps:
      1. Run targeted authorization test command
      2. Capture results
    Expected Result: All targeted authorization tests pass
    Evidence: .sisyphus/evidence/task-16-auth-tests.txt

  Scenario: Negative authorization case asserted
    Tool: Bash
    Preconditions: Test file includes denied-path assertions
    Steps:
      1. Inspect or run test covering unauthorized/non-admin path
      2. Confirm denial behavior is asserted
    Expected Result: Denied access paths are explicitly tested
    Evidence: .sisyphus/evidence/task-16-auth-negative.txt
  ```

  **Commit**: YES
  - Message: `test(auth): add backend authorization regressions`

- [ ] 17. Validation and error-handling regression tests

  **What to do**:
  - Add automated tests covering scoped validation and error-mapping behavior.
  - Assert invalid payloads become stable client errors rather than generic server failures.

  **Must NOT do**:
  - Do not expand tests to unrelated validation utilities outside scope.
  - Do not duplicate coverage already owned by Task 16 or 19.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Focused regression coverage on deterministic route behavior.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `ultrabrain`: Bounded testing task.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: Final wave
  - **Blocked By**: 8, 10, 12, 14

  **References**:
  - `src/lib/__tests__/validation.test.ts` - Existing validation test patterns.
  - Changed routes from Tasks 8, 10, 12, and 14.

  **Acceptance Criteria**:
  - [ ] Automated tests cover representative valid/invalid payloads for scoped routes.
  - [ ] Tests prove expected error categories no longer collapse into 500s.

  **QA Scenarios**:
  ```
  Scenario: Validation regression tests pass
    Tool: Bash
    Preconditions: Validation/error tests added
    Steps:
      1. Run targeted validation/error regression test command
      2. Capture results
    Expected Result: All scoped tests pass
    Evidence: .sisyphus/evidence/task-17-validation-tests.txt

  Scenario: Negative invalid-input assertion exists
    Tool: Bash
    Preconditions: Tests written
    Steps:
      1. Confirm test suite includes malformed payload case
      2. Verify expected status assertion
    Expected Result: Invalid input path is explicitly asserted
    Evidence: .sisyphus/evidence/task-17-validation-negative.txt
  ```

  **Commit**: YES
  - Message: `test(api): add validation and error regressions`

- [ ] 18. Rate-limit and anonymous identity regression tests

  **What to do**:
  - Add automated tests covering the new shared rate-limit behavior and bounded anonymous identity semantics.
  - Ensure abuse-prone paths retain intended behavior below threshold and reject/neutralize bad input above threshold or with spoofed identity.

  **Must NOT do**:
  - Do not build a large load-testing framework.
  - Do not test unrelated bookmark logic.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Mixed behavior/integrity coverage for high-abuse surfaces.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `playwright`: Direct backend tests are sufficient here.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: Final wave
  - **Blocked By**: 9, 10

  **References**:
  - `src/lib/__tests__/rate-limit.test.ts` - Existing rate-limit test pattern.
  - `src/lib/browser-id.ts` - Anonymous identity logic target.
  - `src/app/api/posts/[slug]/like/route.ts` and `src/app/api/comments/route.ts` - Abuse-sensitive route targets.

  **Acceptance Criteria**:
  - [ ] Tests cover below-threshold and above-threshold limiter behavior.
  - [ ] Tests cover valid and invalid anonymous identity input behavior.

  **QA Scenarios**:
  ```
  Scenario: Rate-limit and identity regression tests pass
    Tool: Bash
    Preconditions: New tests added
    Steps:
      1. Run targeted rate-limit/identity test command
      2. Capture results
    Expected Result: All scoped tests pass
    Evidence: .sisyphus/evidence/task-18-rate-limit-tests.txt

  Scenario: Negative spoof/over-limit behavior asserted
    Tool: Bash
    Preconditions: Tests written
    Steps:
      1. Confirm test suite includes spoofed identity or over-limit path
      2. Verify denial/neutralization assertion
    Expected Result: Abuse-sensitive negative paths are explicitly tested
    Evidence: .sisyphus/evidence/task-18-abuse-negative.txt
  ```

  **Commit**: YES
  - Message: `test(interactions): add limiter and identity regressions`

- [ ] 19. Transaction and integrity regression tests

  **What to do**:
  - Add automated tests proving scoped transactional batch mutations do not leave partial state.
  - Cover success and safe-failure cases for admin batch operations.

  **Must NOT do**:
  - Do not attempt full database chaos testing.
  - Do not expand to unrelated single-write routes.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Data integrity regression coverage for multi-write admin workflows.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: Not relevant.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: Final wave
  - **Blocked By**: 11, 14

  **References**:
  - Changed admin batch mutation flows from Task 11.
  - `src/app/api/admin/posts/route.ts`, `src/app/api/admin/categories/route.ts`, `src/app/api/admin/comments/route.ts` - Transaction-sensitive route targets.

  **Acceptance Criteria**:
  - [ ] Automated tests cover successful atomic multi-write operations.
  - [ ] Automated tests cover failure conditions without partial persistence.

  **QA Scenarios**:
  ```
  Scenario: Transaction integrity tests pass
    Tool: Bash
    Preconditions: Integrity regression tests added
    Steps:
      1. Run targeted transaction/integrity test command
      2. Capture results
    Expected Result: All scoped tests pass
    Evidence: .sisyphus/evidence/task-19-transaction-tests.txt

  Scenario: Negative partial-write case asserted
    Tool: Bash
    Preconditions: Tests written for failure path
    Steps:
      1. Confirm test suite includes induced failure or rollback assertion
      2. Verify no-partial-state expectation
    Expected Result: Partial persistence risk is explicitly tested against
    Evidence: .sisyphus/evidence/task-19-partial-write-negative.txt
  ```

  **Commit**: YES
  - Message: `test(admin): add transaction integrity regressions`

---

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Verify that implemented changes match plan scope: authorization, validation, rate limiting, identity handling, transaction safety, and cleanup items. Reject any scope creep or missed must-have items.

- [ ] F2. **Backend Code Quality Review** — `unspecified-high`
  Run project checks, inspect changed backend files, and reject weak error swallowing, duplicated guard logic that should have been removed, unsafe assumptions, or untested risky branches.

- [ ] F3. **Real API QA Execution** — `unspecified-high`
  Execute the QA scenarios from all tasks using route-level verification. Save evidence for both happy-path and negative-path behavior.

- [ ] F4. **Scope Fidelity Check** — `deep`
  Compare implemented changes against plan intent. Reject unrelated refactors, missed route coverage, or accidental behavior changes outside scoped backend remediation.

---

## Commit Strategy

- Group by execution wave where practical; avoid mixing unrelated backend concerns in the same commit.
- Prefer one commit per independent task or tightly related task pair.
- Ensure test additions land with the corresponding behavior changes they validate.

---

## Success Criteria

### Verification Commands
```bash
pnpm test
pnpm lint
```

### Final Checklist
- [ ] Authorization model is consistent across post creation/publishing and admin routes
- [ ] Backend mutation validation is centralized or uniformly applied in scoped routes
- [ ] Rate limiting is no longer process-local for scoped critical endpoints
- [ ] Anonymous interaction identity handling is explicitly bounded and verified
- [ ] Batch mutation flows are transaction-safe or explicitly protected against partial failure
- [ ] Final verification wave approves the work without critical scope drift
