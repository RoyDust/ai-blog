# 计划：后台封面图库管理与随机封面能力

> **For Codex:** Execute this plan task-by-task. Keep changes small, test-backed, and reversible. Use checkbox (`- [ ]`) syntax for implementation tracking.

**Goal:** 在后台增加“封面图库”管理能力：管理员可以上传图片到图床、保存图片链接并维护图库；新建/编辑文章时可以从图库直接选择封面；没有封面的文章可以从图库随机补齐封面；同时为后续 AI 生成封面图预留数据和服务扩展口。

**Tech Stack:** Next.js 16 App Router, React 19, Prisma 7, PostgreSQL, TypeScript, Vitest, Testing Library, existing Qiniu direct-upload flow.

---

## Scope

本计划覆盖：

- 后台封面图库数据模型与 CRUD API。
- 复用现有七牛直传链路，把上传后的公开 URL 保存成图库资产。
- 后台 `/admin/covers` 图库管理页。
- 新建文章和编辑文章中接入“从图库选择封面”。
- 无封面文章随机选用图库封面的服务、发布时兜底和批量补齐入口。
- AI 生成封面图的字段和接口边界预留。

本计划不覆盖：

- 真正调用 AI 生成图片。
- 图片裁剪、抠图、滤镜、压缩或 CDN 刷新。
- 替换现有正文图片上传。
- 对历史图片文件做对象存储清理。

---

## Current Baseline

- `Post` 已有 `coverImage String?`，当前公开渲染主要依赖这个 URL 字段：`prisma/schema.prisma:90`、`prisma/schema.prisma:105`。
- 后台已经有七牛上传 token API，且会生成 `covers/...` key 并返回 `token/key/domain/uploadUrl`：`src/app/api/admin/uploads/qiniu-token/route.ts:35`、`src/app/api/admin/uploads/qiniu-token/route.ts:39`、`src/app/api/admin/uploads/qiniu-token/route.ts:64`、`src/app/api/admin/uploads/qiniu-token/route.ts:83`。
- 新建文章页已有封面上传按钮，上传成功后直接回填 `coverImage`：`src/components/posts/CreatePostWorkspace.tsx:167`、`src/components/posts/CreatePostWorkspace.tsx:175`、`src/components/posts/CreatePostWorkspace.tsx:201`、`src/components/posts/CreatePostWorkspace.tsx:458`、`src/components/posts/CreatePostWorkspace.tsx:475`。
- 编辑文章页也已有同类封面上传逻辑，并在元数据弹窗维护封面 URL：`src/app/admin/posts/[id]/edit/page.tsx:186`、`src/app/admin/posts/[id]/edit/page.tsx:194`、`src/app/admin/posts/[id]/edit/page.tsx:220`、`src/app/admin/posts/[id]/edit/page.tsx:314`、`src/app/admin/posts/[id]/edit/page.tsx:331`。
- 管理后台导航集中在 `adminNavItems`，新增图库入口应接入这里：`src/components/admin/shell/config.ts:16`、`src/components/admin/shell/config.ts:18`、`src/components/admin/shell/config.ts:21`。
- 管理员文章 API 已经集中在 `/api/admin/posts` 和 `/api/admin/posts/[id]`，创建/更新分别走 `createAdminPost`、`updateAdminPost`：`src/app/api/admin/posts/route.ts:68`、`src/app/api/admin/posts/route.ts:72`、`src/app/api/admin/posts/[id]/route.ts:45`、`src/app/api/admin/posts/[id]/route.ts:51`。
- 后端创建/更新文章时已经写入 `coverImage` 并触发公共页面 revalidate：`src/lib/ai-authoring.ts:431`、`src/lib/ai-authoring.ts:446`、`src/lib/ai-authoring.ts:472`、`src/lib/ai-authoring.ts:504`、`src/lib/ai-authoring.ts:527`。
- `next.config.ts` 已把 `QINIU_DOMAIN` 注入 `next/image` remotePatterns：`next.config.ts:4`、`next.config.ts:14`、`next.config.ts:40`。
- 前台文章卡片和文章详情已经用 `coverImage` 渲染图片，不需要第一阶段重构展示层：`src/components/blog/PostCard.tsx:37`、`src/components/blog/PostCard.tsx:89`、`src/components/blog/PostCard.tsx:96`、`src/app/(public)/posts/[slug]/page.tsx:215`、`src/app/(public)/posts/[slug]/page.tsx:217`。

