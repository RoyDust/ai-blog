-- 软删除模型（posts / series / categories / tags / topic_guides / cover_assets）
-- 的 slug / name / url 唯一约束从"全局唯一"降为"仅 active 行唯一"：
-- 软删记录不再占用唯一值，重建同名内容不再触发 P2002。
--
-- 说明：
-- - 部分唯一索引无法在 Prisma schema 中声明，故在此手写维护；
--   对应契约测试见 src/lib/__tests__/soft-delete-unique-migration.test.ts。
-- - 旧唯一约束均以 CREATE UNIQUE INDEX 形式由 Prisma 生成，用 DROP INDEX 移除。
-- - 同时补建普通索引（对应 schema 新增的 @@index），保持按 slug / url 查询性能。
--
-- ⚠️ migrate dev 漂移警示：这些 *_active_unique 索引对 Prisma 不可见。
-- 任何 `prisma migrate dev` 都可能把数据库现状（含这些索引）与迁移历史
-- 对比后生成"删除索引"的漂移迁移。约定：
--   1) 结构变更只用 `prisma migrate dev --create-only`，人工复核生成的 SQL；
--   2) 若迁移中出现 DROP INDEX ... _active_unique，必须删除这些语句；
--   3) 禁止对整个迁移链执行 `prisma migrate reset` 后不经复核直接部署。

-- posts
DROP INDEX IF EXISTS "posts_slug_key";
CREATE UNIQUE INDEX IF NOT EXISTS "posts_slug_active_unique" ON "posts" ("slug") WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "posts_slug_idx" ON "posts" ("slug");

-- series
DROP INDEX IF EXISTS "series_slug_key";
CREATE UNIQUE INDEX IF NOT EXISTS "series_slug_active_unique" ON "series" ("slug") WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "series_slug_idx" ON "series" ("slug");

-- categories（name 与 slug 双唯一）
DROP INDEX IF EXISTS "categories_name_key";
DROP INDEX IF EXISTS "categories_slug_key";
CREATE UNIQUE INDEX IF NOT EXISTS "categories_name_active_unique" ON "categories" ("name") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "categories_slug_active_unique" ON "categories" ("slug") WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "categories_slug_idx" ON "categories" ("slug");

-- tags（name 与 slug 双唯一）
DROP INDEX IF EXISTS "tags_name_key";
DROP INDEX IF EXISTS "tags_slug_key";
CREATE UNIQUE INDEX IF NOT EXISTS "tags_name_active_unique" ON "tags" ("name") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "tags_slug_active_unique" ON "tags" ("slug") WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "tags_slug_idx" ON "tags" ("slug");

-- topic_guides
DROP INDEX IF EXISTS "topic_guides_slug_key";
CREATE UNIQUE INDEX IF NOT EXISTS "topic_guides_slug_active_unique" ON "topic_guides" ("slug") WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "topic_guides_slug_idx" ON "topic_guides" ("slug");

-- cover_assets
DROP INDEX IF EXISTS "cover_assets_url_key";
CREATE UNIQUE INDEX IF NOT EXISTS "cover_assets_url_active_unique" ON "cover_assets" ("url") WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "cover_assets_url_idx" ON "cover_assets" ("url");
