# AI Backoffice First Batch Implementation Plan

> **For Codex:** Execute this plan task-by-task. Keep changes small, test-backed, and reversible. Use checkbox (`- [ ]`) syntax for tracking implementation progress.

**Goal:** Land the first batch from `docs/2026-04-26-ai-backoffice-roadmap.md`: AI task records, a single-article AI workspace, and batch content completion. The first batch should turn the current summary-only feature into a usable AI content operations layer.

**Architecture:** Introduce a persistent AI task ledger (`AiTask` / `AiTaskItem`) as the shared backbone, migrate the existing bulk-summary workflow onto it, then add reusable AI action services for summary, SEO description, title suggestions, slug suggestions, tag extraction, and category recommendation. UI surfaces should show AI output as suggestions first, with explicit human confirmation before mutating high-impact content fields.

**Tech Stack:** Next.js 16 App Router, React 19, Prisma 7, PostgreSQL, TypeScript, Vitest, Testing Library.

---

## Scope

This plan covers only the first batch:

- AI task records page
- Article AI workspace
- Batch content completion

This plan does not implement:

- Prompt template management
- AI review report
- Comment AI moderation
- Vector search / RAG
- Chat-style admin assistant
- Fully automated publishing

Those remain follow-up phases from the roadmap.

---

## Current Baseline

Already available:

- AI model management at `/admin/ai/models`
- OpenAI-compatible model configuration
- Environment fallback model for summaries
- API key encryption for database-backed models
- Single-article summary generation
- Bulk article summary queue
- Post-level summary status fields:
  - `summaryStatus`
  - `summaryError`
  - `summaryGeneratedAt`
  - `summaryJobId`
  - `summaryModelId`
- Refresh recovery for active summary jobs

Pain points to solve:

- There is no central AI task history.
- Existing summary jobs are visible only through post rows.
- Batch actions are summary-only.
- Single-article AI actions are not organized as a workspace.
- Generated output does not have a general “preview then apply” model.
- SEO-specific fields do not exist yet.

---

## Acceptance Criteria

- Admin can view AI task history at `/admin/ai/tasks`.
- Admin can open one AI task and see item-level results and failures.
- Existing bulk summary generation is represented as an `AiTask` with `AiTaskItem` rows.
- Admin can retry failed task items.
- Article edit page exposes an AI workspace panel with at least:
  - generate summary
  - generate SEO description
  - suggest title
  - suggest slug
  - suggest tags
  - suggest category
- AI workspace results are previewed before applying.
- Batch article list supports at least:
  - generate missing summaries
  - generate missing SEO descriptions
  - suggest missing tags
  - suggest missing categories
- Batch operations are asynchronous and recoverable after refresh.
- Existing summary behavior remains compatible.
- `pnpm lint`, targeted tests, `pnpm test`, and `pnpm build` pass.

---

## Data Model Plan

### Add `AiTask`

Purpose: one row per AI operation run.

Suggested fields:

- `id String @id @default(cuid())`
- `type String`
  - `post-summary`
  - `post-seo-description`
  - `post-title-suggestion`
  - `post-slug-suggestion`
  - `post-tag-suggestion`
  - `post-category-suggestion`
  - `post-bulk-completion`
- `status String`
  - `QUEUED`
  - `RUNNING`
  - `SUCCEEDED`
  - `PARTIAL_FAILED`
  - `FAILED`
- `source String`
  - `single-post`
  - `bulk-posts`
  - `retry`
- `modelId String?`
- `createdById String?`
- `requestedCount Int @default(0)`
- `succeededCount Int @default(0)`
- `failedCount Int @default(0)`
- `startedAt DateTime?`
- `finishedAt DateTime?`
- `lastError String? @db.Text`
- `metadata Json?`
- `createdAt DateTime @default(now())`
- `updatedAt DateTime @updatedAt`

Indexes:

- `@@index([status, createdAt])`
- `@@index([type, createdAt])`
- `@@index([createdById])`