---

## Product Decisions

1. **继续以 `Post.coverImage` 作为公开展示字段。**  
   图库只补充管理能力和来源追踪，避免牵动前台所有查询与卡片组件。

2. **新增 `Post.coverAssetId` 作为可选来源关系。**  
   管理员手填外部 URL 时只保存 `coverImage`；从图库选择或随机补齐时同时写入 `coverImage` 和 `coverAssetId`。

3. **现有七牛上传 token 先复用，不新引入依赖。**  
   图库上传流程为：客户端申请 token -> 直传七牛 -> 调用图库 API 保存 URL/key/元数据。

4. **随机封面只处理“封面为空”的文章。**  
   不覆盖已有 `coverImage`，除非管理员在批量工具里显式选择“覆盖已有封面”，该选项不放入 MVP。

5. **发布时兜底 + 批量补齐并存。**  
   发布一篇空封面文章时自动从图库选一张；已有历史文章通过后台批量动作补齐。

6. **AI 生成封面图只预留口，不做调用。**  
   数据表和服务接口保留 `source/provider/aiPrompt/aiModelId/metadata`，后续可接 `/api/admin/covers/generate`。

---

## Acceptance Criteria

- 管理员可以进入 `/admin/covers` 查看封面图库，列表至少包含缩略图、标题/备注、来源、使用次数、创建时间和操作入口。
- 管理员可以在 `/admin/covers` 上传图片到七牛，上传成功后图库中新增一条可管理的图片记录。
- 同一个 URL 重复保存时不会产生重复图库记录，应返回已有记录或给出明确提示。
- 管理员可以手动新增一个图片 URL 到图库，用于接入已经存在于图床上的图片。
- 管理员可以编辑图库图片的标题、alt、标签、备注、状态。
- 管理员可以软删除或归档图库图片；被软删除图片不参与随机选择和选择器默认列表。
- 新建文章页可以从图库选择封面，并把选中的图片 URL 写入表单。
- 编辑文章页可以从图库选择封面，并把选中的图片 URL 写入表单。
- 从图库选择封面保存文章后，`Post.coverImage` 与 `Post.coverAssetId` 都被写入。
- 手动输入封面 URL 保存文章后，现有行为保持可用，`coverAssetId` 可以为空。
- 发布空封面文章时，如果图库存在可用图片，则自动随机补齐封面。
- 图库为空时，发布空封面文章不会失败，只保留空封面并返回正常保存结果。
- 后台提供批量补齐入口，只更新 `coverImage` 为空且未软删除的文章。
- 随机选中某张图库图片后，其 `usageCount` 和 `lastUsedAt` 会更新。
- AI 生成封面暂不出现在可点击主流程中，但数据模型和服务接口能表达 `source = "ai"` 的图片资产。
- 管理员鉴权沿用 `requireAdminSession()`，普通用户不能访问图库 API。

---

## Data Model

### Prisma Schema

**Files:**

- Modify: `prisma/schema.prisma`
- Add migration under `prisma/migrations/*_add_cover_assets/migration.sql`

建议新增：

