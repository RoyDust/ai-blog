# Article Reading Time Design

**Goal**

Store article reading time in the database, keep it automatically updated when posts are created or edited, and surface it in the public article header while removing the author avatar and name from the detail page.

**Scope**

- Add a persisted `readingTimeMinutes` field to `Post`
- Compute and save reading time from article content on create and edit
- Backfill existing posts so the new header metadata is complete for old content
- Remove author identity UI from the article detail header
- Show `预计阅读 x 分钟` next to the existing read-count metadata

**Out of Scope**

- Manual reading-time overrides in the admin UI
- Real-time reading-time previews in the editor
- Listing-page or taxonomy-page reading-time display

**Data Model**

Add `readingTimeMinutes Int @default(1)` to `Post`. The default protects new rows during migration and keeps the field non-null. Existing rows must still be backfilled from their real content so the value is meaningful.

**Computation Rule**

Reading time is calculated in application code from article content and persisted before saving the post. The rule should normalize markdown-ish content into readable text, estimate minutes from content length, and clamp the minimum value to `1`.

**Write Path**

The create route at `src/app/api/admin/posts/route.ts` and the edit route at `src/app/api/admin/posts/[id]/route.ts` should both call the same shared utility so the calculation logic lives in one place and stays consistent.

**Backfill**

Create a one-off script at `scripts/backfill-reading-time.ts` that reads all posts, recomputes `readingTimeMinutes`, and updates rows that drift from the current rule. This covers existing content after the migration lands.

**Frontend Rendering**

In `src/app/(public)/posts/[slug]/page.tsx`, remove the author avatar/name row under the title. Extend the metadata line to show `预计阅读 x 分钟` after the read count using the stored database field.

**Testing**

- Add unit tests for the reading-time utility
- Update admin API route tests or add new route-level tests to confirm create/edit persistence writes `readingTimeMinutes`
- Update article detail tests to assert the new metadata and absence of author identity UI

**Risks**

- Prisma schema changes require a migration and a client refresh
- A weak text-normalization rule could undercount or overcount markdown-heavy posts
- Backfill must be idempotent so it can be rerun safely
