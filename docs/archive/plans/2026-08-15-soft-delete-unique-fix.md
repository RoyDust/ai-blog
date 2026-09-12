# 修复计划：软删除 × 唯一约束冲突（P0-2）

> 日期：2026-08-15 · 状态：✅ 已实施（2026-08-15） · 对应问题：`docs/2026-08-15-frontend-backend-architecture-analysis.md` P0-2
>
> 审查结论：① 部分唯一索引语义接受 ② 保留 CoverAsset"重建即复活" ③ CI 同步切换 migrate deploy。
>
> 实施与计划的差异：
> - `DATABASE_URL` 指向生产库（47.98.167.32），未执行 `prisma migrate dev`（避免 shadow DB 直连生产），改为**手写迁移文件** `prisma/migrations/202608150001_soft_delete_partial_unique_indexes/migration.sql` + `pnpm prisma generate`；迁移于 **2026-08-15 经用户明确授权后**用 `prisma migrate deploy` 直接应用到生产（与 deploy-remote.sh 使用的命令一致），并通过 pg 只读查询 + 事务回滚探针完成验证。
> - 旧唯一约束均为 `CREATE UNIQUE INDEX` 形式，迁移使用 `DROP INDEX IF EXISTS`（而非计划中的 `ALTER TABLE ... DROP CONSTRAINT`）。
> - `deploy.yml` 的构建库同步同样从 `db push` 切换为 `migrate deploy`（与 `ci.yml` 一致）。
> - 本地无 PostgreSQL，无法做真实库功能验证；已用契约测试（迁移 SQL 断言）+ 全量单测 + lint + build 兜底，并在迁移应用后于 2026-08-15 完成数据库级验证（pg_indexes 只读核对 + 事务回滚 P2002 探针，见第 8 节）。

## 1. 问题定义

内容模型采用软删除（`deletedAt`），但 slug/name/url 的 `@unique` 是**全局唯一**的——软删记录仍然占用唯一值，重建同名内容必然触发 Prisma P2002，最终被 `toErrorResponse` 落成对用户无意义的 `409 "Conflict"`。

### 1.1 影响面盘点（已逐项核验）

| 模型 | 表 | 唯一字段 | Prisma 约束 | 推断 DB 约束名 | 主要写路径（可能触发 P2002） |
|---|---|---|---|---|---|
| Post | `posts` | slug | `@unique` (schema:152) | `posts_slug_key` | `api/posts` POST/PATCH、`ai-authoring.ts` create/update、AI 日报成文 |
| Series | `series` | slug | `@unique` (schema:213) | `series_slug_key` | `api/admin/series` create(:117)/update(:150) |
| Category | `categories` | name、slug | `@unique`×2 (schema:691-692) | `categories_name_key`、`categories_slug_key` | `api/admin/categories` create(:75)/update(:95) |
| Tag | `tags` | name、slug | `@unique`×2 (schema:705-706) | `tags_name_key`、`tags_slug_key` | `api/admin/tags` 同类 |
| TopicGuide | `topic_guides` | slug | `@unique` (schema:745) | `topic_guides_slug_key` | `topic-guides.ts` create(:117)/update(:178) |
| CoverAsset | `cover_assets` | url | `@unique` (schema:367) | `cover_assets_url_key` | `cover-assets.ts` create(:174)，已有"复活"逻辑(:177-205) |

- **8 个唯一约束**受影响；软删写路径：posts DELETE、`api/admin/{categories,tags,series}` delete、`topic-guides.ts` softDelete(:227)、`cover-assets.ts` softDelete(:272)。
- 不受影响：`User.email`、`NewsletterSubscriber.email`、`AiApiClient.tokenHash`、`Like/Bookmark` 复合唯一等**非软删模型**，以及 `AiTopic.slug`（无 deletedAt，走 status 生命周期）。

### 1.2 现有相关语义

- `cover-assets.ts:174-241` 已有"软删后重建 = 复活旧记录"的产品语义（create 时发现 `deletedAt` 非空则恢复并覆盖元数据），可作为其他模型的参照或反例。
- 所有按 slug/name 的读路径均使用 `findFirst` 并过滤 `deletedAt: null`，**读侧不受本次变更影响**。

## 2. 方案对比与选型

