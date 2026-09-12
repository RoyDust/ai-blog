# /posts Performance Optimization Implementation Plan

Date: 2026-03-11
Status: In progress
Scope: `/posts` listing performance only

Execution note: This document is implementation-agnostic. It should remain useful whether the work is executed in the current session, a separate session, or by a different contributor.

**Goal:** Improve the perceived and actual performance of the `/posts` listing route by reducing server blocking, lowering client hydration cost, and giving users immediate visual feedback during loading.

**Architecture:** Convert `/posts` into a static outer shell that renders quickly, then let the client fetch listing data and manage filtering transitions with skeleton placeholders. Keep the feed paginated, but use an `IntersectionObserver` sentinel instead of a scroll listener to reduce work on the main thread. Preserve the existing `/api/posts` contract while tightening the listing payload.

**Tech Stack:** Next.js 16 App Router, React 19, Prisma, Vitest, `next/image`, `next/font/local`

---

## Status Summary

- [x] Root-cause analysis completed for `/posts` route lag
- [x] Listing payload trimmed to exclude large `content` field
- [x] Immediate auto-fetch-on-mount regression removed
- [x] Google Fonts dependency replaced with local Alibaba PuHuiTi setup
- [x] `/posts` converted to static shell with skeleton fallback
- [x] Filter/search transitions now re-enter loading skeleton state
- [x] Infinite loading moved from scroll listener to `IntersectionObserver`
- [x] Reduce list animation cost during initial reveal and filter transitions
- [x] Tighten card image loading strategy and remote image behavior
- [x] Run broader lint/perf validation pass beyond targeted tests/build

---

## Acceptance Criteria

The plan is considered complete only when all of the following are true:

- `/posts` continues to render as a static outer shell in the production build output.
- The listing route no longer blocks first render on the server for first-page feed data.
- First load shows a stable skeleton or placeholder state instead of an empty flash.
- Search and filter changes return the list to a loading placeholder state before fresh data appears.
- Infinite pagination is triggered by an `IntersectionObserver` sentinel rather than a window scroll listener.
- The initial client load does not automatically fetch page 2 before the sentinel is intersected.
- Listing payloads exclude large article body fields that are not required for card rendering.
- Card image behavior preserves layout stability across major breakpoints and does not visibly regress perceived load completion.
- Reduced-motion behavior remains respected for list transitions and loading-state changes.
- Verification evidence is recorded for targeted tests, production build, and lint status.

---

## Quantitative Targets

These targets define success criteria for the remaining work. If a target cannot be met, the validation record should note the reason and the observed result.

| Area | Target | Measurement Method |
| --- | --- | --- |
| Static rendering | `/posts` remains statically emitted in the production build output | `npm.cmd run build` output review |
| Initial API activity | At most 1 listing request is triggered on first mount before user interaction | Browser network panel or targeted hook test |
| Eager pagination | 0 automatic page-2 requests before sentinel intersection | Regression test for `useInfinitePosts` or browser network panel |
| Filter transition feedback | Skeleton state reappears within the same interaction cycle when query/filter changes | Component test plus manual verification |
| Animation fan-out | Staggered reveal is limited to a small fixed subset of cards on initial reveal, target `<= 4` cards | DOM assertion or class-level test |
| Motion accessibility | Non-essential list transition motion is disabled under reduced-motion preferences | Manual QA or targeted test |
| Image stability | 0 obvious card-media layout shift during manual QA on mobile and desktop breakpoints | Manual QA with responsive viewport checks |
| Verification coverage | Latest targeted tests, `build`, and `lint` each complete with recorded status | Command output log in validation record |

---

## Validation Record Template

Use this template for each meaningful verification pass so later readers can distinguish planned work from confirmed results.

```md
### Validation Run

- Date:
- Commit / working tree state:
- Environment: local dev / production build / preview
- Scope checked:

#### Commands
- `npm.cmd test -- ...`
- `npm.cmd run build`
- `npm.cmd run lint`

#### Results
- Tests:
- Build:
- Lint:

#### Manual QA
- `/posts` static shell confirmed:
- Initial skeleton behavior confirmed:
- Filter/search loading feedback confirmed:
- No eager page-2 request confirmed:
- Image stability checked at mobile/desktop breakpoints:
- Reduced-motion behavior checked:

#### Notes
- Regressions found:
- Follow-up actions:
```

---

### Task 1: Diagnose `/posts` route bottlenecks

**Status:** [x] Completed

**Files:**
- Reviewed: `src/app/(public)/posts/page.tsx`
- Reviewed: `src/lib/posts.ts`
- Reviewed: `src/components/blog/PostsListingClient.tsx`
- Reviewed: `src/components/blog/useInfinitePosts.ts`
- Reviewed: `src/components/blog/PostCard.tsx`

**Completed work:**
- Identified server-blocking first render on `/posts`
- Confirmed listing query was over-fetching `Post.content`
- Confirmed previous infinite loading behavior could eagerly fetch extra pages

**Verification evidence:**
- Manual code-path inspection and follow-up regression tests added in later tasks

---

### Task 2: Trim listing payload and stop eager pagination

**Status:** [x] Completed

**Files:**
- Modified: `src/lib/posts.ts`
- Modified: `src/components/blog/useInfinitePosts.ts`
- Test: `src/lib/__tests__/posts.test.ts`
- Test: `src/components/blog/__tests__/useInfinitePosts.test.tsx`