### Add `AiTaskItem`

Purpose: one row per target item, usually one article.

Suggested fields:

- `id String @id @default(cuid())`
- `taskId String`
- `postId String?`
- `status String`
  - `QUEUED`
  - `RUNNING`
  - `SUCCEEDED`
  - `FAILED`
  - `SKIPPED`
- `action String`
- `inputSnapshot Json?`
- `output Json?`
- `applied Boolean @default(false)`
- `error String? @db.Text`
- `startedAt DateTime?`
- `finishedAt DateTime?`
- `createdAt DateTime @default(now())`
- `updatedAt DateTime @updatedAt`

Indexes:

- `@@index([taskId, status])`
- `@@index([postId])`
- `@@index([action, createdAt])`

### Add SEO fields to `Post`

Purpose: first batch includes SEO description generation, so it needs a durable target.

Suggested fields:

- `seoTitle String?`
- `seoDescription String? @db.Text`
- `seoGeneratedAt DateTime?`
- `seoModelId String?`

Notes:

- Existing public metadata can continue falling back to `excerpt`.
- Once `seoDescription` exists, article metadata should prefer `seoDescription`, then `excerpt`, then title fallback.
- `seoTitle` is optional for phase 1. If scope needs to stay smaller, implement only `seoDescription`.

---

## Service Layer Plan

### `src/lib/ai-tasks.ts`

Responsibilities:

- Create task and task items.
- Update task counts.
- Resolve task status from item statuses.
- List tasks for admin pages.
- Read task detail.
- Retry failed items.
- Resume queued/running tasks.

Core functions:

- `createAiTask(input)`
- `createAiTaskItems(taskId, items)`
- `markAiTaskRunning(taskId)`
- `markAiTaskItemRunning(itemId)`
- `markAiTaskItemSucceeded(itemId, output)`
- `markAiTaskItemFailed(itemId, error)`
- `refreshAiTaskCounts(taskId)`
- `listAiTasks(params)`
- `getAiTaskDetail(taskId)`
- `retryAiTaskFailedItems(taskId)`
- `resumeAiTasks(taskId?)`

### `src/lib/ai-post-actions.ts`

Responsibilities:

- Convert a post into model input.
- Run AI actions against the configured model.
- Normalize model output into typed suggestions.
- Apply confirmed suggestions to posts.

Core actions:

- `generatePostSummarySuggestion(post, modelId?)`
- `generatePostSeoDescriptionSuggestion(post, modelId?)`
- `generatePostTitleSuggestions(post, modelId?)`
- `generatePostSlugSuggestion(post, modelId?)`
- `generatePostTagSuggestions(post, modelId?)`
- `generatePostCategorySuggestion(post, modelId?)`
- `applyPostAiSuggestion(postId, suggestion)`

Output examples:

```ts
type SummaryOutput = {
  summary: string;
};

type SeoDescriptionOutput = {
  seoDescription: string;
};

type TitleOutput = {
  titles: string[];
};

type TagSuggestionOutput = {
  existingTagIds: string[];
  newTagNames: string[];
};
```

### Refactor `src/lib/post-summary-jobs.ts`

Target shape:

- Keep existing public behavior.
- Internally create `AiTask` and `AiTaskItem`.
- Continue updating post-level `summaryStatus` for fast list rendering.
- Store item output in `AiTaskItem.output`.
- Store item errors in `AiTaskItem.error`.

This preserves current UI while adding durable task history.

---

## API Plan

### Task APIs

#### `GET /api/admin/ai/tasks`

Returns paginated task list.

Query params:

- `page`
- `limit`
- `status`
- `type`

Response:

```json
{
  "success": true,
  "data": {
    "tasks": [],
    "pagination": {}
  }
}
```

#### `GET /api/admin/ai/tasks/[id]`

Returns task detail with items.

#### `POST /api/admin/ai/tasks/[id]/retry`

Retries failed task items.

Rules:

