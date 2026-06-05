ALTER TABLE "cover_assets"
ADD COLUMN "generatedByAi" BOOLEAN NOT NULL DEFAULT false;

UPDATE "cover_assets"
SET "generatedByAi" = true
WHERE "source" = 'ai'
   OR "aiModelId" IS NOT NULL
   OR "aiPrompt" IS NOT NULL;

CREATE INDEX "cover_assets_generatedByAi_createdAt_idx" ON "cover_assets"("generatedByAi", "createdAt");