```prisma
model CoverAsset {
  id          String    @id @default(cuid())
  url         String    @unique
  key         String?
  provider    String    @default("qiniu")
  source      String    @default("upload")
  status      String    @default("active")
  title       String?
  alt         String?
  description String?   @db.Text
  tags        String[]  @default([])
  width       Int?
  height      Int?
  blurDataUrl String?   @db.Text
  aiPrompt    String?   @db.Text
  aiModelId   String?
  metadata    Json?
  usageCount  Int       @default(0)
  lastUsedAt  DateTime?
  createdById String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  posts Post[]

  @@index([status, createdAt])
  @@index([source, createdAt])
  @@index([deletedAt])
  @@map("cover_assets")
}
```

Modify `Post`:

```prisma
coverImage   String?
coverAssetId String?
coverAsset   CoverAsset? @relation(fields: [coverAssetId], references: [id], onDelete: SetNull)

@@index([coverAssetId])
```

Why strings instead of enums:

- Existing AI task tables use string `type/status`, so this keeps future provider/source expansion low-friction.
- AI image providers may add provider-specific states later; schema enum migrations would add churn.

### Backfill

Optional first-release backfill:

- Do not auto-import every existing `Post.coverImage` into `cover_assets` during migration.
- Add a script or admin action later: “将现有文章封面导入图库”.
- MVP can start cleanly with newly uploaded/added covers.

---

## API Plan

### `GET /api/admin/covers`

**Files:**

- Add: `src/app/api/admin/covers/route.ts`
- Add tests: `src/app/api/admin/covers/__tests__/route.test.ts`

Query params:

- `q`
- `source`
- `status`
- `page`
- `limit`

Behavior:

- Requires admin.
- Excludes `deletedAt != null` by default.
- Returns paginated assets sorted by newest first.

### `POST /api/admin/covers`

Creates or registers a cover asset after upload or manual URL entry.

Payload:

```json
{
  "url": "https://cdn.example.com/covers/a.jpg",
  "key": "covers/a.jpg",
  "provider": "qiniu",
  "source": "upload",
  "title": "Optional title",
  "alt": "Optional alt",
  "tags": ["tech", "dark"]
}
```

Behavior:

- Requires admin.
- Validates URL is `http/https`.
- If provider is `qiniu`, validates URL host matches `QINIU_DOMAIN` and key starts with `covers/`.
- Upserts by `url` or returns conflict with existing asset.
- Defaults `source` to `upload`, `status` to `active`.

### `PATCH /api/admin/covers/[id]`

**Files:**

- Add: `src/app/api/admin/covers/[id]/route.ts`
- Add tests: `src/app/api/admin/covers/[id]/__tests__/route.test.ts`

Behavior:

- Edit title, alt, description, tags, status.
- Do not allow changing URL in MVP; URL identity stays stable.

### `DELETE /api/admin/covers/[id]`

Soft-delete only:

- Set `deletedAt`.
- Do not clear posts that already reference this asset.
- Exclude from future picker/random selection.

### `POST /api/admin/covers/randomize-posts`

**Files:**

- Add: `src/app/api/admin/covers/randomize-posts/route.ts`
- Add tests: `src/app/api/admin/covers/randomize-posts/__tests__/route.test.ts`

Payload:

```json
{
  "postIds": ["optional-post-id"],
  "publishedOnly": true
}
```

Behavior:

- Requires admin.
- Finds posts where `deletedAt = null` and `coverImage` is empty.
- If `postIds` provided, limits to those posts.
- If `publishedOnly` true, limits to published posts.
- For each target post, chooses a random active cover asset, writes `coverImage/coverAssetId`, increments usage stats, and revalidates public paths.
- If no active covers exist, returns `{ updated: 0, skippedReason: "NO_ACTIVE_COVERS" }`.

---

## Service Layer

**Files:**

- Add: `src/lib/cover-assets.ts`
- Add tests: `src/lib/__tests__/cover-assets.test.ts`
- Modify: `src/lib/validation.ts`
- Modify tests: `src/lib/__tests__/validation.test.ts`

Service functions:

- `listCoverAssets(input)`
- `createCoverAsset(input)`
- `updateCoverAsset(id, input)`
- `softDeleteCoverAsset(id)`
- `selectRandomCoverAsset(input?)`
- `applyCoverAssetToPost(postId, coverAsset)`
- `ensurePostCoverFromLibrary(post, options?)`
- `backfillMissingPostCovers(input)`

Random selection algorithm:

1. Count active, non-deleted assets.
2. If count is 0, return `null`.
3. Generate `skip = Math.floor(random() * count)`.
4. `findFirst({ where, orderBy: { createdAt: "desc" }, skip })`.
5. In the same transaction that updates a post, increment `usageCount` and set `lastUsedAt`.

Test with injectable RNG:

```ts
selectRandomCoverAsset({ random: () => 0.42 })
```

This avoids flaky tests and keeps the first implementation Prisma-only.

---

## Upload Flow

Current upload token route can remain, but extract shared helpers if duplication grows:

**Files:**

- Keep/possibly refactor: `src/app/api/admin/uploads/qiniu-token/route.ts`
- Add optional helper: `src/lib/qiniu-upload.ts`

Recommended MVP flow:

1. UI calls existing `POST /api/admin/uploads/qiniu-token`.
2. UI uploads file directly to Qiniu.
3. UI builds final URL from `domain/key`, as it does today.
4. UI calls `POST /api/admin/covers` to persist the image in the library.
5. UI can immediately select the created cover for the current article.

Important validation:

- `parseUploadRequest` currently reads `filename` and optional `contentType`: `src/lib/validation.ts:146`、`src/lib/validation.ts:151`。
- Add stricter image MIME allowlist and optional file-size/dimension hints in the new cover API path if not added to the token route.
- Keep the existing route backward compatible for current editor uploads.

---

## Admin UI Plan

### Navigation

**Files:**

- Modify: `src/components/admin/shell/config.ts`
- Modify tests: `src/components/admin/shell/__tests__/config.test.ts`

Add nav item:

- href: `/admin/covers`
- label: `封面图库`
- group: `内容`
- icon: `Image` or `Images` from `lucide-react`

### Gallery Page

**Files:**

- Add: `src/app/admin/covers/page.tsx`
- Add tests: `src/app/admin/__tests__/covers-page.test.tsx`
- Add: `src/components/admin/covers/CoverGalleryManager.tsx`
- Add: `src/components/admin/covers/CoverAssetGrid.tsx`
- Add: `src/components/admin/covers/CoverAssetForm.tsx`
- Add: `src/components/admin/covers/CoverUploadDropzone.tsx`
- Add tests under `src/components/admin/covers/__tests__/`

UI capabilities:

- Upload to Qiniu and save to library.
- Add existing URL manually.
- Search/filter by keyword, source, status.
- Grid/list thumbnails with copy URL and edit actions.
- Archive/delete action with confirmation.
- Empty state that points to upload/manual add.
- Batch action: “为无封面文章随机补齐”.

Design constraints:

- Use existing admin primitives: `PageHeader`, `Toolbar`, `WorkspacePanel`, `DataTable` where appropriate.
- Thumbnails should use `FallbackImage` so broken image URLs degrade gracefully.
- Avoid nested cards; use grid items or table rows as the repeated asset surface.

### Cover Picker

**Files:**

- Add: `src/components/admin/covers/CoverPicker.tsx`
- Add tests: `src/components/admin/covers/__tests__/CoverPicker.test.tsx`
- Modify: `src/components/posts/CreatePostWorkspace.tsx`
- Modify: `src/app/admin/posts/[id]/edit/page.tsx`
- Modify existing editor tests as needed.

Behavior:

- Add “从图库选择” next to existing “封面图 URL” / upload controls.
- Picker opens as a modal or drawer.
- Shows searchable thumbnails.
- Selecting an asset writes:
  - `coverImage = asset.url`
  - `coverAssetId = asset.id`
- Keep manual URL input visible for escape hatch.
- Existing upload button can either:
  - stay as “upload and fill URL only”, or
  - be upgraded to “upload, save to gallery, and use”.