- Only retry `FAILED` items.
- Create a retry task or append new items to the existing task.
- Prefer creating a new task with `source=retry` for clean history.

### AI Action APIs

#### `POST /api/admin/ai/actions`

Runs a single-post AI action and returns a suggestion without applying it.

Request:

```json
{
  "postId": "post-id",
  "action": "generate-seo-description",
  "modelId": "optional-model-id"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "taskId": "task-id",
    "itemId": "item-id",
    "action": "generate-seo-description",
    "output": {
      "seoDescription": "..."
    }
  }
}
```

#### `POST /api/admin/ai/actions/apply`

Applies a generated suggestion.

Request:

```json
{
  "itemId": "task-item-id"
}
```

Rules:

- Only apply outputs generated for the same post.
- Validate output shape before writing.
- Mark `AiTaskItem.applied=true`.
- Revalidate public content when post fields change.

### Batch Completion API

#### `POST /api/admin/ai/batch`

Creates a batch task.

Request:

```json
{
  "postIds": ["post-1", "post-2"],
  "actions": ["summary", "seo-description", "tags", "category"],
  "mode": "missing-only",
  "apply": false,
  "modelId": "optional-model-id"
}
```

Modes:

- `missing-only`
- `overwrite`
- `suggest-only`

Recommendation for first batch:

- Default to `missing-only`.
- Default to `apply=false` for tags/category/title/slug.
- Allow `apply=true` for summary and SEO description only after explicit UI confirmation.

---

## UI Plan

### `/admin/ai/tasks`

Purpose: task list.

UI elements:

- Filter tabs: All, Running, Failed, Completed
- Type filter
- Task table:
  - Type
  - Status
  - Model
  - Requested
  - Succeeded
  - Failed
  - Duration
  - Created time
  - Actions
- Row actions:
  - View detail
  - Retry failed

### `/admin/ai/tasks/[id]`

Purpose: item-level inspection.

UI elements:

- Task summary header
- Item table:
  - Article title
  - Action
  - Status
  - Output preview
  - Error
  - Applied
  - Updated time
- Actions:
  - Retry failed items
  - Open article
  - Apply suggestion where applicable

### Article Edit AI Workspace

Location:

- `src/app/admin/posts/[id]/edit/page.tsx`
- Existing editor inspector/sidebar area is the likely best placement.

Suggested sections:

- Quick actions:
  - Generate summary
  - Generate SEO description
  - Suggest titles
  - Suggest slug
  - Suggest tags
  - Suggest category
- Result preview:
  - Current value
  - Suggested value
  - Apply button
  - Regenerate button
  - Dismiss button
- Status:
  - Model used
  - Last generated time
  - Error message

Important UX rule:

- Never silently overwrite title, slug, tags, category, or content.

### Article List Batch Completion

Location:

- `src/app/admin/posts/page.tsx`

Suggested UI:

- Add “AI 批量补全” action.
- Open a compact dialog/modal with:
  - Selected count
  - Action checkboxes
  - Mode selector: missing-only / overwrite / suggest-only
  - Model selector if multiple ready models exist
  - Start button
- After start:
  - Show task ID
  - Show progress badge
  - Link to task detail page

---

## Task Order

### Task 1: Add AI task schema and migration

**Files:**

- Modify: `prisma/schema.prisma`
- Add: `prisma/migrations/YYYYMMDDHHMMSS_add_ai_tasks/migration.sql`

Steps:

- [ ] Add `AiTask` model.
- [ ] Add `AiTaskItem` model.
- [ ] Add optional `User.aiTasks` relation if using `createdById`.
- [ ] Add optional `Post.aiTaskItems` relation if using `postId`.
- [ ] Add `Post.seoTitle`, `Post.seoDescription`, `Post.seoGeneratedAt`, `Post.seoModelId`.
- [ ] Write migration SQL.
- [ ] Run `pnpm exec prisma generate`.

Verification:

- [ ] Prisma generate succeeds.
- [ ] Existing tests still compile.

