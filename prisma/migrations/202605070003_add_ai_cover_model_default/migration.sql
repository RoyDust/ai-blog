ALTER TABLE "ai_models" ADD COLUMN "isDefaultForCoverImage" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "ai_models_isDefaultForCoverImage_idx" ON "ai_models"("isDefaultForCoverImage");
