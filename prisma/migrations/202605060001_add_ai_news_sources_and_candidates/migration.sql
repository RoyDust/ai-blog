CREATE TYPE "AiNewsSourceType" AS ENUM ('RSS', 'HACKERNEWS', 'GITHUB_RELEASES', 'GITHUB_TRENDING_RSS', 'REDDIT');

ALTER TABLE "ai_news_runs"
ADD COLUMN "rawCandidateCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "dedupedCandidateCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "scoredCandidateCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "selectedCandidateCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "sourceFailureJson" JSONB,
ADD COLUMN "qualityScore" INTEGER,
ADD COLUMN "citationCoverage" DOUBLE PRECISION,
ADD COLUMN "generationMode" TEXT;

CREATE TABLE "ai_news_sources" (
  "id" TEXT NOT NULL,
  "type" "AiNewsSourceType" NOT NULL,
  "name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "homepage" TEXT,
  "category" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "weight" INTEGER NOT NULL DEFAULT 1,
  "minScore" INTEGER,
  "fetchLimit" INTEGER,
  "config" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_news_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_news_candidates" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "sourceId" TEXT,
  "sourceType" "AiNewsSourceType" NOT NULL,
  "sourceName" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "canonicalUrl" TEXT NOT NULL,
  "summary" TEXT,
  "content" TEXT,
  "author" TEXT,
  "publishedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "community" JSONB,
  "aiScore" DOUBLE PRECISION,
  "aiReason" TEXT,
  "aiSummary" TEXT,
  "aiTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "aiRiskFlags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "scoreError" TEXT,
  "duplicateOfId" TEXT,
  "selected" BOOLEAN NOT NULL DEFAULT false,
  "selectionReason" TEXT,
  "enrichment" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_news_candidates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_news_sources_enabled_type_idx" ON "ai_news_sources"("enabled", "type");
CREATE INDEX "ai_news_sources_category_idx" ON "ai_news_sources"("category");

INSERT INTO "ai_news_sources"
  ("id", "type", "name", "url", "homepage", "category", "enabled", "weight", "minScore", "fetchLimit", "config", "createdAt", "updatedAt")
VALUES
  ('openai', 'RSS', 'OpenAI Blog', 'https://openai.com/news/rss.xml', 'https://openai.com/news/', 'official', true, 120, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('anthropic', 'RSS', 'Anthropic News', 'https://www.anthropic.com/news/rss.xml', 'https://www.anthropic.com/news', 'official', true, 115, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('google-ai', 'RSS', 'Google AI', 'https://blog.google/technology/ai/rss/', 'https://blog.google/technology/ai/', 'official', true, 110, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('meta-ai', 'RSS', 'Meta AI', 'https://ai.meta.com/blog/rss/', 'https://ai.meta.com/blog/', 'official', true, 105, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hugging-face', 'RSS', 'Hugging Face Blog', 'https://huggingface.co/blog/feed.xml', 'https://huggingface.co/blog', 'developer', true, 100, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('techcrunch-ai', 'RSS', 'TechCrunch AI', 'https://techcrunch.com/category/artificial-intelligence/feed/', 'https://techcrunch.com/category/artificial-intelligence/', 'industry', true, 80, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('venturebeat-ai', 'RSS', 'VentureBeat AI', 'https://venturebeat.com/category/ai/feed/', 'https://venturebeat.com/category/ai/', 'industry', true, 75, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('the-decoder', 'RSS', 'The Decoder', 'https://the-decoder.com/feed/', 'https://the-decoder.com/', 'industry', true, 70, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hackernews-top', 'HACKERNEWS', 'Hacker News Top Stories', 'https://news.ycombinator.com/', 'https://news.ycombinator.com/', 'community', true, 65, 100, 20, '{"commentLimit":3,"commentTextMaxLength":500}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('github-openai-node', 'GITHUB_RELEASES', 'OpenAI Node SDK Releases', 'https://github.com/openai/openai-node', 'https://github.com/openai/openai-node', 'github-release', true, 55, NULL, 10, '{"owner":"openai","repo":"openai-node"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('github-anthropic-sdk-typescript', 'GITHUB_RELEASES', 'Anthropic TypeScript SDK Releases', 'https://github.com/anthropics/anthropic-sdk-typescript', 'https://github.com/anthropics/anthropic-sdk-typescript', 'github-release', true, 54, NULL, 10, '{"owner":"anthropics","repo":"anthropic-sdk-typescript"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('github-vercel-ai', 'GITHUB_RELEASES', 'Vercel AI SDK Releases', 'https://github.com/vercel/ai', 'https://github.com/vercel/ai', 'github-release', true, 53, NULL, 10, '{"owner":"vercel","repo":"ai"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('github-langchainjs', 'GITHUB_RELEASES', 'LangChain.js Releases', 'https://github.com/langchain-ai/langchainjs', 'https://github.com/langchain-ai/langchainjs', 'github-release', true, 52, NULL, 10, '{"owner":"langchain-ai","repo":"langchainjs"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('github-transformers', 'GITHUB_RELEASES', 'Transformers Releases', 'https://github.com/huggingface/transformers', 'https://github.com/huggingface/transformers', 'github-release', true, 51, NULL, 10, '{"owner":"huggingface","repo":"transformers"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('github-vllm', 'GITHUB_RELEASES', 'vLLM Releases', 'https://github.com/vllm-project/vllm', 'https://github.com/vllm-project/vllm', 'github-release', true, 50, NULL, 10, '{"owner":"vllm-project","repo":"vllm"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('github-llama-cpp', 'GITHUB_RELEASES', 'llama.cpp Releases', 'https://github.com/ggml-org/llama.cpp', 'https://github.com/ggml-org/llama.cpp', 'github-release', true, 49, NULL, 10, '{"owner":"ggml-org","repo":"llama.cpp"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

CREATE INDEX "ai_news_candidates_runId_idx" ON "ai_news_candidates"("runId");
CREATE INDEX "ai_news_candidates_sourceId_idx" ON "ai_news_candidates"("sourceId");
CREATE INDEX "ai_news_candidates_sourceType_idx" ON "ai_news_candidates"("sourceType");
CREATE INDEX "ai_news_candidates_canonicalUrl_idx" ON "ai_news_candidates"("canonicalUrl");
CREATE INDEX "ai_news_candidates_selected_idx" ON "ai_news_candidates"("selected");
CREATE INDEX "ai_news_candidates_duplicateOfId_idx" ON "ai_news_candidates"("duplicateOfId");

ALTER TABLE "ai_news_candidates"
ADD CONSTRAINT "ai_news_candidates_runId_fkey"
FOREIGN KEY ("runId") REFERENCES "ai_news_runs"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_news_candidates"
ADD CONSTRAINT "ai_news_candidates_sourceId_fkey"
FOREIGN KEY ("sourceId") REFERENCES "ai_news_sources"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_news_candidates"
ADD CONSTRAINT "ai_news_candidates_duplicateOfId_fkey"
FOREIGN KEY ("duplicateOfId") REFERENCES "ai_news_candidates"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
