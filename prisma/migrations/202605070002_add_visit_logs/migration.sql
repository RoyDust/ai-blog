CREATE TABLE "visit_logs" (
  "id" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "postId" TEXT,
  "referrer" TEXT,
  "userAgent" TEXT,
  "ipHash" TEXT,
  "visitorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "visit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "visit_logs_createdAt_idx" ON "visit_logs"("createdAt");
CREATE INDEX "visit_logs_path_idx" ON "visit_logs"("path");
CREATE INDEX "visit_logs_postId_idx" ON "visit_logs"("postId");
CREATE INDEX "visit_logs_visitorId_idx" ON "visit_logs"("visitorId");

ALTER TABLE "visit_logs"
ADD CONSTRAINT "visit_logs_postId_fkey"
FOREIGN KEY ("postId") REFERENCES "posts"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
