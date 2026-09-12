# 2026-03-07 `/write` Deprecation

## Status
- Canonical create route: `/admin/posts/new`
- Deprecated compatibility route: `/write`
- Effective date: 2026-03-07

## What Changed
- The article creation workspace was moved into the admin content workspace at `/admin/posts/new`.
- `src/app/write/page.tsx` remains only as a redirect shell for old bookmarks, links, and external references.
- Historical design and implementation notes that treated `/write` as an active editor surface were removed.

## Route Mapping
- Old: `/write`
- New: `/admin/posts/new`

## Why
- Keep all authoring actions inside the unified admin content workspace.
- Avoid parallel create-entry routes that diverge in UI, breadcrumb, and navigation behavior.
- Reduce maintenance overhead from outdated `/write`-specific design docs.

## Compatibility
- Existing visits to `/write` are redirected to `/admin/posts/new`.
- Redirect behavior is covered by `src/app/write/__tests__/author-workflow.test.tsx`.
