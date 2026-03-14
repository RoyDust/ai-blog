
- Task 1 froze contract expectations primarily through focused characterization tests instead of helper changes.
- Pagination normalization is now explicitly pinned to current shared helper behavior: invalid/non-numeric page -> 1, invalid/non-numeric limit -> 10, negative limit -> 1, oversized limit -> 50.
- Public cache invalidation expectations are pinned to canonical list paths plus both old/new post, category, and tag slug-like paths with deduped revalidation order preserved by current helper behavior.
- Search route public error responses are pinned to `{ error: string }` for both validation and internal-failure cases.
- Structured rate-limit assumptions are currently frozen at `scope:actor` with actor derived from the first forwarded IP or `anonymous` fallback.