**Completed work:**
- Replaced broad `include` listing query with a lightweight `select`
- Removed the eager "load next page immediately on mount" behavior
- Added regression coverage for both changes

**Verification evidence:**
- Targeted Vitest regression tests passed

---

### Task 3: Replace external fonts with local assets

**Status:** [x] Completed

**Files:**
- Added: `src/app/fonts.ts`
- Modified: `src/app/layout.tsx`
- Modified: `src/app/globals.css`
- Asset source: `public/font/AlibabaPuHuiTi-3-65-Medium.woff2`
- Asset source: `public/font/AlibabaPuHuiTi-3-65-Medium.woff`

**Completed work:**
- Removed `next/font/google` dependency from the app shell
- Switched the site to local Alibaba PuHuiTi assets with fallback font stack
- Restored successful offline production builds

**Verification evidence:**
- `npm.cmd run build` passed after migration

---

### Task 4: Convert `/posts` to static shell + skeleton-first loading

**Status:** [x] Completed

**Files:**
- Modified: `src/app/(public)/posts/page.tsx`
- Added: `src/components/blog/PostCardSkeleton.tsx`
- Modified: `src/components/blog/PostsListingClient.tsx`
- Modified: `src/components/blog/useInfinitePosts.ts`
- Modified: `src/components/blog/HomeLatestPosts.tsx`
- Test: `src/components/blog/__tests__/PostsListingClient.test.tsx`
- Test: `src/components/blog/__tests__/useInfinitePosts.test.tsx`

**Completed work:**
- Changed `/posts` to render a static shell with a `Suspense` skeleton fallback
- Moved first-page listing fetch to the client
- Replaced empty-state flash with card skeletons for initial load and filter changes
- Swapped infinite scroll event handling for an `IntersectionObserver` sentinel
- Updated homepage latest-post pagination to the same sentinel model

**Verification evidence:**
- `npm.cmd test -- src/components/blog/__tests__/PostsListingClient.test.tsx src/components/blog/__tests__/useInfinitePosts.test.tsx`
- `npm.cmd run build`

---

### Task 5: Reduce animation overhead on list transitions

**Status:** [x] Completed

**Files:**
- Modify: `src/components/blog/PostsListingClient.tsx`
- Modify: `src/components/blog/HomeLatestPosts.tsx`
- Modify: `src/styles/animations.css`
- Test: `src/components/blog/__tests__/PostsListingClient.test.tsx`

**Completed work:**
- Added regression coverage to ensure skeleton placeholders do not fan out reveal animations.
- Limited per-card reveal animation to the first four loaded cards on the `/posts` listing route.
- Applied the same capped reveal behavior to homepage latest-post cards for consistency.
- Preserved the existing reduced-motion fallback while reducing animation work on bulk renders.

**Verification evidence:**
- `npm.cmd test -- src/components/blog/__tests__/PostsListingClient.test.tsx`
- `npm.cmd run build`

---

### Task 6: Tighten card image loading strategy

**Status:** [x] Completed

**Files:**
- Modify: `src/components/blog/PostCard.tsx`
- Review: `next.config.ts`
- Optional review: `src/app/(public)/posts/[slug]/page.tsx`

**Completed work:**
- Tightened listing-card `next/image` settings to explicitly use lazy loading for feed browsing.
- Reduced listing-card image quality to a more conservative value for the `/posts` route.
- Updated card `sizes` hints to better match the actual rendered listing layout.
- Added regression coverage to lock the listing image strategy in place.

**Verification evidence:**
- `npm.cmd test -- src/components/blog/__tests__/PostCard.test.tsx`
- `npm.cmd run build`
- Manual `/posts` browsing in dev or production preview

---

### Task 7: Broader validation pass

**Status:** [x] Completed

**Files:**
- Review only unless issues are found

**Completed work:**
- Ran a repository-wide lint pass and recorded remaining warnings separately.
- Re-ran the final production build after the `/posts` performance changes.
- Confirmed `/posts` still emits as a static route in the final build output.
- Left optional browser-devtools profiling as a manual follow-up item rather than blocking completion.

**Verification evidence:**
- `npm.cmd run lint`
- `npm.cmd run build`

---

## Current Verification Snapshot

- [x] `npm.cmd test -- src/components/blog/__tests__/PostsListingClient.test.tsx src/components/blog/__tests__/useInfinitePosts.test.tsx`
- [x] `npm.cmd test -- src/components/blog/__tests__/PostsListingClient.test.tsx`
- [x] `npm.cmd test -- src/components/blog/__tests__/PostCard.test.tsx`
- [x] `npm.cmd run build`
- [x] `npm.cmd run lint`

## Notes

- `/posts` is now emitted as a static route in the latest build output.
- The next planned work should focus on perceived smoothness and validation completeness, not on reworking the core loading model.
- Quantitative targets in this document are intended to make completion criteria explicit; they should be updated with observed results during verification runs.
- Implementation details may change as long as the acceptance criteria and validation evidence remain satisfied.
- Latest lint pass reports warnings only, not errors. Current warnings are in `src/app/(public)/posts/[slug]/page.tsx`, `src/components/blog/__tests__/PostCard.test.tsx`, and `src/components/blog/useInfinitePosts.ts`.
