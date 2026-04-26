CREATE TABLE "cover_assets" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'qiniu',
    "source" TEXT NOT NULL DEFAULT 'upload',
    "status" TEXT NOT NULL DEFAULT 'active',
    "title" TEXT,
    "alt" TEXT,
    "description" TEXT,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "width" INTEGER,
    "height" INTEGER,
    "blurDataUrl" TEXT,
    "aiPrompt" TEXT,
    "aiModelId" TEXT,
    "metadata" JSONB,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "cover_assets_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "posts"
ADD COLUMN "coverAssetId" TEXT;

CREATE UNIQUE INDEX "cover_assets_url_key" ON "cover_assets"("url");
CREATE INDEX "cover_assets_status_createdAt_idx" ON "cover_assets"("status", "createdAt");
CREATE INDEX "cover_assets_source_createdAt_idx" ON "cover_assets"("source", "createdAt");
CREATE INDEX "cover_assets_deletedAt_idx" ON "cover_assets"("deletedAt");
CREATE INDEX "posts_coverAssetId_idx" ON "posts"("coverAssetId");

ALTER TABLE "posts"
ADD CONSTRAINT "posts_coverAssetId_fkey"
FOREIGN KEY ("coverAssetId") REFERENCES "cover_assets"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