### Task 2: Add AI task service

**Files:**

- Add: `src/lib/ai-tasks.ts`
- Add: `src/lib/__tests__/ai-tasks.test.ts`

Steps:

- [ ] Write tests for task creation.
- [ ] Write tests for task item success/failure count refresh.
- [ ] Write tests for retrying failed items.
- [ ] Implement task service helpers.
- [ ] Keep service independent from UI routes.

Verification:

- [ ] `pnpm exec vitest run src/lib/__tests__/ai-tasks.test.ts`

### Task 3: Migrate current summary jobs onto task ledger

**Files:**

- Modify: `src/lib/post-summary-jobs.ts`
- Modify: `src/app/api/admin/posts/summarize/bulk/route.ts`
- Modify: `src/app/api/admin/posts/summarize/bulk/__tests__/route.test.ts`
- Modify: `src/lib/__tests__/post-summary-jobs.test.ts`

Steps:

- [ ] Create an `AiTask` when bulk summary starts.
- [ ] Create one `AiTaskItem` per valid post.
- [ ] Store generated summary in `AiTaskItem.output`.
- [ ] Store failure reason in `AiTaskItem.error`.
- [ ] Continue updating `Post.summaryStatus` and `Post.excerpt`.
- [ ] Return `taskId` from the existing bulk summary endpoint.
- [ ] Keep old `jobId` response field temporarily if needed for compatibility, but prefer `taskId` in new UI.

Verification:

- [ ] Existing bulk summary tests pass.
- [ ] New tests assert `AiTask` and `AiTaskItem` writes.

### Task 4: Add task list and task detail APIs

**Files:**

- Add: `src/app/api/admin/ai/tasks/route.ts`
- Add: `src/app/api/admin/ai/tasks/__tests__/route.test.ts`
- Add: `src/app/api/admin/ai/tasks/[id]/route.ts`
- Add: `src/app/api/admin/ai/tasks/[id]/__tests__/route.test.ts`
- Add: `src/app/api/admin/ai/tasks/[id]/retry/route.ts`
- Add: `src/app/api/admin/ai/tasks/[id]/retry/__tests__/route.test.ts`

Steps:

- [ ] Add admin-only task listing route.
- [ ] Add admin-only task detail route.
- [ ] Add retry route.
- [ ] Validate pagination.
- [ ] Validate task existence.
- [ ] Return stable JSON contracts.

Verification:

- [ ] Route tests cover unauthorized access.
- [ ] Route tests cover success responses.
- [ ] Retry tests cover failed-only behavior.

### Task 5: Add AI task pages

**Files:**

- Add: `src/app/admin/ai/tasks/page.tsx`
- Add: `src/app/admin/ai/tasks/[id]/page.tsx`
- Add: `src/app/admin/ai/tasks/__tests__/page.test.tsx`
- Add: `src/components/admin/ai/AiTaskList.tsx`
- Add: `src/components/admin/ai/AiTaskDetail.tsx`
- Modify: `src/components/admin/shell/config.ts`
- Modify: `src/components/admin/shell/__tests__/config.test.ts`

Steps:

- [ ] Add “AI 任务” navigation entry under the AI admin group.
- [ ] Build task list UI.
- [ ] Build task detail UI.
- [ ] Add retry failed action.
- [ ] Add links from task items to article edit pages.

Verification:

- [ ] Page tests render task table.
- [ ] Navigation config test covers the new entry.

### Task 6: Add single-post AI action service

**Files:**

- Add: `src/lib/ai-post-actions.ts`
- Add: `src/lib/__tests__/ai-post-actions.test.ts`
- Modify: `src/lib/post-summary.ts` if shared prompt utilities are needed.

Steps:

- [ ] Implement action input builder.
- [ ] Implement summary action by reusing existing summary generation.
- [ ] Implement SEO description generation.
- [ ] Implement title suggestions.
- [ ] Implement slug suggestion.
- [ ] Implement tag suggestions from existing tags.
- [ ] Implement category suggestion from existing categories.
- [ ] Normalize and validate every action output.