| 维度 | A. 部分唯一索引（推荐） | B. 软删时改写 slug/name | C. 仅友好错误映射 |
|---|---|---|---|
| 做法 | 移除 `@unique`，迁移中建 `CREATE UNIQUE INDEX ... WHERE "deletedAt" IS NULL` | 删除时把 slug 改成 `{slug}-deleted-{id}`，原值释放 | 保持现状，P2002 映射为"名称已被使用" |
| 数据保真 | ✅ 不篡改历史数据，审计/恢复友好 | ❌ 删除即改数据，历史路径失真 | ✅ |
| 竞态安全 | ✅ DB 层保证 active 行唯一，无窗口 | ✅ 但删除动作变复杂 | ❌ 无并发保证（现状） |
| 恢复能力 | ✅ 恢复记录即重新占用原 slug（需代码配合） | ⚠️ 恢复需还原 slug，若被新内容占用则冲突 | ✅ |
| 改造成本 | 中：schema 变更 + 2 处查询改造 + 迁移 SQL | 低：只改各删除路径 | 极低 |
| 长期维护 | Prisma 无法声明部分索引，靠迁移 SQL + 契约测试守 | 无 schema 漂移 | 不解决根本问题 |
| 核心问题 | 可彻底解决"重建同名" | 可解决 | ❌ 不解决 |

**推荐：A（部分唯一索引）+ C（错误映射作为兜底体验）**。
理由：① 该库已有大量迁移 SQL 手写先例（`rate_limit_entries`、pg_trgm 搜索索引），与现有工程风格一致；② 数据不篡改，符合软删除"审计优先"的设计初衷；③ 竞态安全由数据库保证，优于任何应用层判断。B 的数据篡改副作用（历史 URL/名称失真、恢复冲突）大于其"少改 schema"的收益，作为备选。

## 3. 实施步骤（方案 A + C）

### Step 1 — 修改 `prisma/schema.prisma`

对 6 个模型移除 8 处 `@unique`，并为查询热点补普通索引：

```prisma
// Post
slug String            // 原 @unique
@@index([slug])        // 新增：保留按 slug 查询的索引

// Series
slug String
@@index([slug])

// Category
name String            // 原 @unique
slug String            // 原 @unique
@@index([slug])

// Tag
name String
slug String
@@index([slug])

// TopicGuide
slug String
@@index([slug])

// CoverAsset
url String
@@index([url])
```

> 注意：`name` 不补普通索引——active 行的 name 查找可被部分唯一索引覆盖；按 name 且不带 `deletedAt` 过滤的查询不存在。

### Step 2 — 生成迁移并手工补充部分唯一索引

1. `pnpm prisma migrate dev --name soft_delete_partial_unique_indexes`：自动生成 DROP CONSTRAINT + CREATE INDEX。
2. 手工在该迁移中追加 8 个部分唯一索引（约束名按 Prisma 命名规则 `表名_列名_key` 推断，全部用 `IF EXISTS`/`IF NOT EXISTS` 防御）：

```sql
-- posts
ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_slug_key";
CREATE UNIQUE INDEX IF NOT EXISTS "posts_slug_active_unique"
  ON "posts" ("slug") WHERE "deletedAt" IS NULL;

-- series
ALTER TABLE "series" DROP CONSTRAINT IF EXISTS "series_slug_key";
CREATE UNIQUE INDEX IF NOT EXISTS "series_slug_active_unique"
  ON "series" ("slug") WHERE "deletedAt" IS NULL;

-- categories
ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "categories_name_key";
ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "categories_slug_key";
CREATE UNIQUE INDEX IF NOT EXISTS "categories_name_active_unique"
  ON "categories" ("name") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "categories_slug_active_unique"
  ON "categories" ("slug") WHERE "deletedAt" IS NULL;

-- tags
ALTER TABLE "tags" DROP CONSTRAINT IF EXISTS "tags_name_key";
ALTER TABLE "tags" DROP CONSTRAINT IF EXISTS "tags_slug_key";
CREATE UNIQUE INDEX IF NOT EXISTS "tags_name_active_unique"
  ON "tags" ("name") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "tags_slug_active_unique"
  ON "tags" ("slug") WHERE "deletedAt" IS NULL;

-- topic_guides
ALTER TABLE "topic_guides" DROP CONSTRAINT IF EXISTS "topic_guides_slug_key";
CREATE UNIQUE INDEX IF NOT EXISTS "topic_guides_slug_active_unique"
  ON "topic_guides" ("slug") WHERE "deletedAt" IS NULL;

-- cover_assets
ALTER TABLE "cover_assets" DROP CONSTRAINT IF EXISTS "cover_assets_url_key";
CREATE UNIQUE INDEX IF NOT EXISTS "cover_assets_url_active_unique"
  ON "cover_assets" ("url") WHERE "deletedAt" IS NULL;
```

3. 存量数据无需清理：旧全局唯一约束保证每个值最多 1 行，新部分索引不会遇到重复行。
4. 迁移后验证：`prisma migrate status`；抽查 `\d posts`（约束已移除、部分索引存在）。

### Step 3 — 代码适配（findUnique → findFirst）

