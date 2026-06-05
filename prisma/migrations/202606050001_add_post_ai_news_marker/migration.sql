ALTER TABLE "posts"
ADD COLUMN "generatedByAiNews" BOOLEAN NOT NULL DEFAULT false;

UPDATE "posts"
SET "generatedByAiNews" = true
WHERE "id" IN (
  SELECT DISTINCT "postId"
  FROM "ai_news_runs"
  WHERE "postId" IS NOT NULL
);

CREATE INDEX "posts_generatedByAiNews_createdAt_idx" ON "posts"("generatedByAiNews", "createdAt");