Verification:

- [ ] Unit tests mock fetch and assert normalized output.
- [ ] Tests cover malformed model output.
- [ ] Tests cover missing model/API key.

### Task 7: Add AI action APIs

**Files:**

- Add: `src/app/api/admin/ai/actions/route.ts`
- Add: `src/app/api/admin/ai/actions/__tests__/route.test.ts`
- Add: `src/app/api/admin/ai/actions/apply/route.ts`
- Add: `src/app/api/admin/ai/actions/apply/__tests__/route.test.ts`

Steps:

- [ ] Add admin-only single action route.
- [ ] Create `AiTask` and `AiTaskItem` for every action.
- [ ] Return output without applying.
- [ ] Add apply route that validates `AiTaskItem.output`.
- [ ] Mark applied items after successful write.
- [ ] Revalidate public content after applying post changes.

Verification:

- [ ] Route tests cover generate-only behavior.
- [ ] Route tests cover apply behavior.
- [ ] Route tests cover invalid output and unauthorized access.

### Task 8: Add article edit AI workspace UI

**Files:**

- Modify: `src/app/admin/posts/[id]/edit/page.tsx`
- Add: `src/components/admin/ai/PostAiWorkspace.tsx`
- Add: `src/components/admin/ai/__tests__/PostAiWorkspace.test.tsx`
- Modify existing admin editor tests as needed.

Steps:

- [ ] Add workspace panel in the editor inspector area.
- [ ] Add action buttons.
- [ ] Show loading and error states.
- [ ] Show generated result preview.
- [ ] Add apply/dismiss/regenerate controls.
- [ ] Refresh local form state after applying suggestions.

Verification:

- [ ] Component test covers generating an SEO description.
- [ ] Component test covers applying a suggestion.
- [ ] Existing editor tests still pass.

### Task 9: Add batch content completion API

**Files:**

- Add: `src/app/api/admin/ai/batch/route.ts`
- Add: `src/app/api/admin/ai/batch/__tests__/route.test.ts`
- Modify: `src/lib/ai-tasks.ts`
- Modify: `src/lib/ai-post-actions.ts`

Steps:

- [ ] Accept selected post IDs.
- [ ] Accept selected actions.
- [ ] Accept mode: `missing-only`, `overwrite`, `suggest-only`.
- [ ] Create task and items.
- [ ] Execute actions asynchronously.
- [ ] Store outputs per item.
- [ ] Apply only safe confirmed fields according to mode.

First-batch safety rule:

- Auto-apply summary and SEO description only when explicitly requested.
- Do not auto-apply title, slug, category, or tags in bulk.

Verification:

- [ ] Batch route tests cover selected actions.
- [ ] Tests cover missing-only filtering.
- [ ] Tests cover output stored but not applied for high-impact fields.

### Task 10: Add batch completion UI

**Files:**

- Modify: `src/app/admin/posts/page.tsx`
- Add: `src/components/admin/ai/BulkAiCompletionDialog.tsx`
- Add: `src/components/admin/ai/__tests__/BulkAiCompletionDialog.test.tsx`
- Modify: `src/app/admin/__tests__/posts-workbench.test.tsx`

Steps:

- [ ] Replace or extend current bulk summary button with “AI 批量补全”.
- [ ] Add dialog for action selection.
- [ ] Add missing-only / overwrite / suggest-only option.
- [ ] Show selected article count.
- [ ] Start task via `/api/admin/ai/batch`.
- [ ] Show task link after creation.
- [ ] Keep existing one-click summary flow working if still desired.

Verification:

- [ ] Posts workbench test covers opening dialog and starting a batch task.
- [ ] UI handles API failure.

### Task 11: Final integration and cleanup

Steps:

