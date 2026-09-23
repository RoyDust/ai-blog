-- 修复 schema/迁移漂移：a65d588（2026-04-15）在 schema.prisma 中新增了
-- posts.featured 字段与 @@index([featured, createdAt])，但没有生成迁移文件。
-- 本地/生产库当时通过 db push 或手工 ALTER 获得了该列，导致
-- `prisma migrate deploy` 从零建库时（CI）缺列报错：
--   The column `featured` does not exist in the current database.
--
-- 本迁移用 pg_catalog 探测守卫，保证：
-- - 从零建库（CI / 新环境）：正常添加列与索引；
-- - 已有手工加列的库（本地 / 生产）：直接跳过，不报错，正常登记迁移记录。

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public."posts"'::regclass
      AND attname = 'featured'
      AND NOT attisdropped
  ) THEN
    ALTER TABLE "posts" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

DROP INDEX IF EXISTS "posts_featured_createdAt_idx";
CREATE INDEX IF NOT EXISTS "posts_featured_createdAt_idx" ON "posts" ("featured", "createdAt");