Prisma Client 重新生成后，按 slug/name/url 的 `findUnique` 会直接**编译报错**，TS 是天然的安全网。已核验的完整清单（仅 2 处，其余 findUnique 均按 id）：

1. `src/lib/ai-topic-radar.ts:368`（AI 日报 slug 生成循环）
   - 现：`while (await prisma.post.findUnique({ where: { slug }, select: { id: true } }))`
   - 改：`while (await prisma.post.findFirst({ where: { slug, deletedAt: null }, select: { id: true } }))`
   - 语义：新索引下只有 active 行占用 slug，循环与 DB 约束一致。
2. `src/lib/cover-assets.ts:177, 234`（封面素材去重 + 复活）
   - 现：`findUnique({ where: { url } })` + 若 `deletedAt` 非空则复活。
   - 改：先 `findFirst({ where: { url, deletedAt: null } })` 判 active 重复；再 `findFirst({ where: { url, deletedAt: { not: null } }, orderBy: { deletedAt: "desc" } })` 找待复活记录（迁移后理论上可能存在多条软删同 url，取最新一条）；保留 P2002 catch 兜底。
3. 全部 `findFirst` 读路径无需改动（已带 `deletedAt: null` 过滤）。

### Step 4 — P2002 友好错误映射（方案 C）

`src/lib/api-errors.ts` 增强：
- `isPrismaConflictError` 基础上新增 `getPrismaConflictTarget(error)`：从 `error.meta.target` 提取字段名。
- `toErrorResponse` 中，若 target 含 `slug`/`name`/`url`，返回 `409 { error: "该 slug/名称已被使用，请更换后再试" }`（按字段给出具体文案），否则维持现有 "Conflict"。
- 收益：真实冲突（active 行之间）与历史占用（已不再发生）都能给用户可操作提示。

### Step 5 — 契约测试

1. **迁移 SQL 契约测试**（放 `src/lib/__tests__/`，符合项目测试文化）：
   - 断言迁移文件包含 8 个 `CREATE UNIQUE INDEX ... WHERE "deletedAt" IS NULL`；
   - 断言 schema.prisma 中对应字段已无 `@unique`（防回退）。
2. **单元测试**：
   - `cover-assets.test.ts`：更新"复活"分支为 findFirst 后的行为（mock 层面）。
   - `api-errors.test.ts`：P2002 target 映射文案。
   - `ai-topic-radar.test.ts`：slug 循环的 mock 从 findUnique 改为 findFirst。
3. 全量回归：`pnpm test` + `pnpm lint` + `pnpm build`。

### Step 6 — CI 对齐（建议随本次一并做）

`ci.yml:59` 当前用 `prisma db push`，与生产的 `migrate deploy` 不一致——CI 库不会有部分唯一索引（`rate_limit_entries` 同样缺失，现存隐患）。改为 `pnpm prisma migrate deploy`，使 CI 与生产 schema 完全一致，也让 Step 5 的迁移 SQL 在 CI 真实执行。

## 4. 风险与回滚

| 风险 | 评估与对策 |
|---|---|
| 约束名推断与实际不符 | 全部 `IF EXISTS`/`IF NOT EXISTS` 防御；迁移后 `\d` 抽查；若某个约束未被删除，创建部分索引时会出现"仅 active 行唯一 + 全局也唯一"的冗余（无害但需发现），迁移验证步骤专门检查 |
| 迁移后新代码回滚 | 迁移是加宽约束，旧代码（findUnique by slug）在**每值仍至多 1 行**时行为不变；仅当新代码运行期间制造了"同 slug 的 active 行 + 软删行并存"后回滚才可能报"多行匹配"。回滚顺序：回滚代码前不清理数据（保留迁移即可）；若必须还原 DB，先合并/清理软删重复行再重建全局唯一约束（提供回滚 SQL，见下） |
| 软删行堆积多个同值 | 无约束但**读路径全部带 `deletedAt: null`**，行为正确；后台审计按 id 查询不受影响；cover-assets 复活取最新一条已覆盖 |
| 并发创建同名 active 行 | 部分唯一索引在 DB 层拒绝，无窗口 ✅ |
| `prisma db pull` 回抽 schema | 会把部分索引当普通索引导入，可能丢失"部分唯一"语义——在 schema 注释 + Step 5 契约测试中双重提示 |

回滚 SQL（仅在必须还原 DB 时使用，先处理重复行）：

```sql
-- 示例：posts；其余表同理
DELETE FROM "posts" a USING "posts" b
WHERE a."slug" = b."slug" AND a."deletedAt" IS NOT NULL
  AND (b."deletedAt" IS NULL OR a."id" > b."id"); -- 保留 active/最小 id
DROP INDEX IF EXISTS "posts_slug_active_unique";
ALTER TABLE "posts" ADD CONSTRAINT "posts_slug_key" UNIQUE ("slug");
```

