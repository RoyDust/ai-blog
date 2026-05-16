ALTER TABLE "posts" ADD COLUMN "scheduledAt" TIMESTAMP(3);

CREATE INDEX "posts_published_scheduledAt_idx" ON "posts"("published", "scheduledAt");
