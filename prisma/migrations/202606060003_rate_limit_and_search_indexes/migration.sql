CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS "rate_limit_entries" (
  "key" TEXT PRIMARY KEY,
  "count" INTEGER NOT NULL,
  "reset_at" TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS "rate_limit_entries_reset_at_idx" ON "rate_limit_entries" ("reset_at");
CREATE INDEX IF NOT EXISTS "posts_title_trgm_idx" ON "posts" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "posts_excerpt_trgm_idx" ON "posts" USING GIN ("excerpt" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "posts_content_trgm_idx" ON "posts" USING GIN ("content" gin_trgm_ops);
