CREATE TYPE "PostSummaryStatus" AS ENUM ('EMPTY', 'QUEUED', 'GENERATING', 'GENERATED', 'FAILED');

ALTER TABLE "posts"
ADD COLUMN "summaryStatus" "PostSummaryStatus" NOT NULL DEFAULT 'EMPTY',
ADD COLUMN "summaryError" TEXT,
ADD COLUMN "summaryGeneratedAt" TIMESTAMP(3),
ADD COLUMN "summaryJobId" TEXT,
ADD COLUMN "summaryModelId" TEXT;

UPDATE "posts"
SET
  "summaryStatus" = CASE
    WHEN "excerpt" IS NOT NULL AND btrim("excerpt") <> '' THEN 'GENERATED'::"PostSummaryStatus"
    ELSE 'EMPTY'::"PostSummaryStatus"
  END,
  "summaryGeneratedAt" = CASE
    WHEN "excerpt" IS NOT NULL AND btrim("excerpt") <> '' THEN "updatedAt"
    ELSE NULL
  END;

CREATE INDEX "posts_summaryStatus_idx" ON "posts"("summaryStatus");
CREATE INDEX "posts_summaryJobId_idx" ON "posts"("summaryJobId");
