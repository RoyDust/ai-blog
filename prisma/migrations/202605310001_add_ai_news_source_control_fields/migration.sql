ALTER TABLE "ai_news_runs"
ADD COLUMN "sourceSnapshotJson" JSONB;

ALTER TABLE "ai_news_sources"
ADD COLUMN "lastTestedAt" TIMESTAMP(3),
ADD COLUMN "lastTestStatus" TEXT,
ADD COLUMN "lastTestMessage" TEXT,
ADD COLUMN "lastFetchedItemCount" INTEGER;
