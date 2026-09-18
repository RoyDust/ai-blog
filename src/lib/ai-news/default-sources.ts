/**
 * AI 新闻默认来源清单（单一事实来源）。
 *
 * 历史 run-flow 与 sources 侧各持有一份默认清单且已漂移（enabled 状态不一致、
 * Ollama 源类型一边标 RSS 一边标 GITHUB_RELEASES），现收敛为本模块导出的
 * DEFAULT_AI_NEWS_SOURCES（AiNewsSourceConfig 形态）：
 * - enabled 以 sources 侧为准：anthropic / meta-ai / hugging-face 默认禁用
 * - ollama 采用 GITHUB_RELEASES 类型及其 config（fetchLimit 5、weight 0）
 * 数据库 AiNewsSource 表继续作为运行时覆盖（DB 有配置则优先），行为不变。
 */
import type { AiNewsSource } from "@/lib/ai-news/parser"
import type { AiNewsSourceConfig } from "@/lib/ai-news/types"

export const DEFAULT_AI_NEWS_SOURCES: AiNewsSourceConfig[] = [
  {
    id: "openai",
    type: "RSS",
    name: "OpenAI Blog",
    url: "https://openai.com/news/rss.xml",
    homepage: "https://openai.com/news/",
    enabled: true,
    weight: 15,
  },
  {
    id: "anthropic",
    type: "RSS",
    name: "Anthropic News",
    url: "https://www.anthropic.com/news/rss.xml",
    homepage: "https://www.anthropic.com/news",
    enabled: false,
    weight: 14,
  },
  {
    id: "google-deepmind",
    type: "RSS",
    name: "Google DeepMind",
    url: "https://deepmind.google/blog/rss.xml",
    homepage: "https://deepmind.google/blog/",
    category: "official",
    enabled: true,
    weight: 13,
  },
  {
    id: "google-ai",
    type: "RSS",
    name: "Google AI",
    url: "https://blog.google/technology/ai/rss/",
    homepage: "https://blog.google/technology/ai/",
    enabled: true,
    weight: 12,
  },
  {
    id: "meta-ai",
    type: "RSS",
    name: "Meta AI",
    url: "https://ai.meta.com/blog/rss/",
    homepage: "https://ai.meta.com/blog/",
    enabled: false,
    weight: 11,
  },
  {
    id: "aws-machine-learning",
    type: "RSS",
    name: "AWS Machine Learning Blog",
    url: "https://aws.amazon.com/blogs/machine-learning/feed/",
    homepage: "https://aws.amazon.com/blogs/machine-learning/",
    category: "enterprise",
    enabled: true,
    weight: 10,
  },
  {
    id: "bair-blog",
    type: "RSS",
    name: "Berkeley AI Research Blog",
    url: "https://bair.berkeley.edu/blog/feed.xml",
    homepage: "https://bair.berkeley.edu/blog/",
    category: "research",
    enabled: true,
    weight: 9,
  },
  {
    id: "mit-ai-news",
    type: "RSS",
    name: "MIT AI News",
    url: "https://news.mit.edu/rss/topic/machine-learning",
    homepage: "https://news.mit.edu/topic/machine-learning",
    category: "research",
    enabled: true,
    weight: 8,
  },
  {
    id: "simon-willison",
    type: "RSS",
    name: "Simon Willison",
    url: "https://simonwillison.net/atom/everything/",
    homepage: "https://simonwillison.net/",
    category: "practitioner",
    enabled: true,
    weight: 7,
  },
  {
    id: "hugging-face",
    type: "RSS",
    name: "Hugging Face Blog",
    url: "https://huggingface.co/blog/feed.xml",
    homepage: "https://huggingface.co/blog",
    enabled: false,
    weight: 6,
  },
  {
    id: "techcrunch-ai",
    type: "RSS",
    name: "TechCrunch AI",
    url: "https://techcrunch.com/category/artificial-intelligence/feed/",
    homepage: "https://techcrunch.com/category/artificial-intelligence/",
    enabled: true,
    weight: 5,
  },
  {
    id: "latent-space",
    type: "RSS",
    name: "Latent Space",
    url: "https://www.latent.space/feed",
    homepage: "https://www.latent.space/",
    category: "practitioner",
    enabled: true,
    weight: 4,
  },
  {
    id: "infoq-ai-ml",
    type: "RSS",
    name: "InfoQ AI, ML & Data Engineering",
    url: "https://feed.infoq.com/ai-ml-data-eng",
    homepage: "https://www.infoq.com/ai-ml-data-eng/",
    category: "engineering",
    enabled: true,
    weight: 3,
  },
  {
    id: "venturebeat-ai",
    type: "RSS",
    name: "VentureBeat AI",
    url: "https://venturebeat.com/feed/",
    homepage: "https://venturebeat.com/",
    enabled: true,
    weight: 2,
  },
  {
    id: "the-decoder",
    type: "RSS",
    name: "The Decoder",
    url: "https://the-decoder.com/feed/",
    homepage: "https://the-decoder.com/",
    enabled: true,
    weight: 1,
  },
  {
    id: "github-ollama",
    type: "GITHUB_RELEASES",
    name: "Ollama Releases",
    url: "https://github.com/ollama/ollama",
    homepage: "https://github.com/ollama/ollama",
    category: "github-release",
    enabled: true,
    weight: 0,
    fetchLimit: 5,
    config: { owner: "ollama", repo: "ollama" },
  },
]

/**
 * 派生的 legacy 视图（AiNewsSource 形态），供 fetchDailyAiNewsCandidates
 * 默认参数等旧签名消费方使用。GITHUB_RELEASES 源沿用历史 run-flow 清单的
 * 映射约定：legacy feedUrl 取 `${url}/releases.atom`（Atom 订阅地址），
 * 与 origin/main 历史值一致；其余源 feedUrl 直接映射 url。
 */
export const DAILY_AI_NEWS_SOURCES: AiNewsSource[] = DEFAULT_AI_NEWS_SOURCES.map(({ id, name, url, homepage, type }) => ({
  id,
  name,
  feedUrl: type === "GITHUB_RELEASES" ? `${url}/releases.atom` : url,
  homepage: homepage ?? undefined,
}))
