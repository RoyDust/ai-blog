INSERT INTO "ai_news_sources"
  ("id", "type", "name", "url", "homepage", "category", "enabled", "weight", "minScore", "fetchLimit", "config", "createdAt", "updatedAt")
VALUES
  ('google-deepmind', 'RSS', 'Google DeepMind', 'https://deepmind.google/blog/rss.xml', 'https://deepmind.google/blog/', 'official', true, 108, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('aws-machine-learning', 'RSS', 'AWS Machine Learning Blog', 'https://aws.amazon.com/blogs/machine-learning/feed/', 'https://aws.amazon.com/blogs/machine-learning/', 'enterprise', true, 94, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('bair-blog', 'RSS', 'Berkeley AI Research Blog', 'https://bair.berkeley.edu/blog/feed.xml', 'https://bair.berkeley.edu/blog/', 'research', true, 92, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('mit-ai-news', 'RSS', 'MIT AI News', 'https://news.mit.edu/rss/topic/machine-learning', 'https://news.mit.edu/topic/machine-learning', 'research', true, 90, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('simon-willison', 'RSS', 'Simon Willison', 'https://simonwillison.net/atom/everything/', 'https://simonwillison.net/', 'practitioner', true, 88, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('latent-space', 'RSS', 'Latent Space', 'https://www.latent.space/feed', 'https://www.latent.space/', 'practitioner', true, 78, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('infoq-ai-ml', 'RSS', 'InfoQ AI, ML & Data Engineering', 'https://feed.infoq.com/ai-ml-data-eng', 'https://www.infoq.com/ai-ml-data-eng/', 'engineering', true, 76, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('github-ollama', 'GITHUB_RELEASES', 'Ollama Releases', 'https://github.com/ollama/ollama', 'https://github.com/ollama/ollama', 'github-release', true, 48, NULL, 5, '{"owner":"ollama","repo":"ollama"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

UPDATE "ai_news_sources"
SET
  "url" = 'https://venturebeat.com/feed/',
  "homepage" = 'https://venturebeat.com/',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'venturebeat-ai'
  AND "url" = 'https://venturebeat.com/category/ai/feed/';

UPDATE "ai_news_sources"
SET
  "enabled" = false,
  "config" = COALESCE("config", '{}'::jsonb) || '{"disabledReason":"Node fetch and feedparser both timed out during source validation on 2026-08-08; re-enable after a reachable official feed is verified."}'::jsonb,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'hugging-face'
  AND "url" = 'https://huggingface.co/blog/feed.xml'
  AND "updatedAt" = "createdAt";

UPDATE "ai_news_sources"
SET
  "url" = 'https://news.mit.edu/rss/topic/machine-learning',
  "homepage" = 'https://news.mit.edu/topic/machine-learning',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'mit-ai-news'
  AND "url" = 'https://news.mit.edu/rss/topic/artificial-intelligence2';
