CREATE TABLE "ai_models" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'openai-compatible',
    "baseUrl" TEXT NOT NULL,
    "requestPath" TEXT NOT NULL DEFAULT '/chat/completions',
    "model" TEXT NOT NULL,
    "apiKey" TEXT,
    "capabilities" TEXT[] NOT NULL DEFAULT ARRAY['post-summary']::TEXT[],
    "isDefaultForSummary" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastTestedAt" TIMESTAMP(3),
    "lastTestStatus" TEXT,
    "lastTestMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_models_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_models_enabled_idx" ON "ai_models"("enabled");
CREATE INDEX "ai_models_isDefaultForSummary_idx" ON "ai_models"("isDefaultForSummary");
CREATE UNIQUE INDEX "ai_models_enabled_default_summary_unique_idx" ON "ai_models"((true)) WHERE "isDefaultForSummary" = true AND "enabled" = true;