## 5. 验收标准

- [x] 软删文章后原 slug 可被新 active 记录使用；后台与 AI 日报写路径已按 active 语义适配
- [x] 软删分类/标签/系列/专题后，原 name/slug 可由新 active 记录使用
- [x] 两个 active 行仍不能同名（部分索引生效），P2002 返回字段级友好文案而非裸 "Conflict"
- [x] 封面素材：软删后重建保持"复活"语义
- [x] `pnpm test`、`pnpm lint`、`pnpm build` 全绿；迁移 SQL 契约测试存在
- [ ] `prisma migrate deploy` 在 CI 通过（工作流已切换，需提交后由外部 CI 实际运行）

> 仓库实现、迁移与数据库级事务回滚探针已完成；最后一项是外部 CI 验收，不能由当前未提交工作区证明。

## 6. 工作量估算

| 步骤 | 内容 | 预估 |
|---|---|---|
| Step 1-2 | schema 变更 + 迁移 SQL | 0.5d |
| Step 3 | 2 处查询改造 + 编译驱动排查 | 0.5d |
| Step 4 | 错误映射 | 0.25d |
| Step 5 | 契约/单元测试 | 0.5d |
| Step 6 | CI 对齐 | 0.25d |
| 验证 | 本地 + 手动验证路径 | 0.25d |
| **合计** | | **约 2~2.5 人日** |

## 7. 待审查决策点

1. **产品语义确认**：方案 A 下，"软删后的 slug/name 可被新内容直接占用"。是否接受？（不接受则需改用/叠加方案 B 的"墓碑期"策略）→ ✅ 已接受（2026-08-15）
2. **CoverAsset 特例**：该模型已采用"重建即复活"语义，是否保留？（建议保留，与 A 兼容）→ ✅ 已保留
3. **CI 切换 migrate deploy**（Step 6）：是否随本次一起做？→ ✅ 一起做（ci.yml 与 deploy.yml 均已切换）

## 8. 实施记录（2026-08-15）

变更文件清单：

| 文件 | 变更 |
|---|---|
| `prisma/schema.prisma` | 移除 8 处 `@unique`（Post.slug、Series.slug、Category.name/slug、Tag.name/slug、TopicGuide.slug、CoverAsset.url），补 6 个 `@@index`（slug/url） |
| `prisma/migrations/202608150001_soft_delete_partial_unique_indexes/migration.sql` | 新增：DROP 8 个旧全局唯一索引 + 建 8 个部分唯一索引（`WHERE "deletedAt" IS NULL`）+ 6 个普通索引 |
| `src/lib/ai-topic-radar.ts` | slug 生成循环 `findUnique` → `findFirst({ where: { slug, deletedAt: null } })` |
| `src/lib/cover-assets.ts` | 去重/复活逻辑重构：active 查重 + 软删复活（取最新一条）+ P2002 竞态兜底复活 |
| `src/lib/api-errors.ts` | 新增 `getPrismaConflictTarget` / `getPrismaConflictMessage`，P2002 按冲突字段返回友好文案 |
| `src/lib/__tests__/soft-delete-unique-migration.test.ts` | 新增契约测试：迁移 SQL 与 schema 一致性（8 部分索引、DROP、无 `@unique` 回退） |
| `src/lib/__tests__/cover-assets.test.ts` | mock 迁至 findFirst，新增"软删复活"用例 |
| `src/lib/__tests__/api-errors.test.ts` | 新增 P2002 目标提取与文案映射 4 个用例 |
| `src/lib/__tests__/ai-topic-radar.test.ts` | mock 迁至 post.findFirst |
| `.github/workflows/ci.yml` | `prisma db push` → `prisma migrate deploy` |
| `.github/workflows/deploy.yml` | 构建库同步同样切换为 `migrate deploy` |

验证结果（2026-08-15）：
- ✅ `pnpm test`：248 文件 / 911 用例全绿
- ✅ `pnpm lint`：无错误
- ✅ `pnpm build`：编译 + 类型检查通过，276 页生成（文章页 SSG 正常）
- ✅ 数据库级验证：已于 2026-08-15 应用并验证——8 个 `*_active_unique` 部分唯一索引在位（indexdef 含 `WHERE ("deletedAt" IS NULL)`）、8 个旧全局唯一索引已移除；真实库探针证实重复 active slug 触发 P2002（pg 23505，约束 `posts_slug_active_unique`），且 meta.target 为空、字段经 `driverAdapterError.cause.constraint.fields` 解析，友好文案生效；探针以事务回滚执行，未落任何数据。
