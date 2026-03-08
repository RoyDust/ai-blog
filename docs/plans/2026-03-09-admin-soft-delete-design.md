# Admin Soft Delete Design

> **Scope:** posts, comments, categories, tags
> **Date:** 2026-03-09

## Confirmed Decisions

- Soft delete applies to `Post`, `Comment`, `Category`, and `Tag`.
- Soft-deleted data is hidden from all public pages and APIs.
- Soft-deleted data is also hidden from default admin lists.
- No recycle-bin UI and no restore entry are added in this phase.
- Existing delete actions change from physical delete to soft delete.

## Recommended Approach

Use a shared nullable `deletedAt` field on the four models.
All read paths that power public pages, public APIs, and default admin lists must filter with `deletedAt: null`.
All delete endpoints should switch from `delete()` to `update({ deletedAt: new Date() })`.

## Impact Notes

- Data remains in the database for audit and future restore work.
- Public post detail, archive/search/listing flows must stop reading deleted posts.
- Comment counts and category/tag associations should only reflect non-deleted posts/comments where practical.
- Existing moderation states remain separate from deletion state.
