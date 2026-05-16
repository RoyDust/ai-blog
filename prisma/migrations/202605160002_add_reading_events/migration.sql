CREATE TABLE "reading_events" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "readDate" DATE NOT NULL,
  "durationSeconds" INTEGER NOT NULL DEFAULT 0,
  "scrollDepth" INTEGER NOT NULL DEFAULT 0,
  "qualified" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reading_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reading_events_userId_postId_readDate_key" ON "reading_events"("userId", "postId", "readDate");
CREATE INDEX "reading_events_userId_readDate_idx" ON "reading_events"("userId", "readDate");
CREATE INDEX "reading_events_userId_postId_idx" ON "reading_events"("userId", "postId");
CREATE INDEX "reading_events_postId_createdAt_idx" ON "reading_events"("postId", "createdAt");

ALTER TABLE "reading_events"
ADD CONSTRAINT "reading_events_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reading_events"
ADD CONSTRAINT "reading_events_postId_fkey"
FOREIGN KEY ("postId") REFERENCES "posts"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
