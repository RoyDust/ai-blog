DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION
  WHEN undefined_file OR insufficient_privilege THEN
    RAISE NOTICE 'pg_trgm extension is unavailable; skipping trigram search indexes.';
END $$;

CREATE TABLE IF NOT EXISTS "rate_limit_entries" (
  "key" TEXT PRIMARY KEY,
  "count" INTEGER NOT NULL,
  "reset_at" TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS "rate_limit_entries_reset_at_idx" ON "rate_limit_entries" ("reset_at");

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "posts_title_trgm_idx" ON "posts" USING GIN ("title" gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS "posts_excerpt_trgm_idx" ON "posts" USING GIN ("excerpt" gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS "posts_content_trgm_idx" ON "posts" USING GIN ("content" gin_trgm_ops)';
  END IF;
END $$;
