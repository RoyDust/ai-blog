CREATE TABLE "series" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "coverImage" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "series_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "posts" ADD COLUMN "seriesId" TEXT;
ALTER TABLE "posts" ADD COLUMN "seriesOrder" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "series_slug_key" ON "series"("slug");
CREATE INDEX "series_deletedAt_order_idx" ON "series"("deletedAt", "order");
CREATE INDEX "posts_seriesId_seriesOrder_idx" ON "posts"("seriesId", "seriesOrder");

ALTER TABLE "posts"
ADD CONSTRAINT "posts_seriesId_fkey"
FOREIGN KEY ("seriesId") REFERENCES "series"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
