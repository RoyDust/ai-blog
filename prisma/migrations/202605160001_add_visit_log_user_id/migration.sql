ALTER TABLE "visit_logs"
ADD COLUMN "userId" TEXT;

CREATE INDEX "visit_logs_userId_createdAt_idx" ON "visit_logs"("userId", "createdAt");
CREATE INDEX "visit_logs_userId_postId_createdAt_idx" ON "visit_logs"("userId", "postId", "createdAt");

ALTER TABLE "visit_logs"
ADD CONSTRAINT "visit_logs_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
