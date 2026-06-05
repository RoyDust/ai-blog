UPDATE "posts"
SET "generatedByAiNews" = true
WHERE "generatedByAiNews" = false
  AND "id" IN (
    SELECT DISTINCT "postId"
    FROM "ai_news_runs"
    WHERE "postId" IS NOT NULL
  );
