/**
 * AI 日报子系统的唯一公共入口。
 *
 * app 层（route handler / 页面）只允许从 `@/lib/ai-news` 导入本子系统，
 * 禁止深路径引用子模块内部文件；lib 内部与测试可以用深路径。
 * 边界由 src/lib/__tests__/ai-news-boundary-contract.test.ts 锁定。
 */
export { listAiNewsRunCandidates } from "@/lib/ai-news/candidates"
export {
  generateDailyAiNewsDraft,
  type AiNewsGeneratorModel,
  type DailyAiNewsDraft,
} from "@/lib/ai-news/draft-flow"
export {
  notifyDailyAiNewsFailure,
  notifyDailyAiNewsSuccess,
} from "@/lib/ai-news/notifications"
export {
  buildDailyAiNewsSlug,
  dedupeNewsItems,
  parseNewsFeed,
  type AiNewsItem,
  type AiNewsSource,
} from "@/lib/ai-news/parser"
export {
  createAiNewsSource,
  deleteAiNewsSource,
  listAiNewsSources,
  testAiNewsSource,
  toPublicAiNewsSource,
  updateAiNewsSource,
  type PublicAiNewsSource,
} from "@/lib/ai-news/source-admin"
export { FALLBACK_DAILY_AI_NEWS_SOURCES } from "@/lib/ai-news/sources"
export type { AiNewsSourceConfig, AiNewsSourceType } from "@/lib/ai-news/types"
export { DEFAULT_AI_NEWS_SOURCES, DAILY_AI_NEWS_SOURCES } from "@/lib/ai-news/default-sources"
export type { AiNewsRunRepository } from "@/lib/ai-news/run/steps"
export {
  fetchDailyAiNewsCandidates,
  runDailyAiNews,
  type DailyAiNewsRunResult,
} from "@/lib/ai-news/run/entry"