Recommended MVP:

- On create/edit article pages, upgrade upload to “upload, save to gallery, and use” to avoid duplicate UX.
- Preserve manual URL input for cases outside the managed gallery.

---

## Article Save Integration

**Files:**

- Modify: `src/lib/validation.ts`
- Modify: `src/lib/ai-authoring.ts`
- Modify tests: `src/lib/__tests__/ai-authoring.test.ts`
- Modify: `src/app/api/admin/posts/[id]/route.ts` if response needs `coverAssetId`
- Modify: `src/app/api/admin/posts/route.ts` if create response needs `coverAssetId`

Validation:

- `parsePostInput` currently accepts `coverImage`: `src/lib/validation.ts:173`、`src/lib/validation.ts:199`。
- `parsePostPatchInput` currently accepts `coverImage`: `src/lib/validation.ts:244`、`src/lib/validation.ts:275`。
- Add optional `coverAssetId`.
- If `coverAssetId` is supplied, verify it exists, is active, and not deleted before saving.
- If both are supplied, server should derive `coverImage` from the asset unless the URL matches the asset URL. This prevents tampering.

Create/update behavior:

- `createAdminPost` writes `coverImage` today: `src/lib/ai-authoring.ts:446`。
- `updateAdminPost` writes `coverImage` today: `src/lib/ai-authoring.ts:504`。
- Add `coverAssetId` writes in the same data object.
- Before creating/publishing a post, if `published === true` and no cover URL is present, call `ensurePostCoverFromLibrary`.
- For update, only auto-fill when the saved state becomes published and the incoming/current `coverImage` is empty.
- Revalidate public content after random cover assignment using existing `revalidatePublicContent` path: `src/lib/ai-authoring.ts:527`。

---

## AI Cover Generation Extension Point

Do not implement model calls in this phase. Reserve the following:

**Data fields already covered:**

- `CoverAsset.source = "ai"`
- `CoverAsset.provider = "openai-compatible" | "replicate" | "qiniu-ai" | ...`
- `CoverAsset.aiPrompt`
- `CoverAsset.aiModelId`
- `CoverAsset.metadata`

**Future service interface:**

```ts
export type CoverGenerationInput = {
  postId?: string
  title: string
  excerpt?: string
  content?: string
  style?: string
  modelId?: string
}

export type GeneratedCoverAsset = {
  url: string
  key?: string
  provider: string
  aiPrompt: string
  aiModelId?: string
  metadata?: Record<string, unknown>
}

export interface CoverGenerationProvider {
  id: string
  generateCover(input: CoverGenerationInput): Promise<GeneratedCoverAsset>
}
```

**Future API shape:**

- `POST /api/admin/covers/generate`
- Generate image -> upload/store if provider returns binary -> create `CoverAsset` with `source = "ai"` -> return asset for preview/use.

Do not add a visible “AI 生成封面” button until a provider is implemented and failure/cost states are designed.

---

## Implementation Steps

### Phase 1: Lock Contracts With Tests

- [x] Add validation tests for cover asset create/update payloads.
- [x] Add service tests for random selection, empty-library behavior, duplicate URL handling, and usage count updates.
- [x] Add admin route tests for unauthorized access.
- [x] Add editor tests that confirm the picker can write a selected cover URL.

### Phase 2: Database and Core Service

- [x] Add `CoverAsset` model and `Post.coverAssetId`.
- [x] Create Prisma migration.
- [x] Implement `src/lib/cover-assets.ts`.
- [x] Update post create/update code to accept and persist `coverAssetId`.
- [x] Add random cover selection and post application service.

### Phase 3: Admin Cover APIs

- [x] Add `GET/POST /api/admin/covers`.
- [x] Add `PATCH/DELETE /api/admin/covers/[id]`.
- [x] Add `POST /api/admin/covers/randomize-posts`.
- [x] Ensure all routes use `requireAdminSession()`.
- [x] Ensure qiniu URL/key validation is server-side.

