UPDATE "ai_news_sources"
SET
  "enabled" = false,
  "config" = COALESCE("config", '{}'::jsonb) || '{"disabledReason":"No stable public RSS feed verified on 2026-05-06; keep disabled until an HTML fetcher or official feed is added."}'::jsonb,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" IN ('anthropic', 'meta-ai');
