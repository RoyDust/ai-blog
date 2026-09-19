/**
 * AI 日报编排的可调参数。
 *
 * 集中持有 run 流水线的 env 阈值常量与读取辅助，
 * 便于一眼看清整条流水线有哪些可调参数：
 * - AI_NEWS_MAX_SELECTED_CANDIDATES：单次运行最多入选的候选数
 * - AI_NEWS_MAX_CANDIDATES_TO_SCORE：最多送去 AI 评分的候选数
 * - AI_NEWS_MAX_FACT_CARDS：最多生成事实卡的候选数
 * - AI_NEWS_AI_CONCURRENCY：AI 请求的并发上限
 * - AI_NEWS_SCORE_THRESHOLD：入选的最低评分阈值
 */

export type AiNewsRunTriggerInput = "manual" | "cron"
export type AiNewsRunStatusValue = "RUNNING" | "SUCCEEDED" | "FAILED" | "SKIPPED"
export type AiNewsSourceMode = "default" | "selected"

export function readPositiveIntegerEnv(key: string, fallback: number) {
  const value = Number(process.env[key])
  return Number.isInteger(value) && value > 0 ? value : fallback
}

export function readScoreThresholdEnv(key: string, fallback: number) {
  const value = Number(process.env[key])
  return Number.isFinite(value) && value >= 0 && value <= 10 ? value : fallback
}

export const MAX_CANDIDATES_FOR_AI = readPositiveIntegerEnv("AI_NEWS_MAX_SELECTED_CANDIDATES", 20)
export const MAX_CANDIDATES_TO_SCORE = readPositiveIntegerEnv("AI_NEWS_MAX_CANDIDATES_TO_SCORE", 24)
export const MAX_FACT_CARDS = readPositiveIntegerEnv("AI_NEWS_MAX_FACT_CARDS", 12)
export const AI_NEWS_AI_CONCURRENCY = readPositiveIntegerEnv("AI_NEWS_AI_CONCURRENCY", 3)
export const AI_NEWS_SCORE_THRESHOLD = readScoreThresholdEnv("AI_NEWS_SCORE_THRESHOLD", 7)
export const RECENT_WINDOW_MS = 48 * 60 * 60 * 1000