### Phase 4: Gallery Management UI

- [x] Add `/admin/covers`.
- [x] Add nav entry and breadcrumb metadata.
- [x] Build upload + register flow.
- [x] Build manual URL add form.
- [x] Build asset grid/table, search/filter, edit, archive/delete.
- [x] Add batch “随机补齐无封面文章” action.

### Phase 5: Article Editor Integration

- [x] Add `CoverPicker`.
- [x] Add picker trigger to new article metadata panel.
- [x] Add picker trigger to edit article metadata modal.
- [x] Upgrade editor upload flow to save uploaded image into gallery before applying.
- [x] Preserve manual URL input behavior.

### Phase 6: Random Cover Behavior

- [x] Auto-assign random cover when publishing a post with empty cover and gallery has active assets.
- [x] Keep drafts unchanged unless admin explicitly picks a cover.
- [x] Ensure batch randomization only affects missing-cover posts.
- [x] Revalidate touched public paths after batch updates.

### Phase 7: Verification and Cleanup

- [x] Run focused Vitest suites for validation, cover service, cover API, editor UI, admin nav.
- [x] Run `pnpm lint`.
- [x] Run `pnpm test`.
- [x] Run `pnpm prisma generate`.
- [ ] If migration is generated locally, verify it applies cleanly to a disposable database.

---

## Verification Plan

Focused commands:

```bash
pnpm test -- src/lib/__tests__/cover-assets.test.ts
pnpm test -- src/app/api/admin/covers/__tests__/route.test.ts
pnpm test -- src/app/api/admin/covers/[id]/__tests__/route.test.ts
pnpm test -- src/app/api/admin/covers/randomize-posts/__tests__/route.test.ts
pnpm test -- src/components/admin/covers/__tests__/CoverPicker.test.tsx
pnpm test -- src/components/admin/shell/__tests__/config.test.ts
```

Full checks:

```bash
pnpm prisma generate
pnpm lint
pnpm test
```

Manual smoke test:

1. Login as admin.
2. Open `/admin/covers`.
3. Upload one image.
4. Confirm it appears in gallery.
5. Create a draft article and choose cover from gallery.
6. Save draft; reload edit page; confirm cover remains.
7. Create/publish another article without cover; confirm random cover is assigned.
8. Run batch randomization on posts with no cover; confirm only missing-cover posts changed.

---

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Direct upload succeeds but DB save fails | UI shows retry “保存到图库”，and uploaded URL can be manually added. |
| Random cover overuses one image | Track `usageCount`; later improve selection to prefer lower usage. |
| Manual URL points to unsupported host | Accept as plain URL for data, but `FallbackImage` handles render failures; Qiniu host validation only applies to provider=`qiniu`. |
| AI extension fields become unused clutter | Keep AI UI disabled; fields are nullable and only populated when source=`ai`. |
| `coverAssetId` and `coverImage` drift | Server derives `coverImage` from `coverAssetId` when asset is supplied. |
| Batch randomization touches too many posts | Require admin route, preview count in UI, default to missing-only, and revalidate after update. |

---

## Rollout Order

1. Land schema and service layer behind tests.
2. Land admin APIs.
3. Land `/admin/covers` management UI.
4. Land editor picker integration.
5. Enable publish-time random fallback.
6. Enable batch randomization action after route tests pass.

This order keeps the feature usable at each checkpoint and avoids coupling the editor UI to unfinished storage logic.

---

## Follow-ups

- Import existing `Post.coverImage` values into the gallery.
- Add image dimensions extraction if a server-side image metadata dependency is later approved.
- Add cover usage view: which posts use this cover.
- Add “prefer unused covers” or weighted random strategy.
- Add AI generation route and UI once provider/cost/failure handling is designed.
- Add cover categories or saved style presets if the gallery grows.
