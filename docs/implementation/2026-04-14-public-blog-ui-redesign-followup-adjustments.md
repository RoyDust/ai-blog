# Public Blog UI Redesign Follow-up Adjustment Implementation Record

**Related plan:** `docs/plans/2026-04-14-public-blog-ui-redesign-followup-adjustments.md`

## Status Summary

- [x] Task 1: Restore the desktop left rail
- [x] Task 2: Upgrade text-only post cards
- [x] Task 3: Rebuild homepage curated hierarchy
- [x] Final verification

## Validation Record

### Run 1

- Date: 2026-04-14
- Commands:
  - `pnpm install`
  - `pnpm exec vitest run src/components/layout/__tests__/app-shell.test.tsx`
  - `pnpm exec vitest run src/components/layout/__tests__/app-shell.test.tsx src/components/layout/__tests__/public-chrome.test.tsx`
- Results:
  - `pnpm install` passed
  - `app-shell.test.tsx` failed first as expected after test update
  - 2 layout tests passed after Task 1 implementation
- Notes:
  - Initial worktree lacked local `vitest`, so dependency install was required before red-green verification.

### Run 2

- Date: 2026-04-14
- Commands:
  - `pnpm exec vitest run src/components/blog/__tests__/PostCard.test.tsx src/app/__tests__/frontend-listing-style.test.tsx`
- Results:
  - `PostCard.test.tsx` failed first after the new text-only contract was added
  - 2 test files passed after Task 2 implementation
- Notes:
  - Task 2 added a dedicated text-only variant and removed blank media filler behavior.

### Run 3

- Date: 2026-04-14
- Commands:
  - `pnpm exec vitest run src/app/__tests__/home-reader-flow.test.tsx`
- Results:
  - `home-reader-flow.test.tsx` failed first after Task 3 expectations were updated
  - `home-reader-flow.test.tsx` passed after homepage curated hierarchy implementation
- Notes:
  - Task 3 split homepage into standalone intro row + curated featured grid + latest feed slicing from `posts[3..]`.

### Run 4

- Date: 2026-04-14
- Commands:
  - `pnpm exec vitest run src/components/layout/__tests__/app-shell.test.tsx src/components/layout/__tests__/public-chrome.test.tsx src/components/blog/__tests__/PostCard.test.tsx src/app/__tests__/frontend-listing-style.test.tsx src/app/__tests__/home-reader-flow.test.tsx`
  - `pnpm lint`
  - `pnpm exec prisma generate`
  - `pnpm build`
  - `pnpm start`
  - `Invoke-WebRequest http://127.0.0.1:3000/`
  - `Invoke-WebRequest http://127.0.0.1:3000/posts`
- Results:
  - 5 targeted test files passed, 9 tests passed
  - `pnpm lint` passed with existing warnings only
  - `pnpm build` passed after Prisma client generation
  - `/` and `/posts` both returned HTTP 200 in local smoke verification
- Notes:
  - `/posts` main listing copy is client-rendered, so route reachability rather than static text match was used for the smoke check.
  - `pnpm build` initially failed before `pnpm exec prisma generate`; this was an environment prerequisite issue in the worktree, not a follow-up UI regression.

## Task Log

### Task 1

- Status: Completed
- Files changed:
  - `src/components/layout/AppShell.tsx`
  - `src/components/layout/Sidebar.tsx`
  - `src/components/layout/__tests__/app-shell.test.tsx`
  - `src/styles/theme-variables.css`
- Tests run:
  - `pnpm exec vitest run src/components/layout/__tests__/app-shell.test.tsx`
  - `pnpm exec vitest run src/components/layout/__tests__/app-shell.test.tsx src/components/layout/__tests__/public-chrome.test.tsx`
- Notes:
  - Restored left-first desktop rail ordering without changing mobile single-column flow.
  - Landed in `0362452 feat(blog): restore left editorial rail`.

### Task 2

- Status: Completed
- Files changed:
  - `src/components/blog/PostCard.tsx`
  - `src/components/blog/__tests__/PostCard.test.tsx`
  - `src/styles/components.css`
  - `src/styles/theme-variables.css`
- Tests run:
  - `pnpm exec vitest run src/components/blog/__tests__/PostCard.test.tsx src/app/__tests__/frontend-listing-style.test.tsx`
- Notes:
  - Added a no-image editorial variant with text accent treatment and full-width content flow.
  - Landed in `eb389a6 feat(blog): refine text-only post cards`.

### Task 3

- Status: Completed
- Files changed:
  - `src/components/blog/HomeHero.tsx`
  - `src/components/blog/HomeFeaturedGrid.tsx`
  - `src/components/blog/HomeLatestPosts.tsx`
  - `src/components/blog/index.ts`
  - `src/app/(public)/page.tsx`
  - `src/app/__tests__/home-reader-flow.test.tsx`
- Tests run:
  - `pnpm exec vitest run src/app/__tests__/home-reader-flow.test.tsx`
- Notes:
  - Rebuilt homepage hierarchy so `HomeHero` only renders intro content, curated stories move into `HomeFeaturedGrid`, and latest posts start from `posts[3..]`.
  - Secondary curated posts now stack on mobile and switch to two columns at `md+` without rendering blank slots.

### Final Verification

- Status: Completed
- Commands:
  - `pnpm exec vitest run src/components/layout/__tests__/app-shell.test.tsx src/components/layout/__tests__/public-chrome.test.tsx src/components/blog/__tests__/PostCard.test.tsx src/app/__tests__/frontend-listing-style.test.tsx src/app/__tests__/home-reader-flow.test.tsx`
  - `pnpm lint`
  - `pnpm exec prisma generate`
  - `pnpm build`
  - `pnpm start`
  - `Invoke-WebRequest http://127.0.0.1:3000/`
  - `Invoke-WebRequest http://127.0.0.1:3000/posts`
- Results:
  - Targeted follow-up tests passed
  - Lint passed with existing warnings only
  - Production build passed
  - Local smoke verification returned 200 for homepage and posts listing
- Notes:
  - No additional code changes were needed after final verification.

## Execution Notes

- This record is for implementation progress only. Keep design discussion in the plan file.
- After each completed task, update both `## Status Summary` and the matching `## Task Log` block.
- Record every verification command exactly as run, including partial Vitest runs, `pnpm lint`, `pnpm build`, and any manual route checks.
- Leave unrelated workspace changes untouched while executing the follow-up editorial adjustment tasks.
