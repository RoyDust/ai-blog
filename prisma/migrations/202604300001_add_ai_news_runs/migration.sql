CREATE TYPE "AiNewsRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED');
CREATE TYPE "AiNewsRunTrigger" AS ENUM ('MANUAL', 'CRON');

CREATE TABLE "ai_news_runs" (
  "id" TEXT NOT NULL,
  "runDate" TIMESTAMP(3) NOT NULL,
  "trigger" "AiNewsRunTrigger" NOT NULL,
  "status" "AiNewsRunStatus" NOT NULL DEFAULT 'RUNNING',
  "sourceCount" INTEGER NOT NULL DEFAULT 0,
  "failureCount" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "postId" TEXT,
  "postTitle" TEXT,
  "postSlug" TEXT,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "reviewVerdict" TEXT,
  "reviewScore" INTEGER,
  "reviewSummary" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_news_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_news_runs_createdAt_idx" ON "ai_news_runs"("createdAt");
CREATE INDEX "ai_news_runs_runDate_idx" ON "ai_news_runs"("runDate");
CREATE INDEX "ai_news_runs_status_idx" ON "ai_news_runs"("status");