- [ ] Run targeted test suites.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm build`.
- [ ] Run `pnpm exec prisma migrate status`.
- [ ] Update roadmap document if scope changes.

---

## Testing Matrix

### Unit tests

- `src/lib/__tests__/ai-tasks.test.ts`
- `src/lib/__tests__/ai-post-actions.test.ts`
- `src/lib/__tests__/post-summary-jobs.test.ts`

### Route tests

- `src/app/api/admin/ai/tasks/__tests__/route.test.ts`
- `src/app/api/admin/ai/tasks/[id]/__tests__/route.test.ts`
- `src/app/api/admin/ai/tasks/[id]/retry/__tests__/route.test.ts`
- `src/app/api/admin/ai/actions/__tests__/route.test.ts`
- `src/app/api/admin/ai/actions/apply/__tests__/route.test.ts`
- `src/app/api/admin/ai/batch/__tests__/route.test.ts`
- Existing summary route tests

### UI tests

- `src/app/admin/ai/tasks/__tests__/page.test.tsx`
- `src/components/admin/ai/__tests__/PostAiWorkspace.test.tsx`
- `src/components/admin/ai/__tests__/BulkAiCompletionDialog.test.tsx`
- `src/app/admin/__tests__/posts-workbench.test.tsx`
- Existing admin editor tests

---

## Migration Strategy

1. Add new tables and fields without removing existing summary fields.
2. Keep `Post.summaryStatus` as the fast list-rendering state.
3. Store richer history in `AiTask` and `AiTaskItem`.
4. Backfill existing posts:
   - If `excerpt` exists, keep `summaryStatus=GENERATED`.
   - No need to create historical `AiTask` rows for old summaries.
5. Apply migration before deploying UI that depends on task pages.

---

## Rollout Plan

### Development rollout

1. Land schema and service layer.
2. Land task APIs.
3. Land task pages.
4. Land single-post workspace.
5. Land batch completion UI.

### Production rollout

1. Deploy migration.
2. Deploy code.
3. Smoke test AI model list.
4. Smoke test one single-post AI action.
5. Smoke test one small batch with two posts.
6. Verify task list and detail pages.

---

## Risks

### Risk 1: In-process task execution is not a full queue

Impact:

- Server restart can interrupt active work.

Mitigation:

- Keep tasks resumable.
- Polling task pages should call resume endpoints.
- Avoid marking tasks failed only because the browser refreshes.

### Risk 2: AI output may be invalid or unsafe to apply

Impact:

- Bad title, slug, tags, or category can hurt content quality and SEO.

Mitigation:

- Validate outputs.
- Preview before apply.
- Auto-apply only low-risk fields and only with explicit user choice.

### Risk 3: Batch actions can be expensive

Impact:

- Large batches may create many model calls.

Mitigation:

- Keep a max batch size.
- Reuse current `MAX_BULK_SUMMARY_POSTS` style limit.
- Add clear selected count and estimated operations.

### Risk 4: Prompt quality may vary by model

Impact:

- Some models may return verbose or malformed output.

Mitigation:

- Keep output schemas simple.
- Parse conservatively.
- Store raw output in `AiTaskItem.output` for debugging.

---

## Explicitly Deferred From First Batch

| Deferred item | Reason |
| --- | --- |
| Prompt template management | Needs separate CRUD and versioning; second batch |
| AI review report | Depends on task ledger and action output preview |
| Comment AI moderation | Different domain and risk profile |
| Embeddings / RAG | Requires vector infrastructure |
| Chat-style admin assistant | Requires tool permissions and audit design |
| Automatic article publishing | High editorial risk |
| Prompt A/B testing | Needs usage volume and metrics first |

---

## First Implementation Slice Recommendation

If this plan needs to be split further, start with this smallest useful slice:

1. Add `AiTask` / `AiTaskItem`.
2. Move current bulk summary jobs onto the task ledger.
3. Add `/admin/ai/tasks`.
4. Add task detail and retry failed items.

That slice makes the current summary feature observable and sets the foundation for all later AI actions.
