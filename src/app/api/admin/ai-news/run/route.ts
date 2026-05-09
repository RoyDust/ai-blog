import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/api-auth"
import { runDailyAiNews } from "@/lib/ai-news"
import { notifyDailyAiNewsFailure, notifyDailyAiNewsSuccess } from "@/lib/ai-news-notifications"
import { toErrorResponse, ValidationError } from "@/lib/api-errors"
import { prisma } from "@/lib/prisma"

type AiNewsRunDelegate = typeof prisma.aiNewsRun
type PrismaWithOptionalAiNewsRun = typeof prisma & {
  aiNewsRun?: AiNewsRunDelegate
}

/**
 * 解析每日 AI 新闻运行日期。
 */
function parseRunDate(value: unknown) {
  if (value == null || value === "") return new Date()
  if (typeof value !== "string") throw new ValidationError("Invalid date")

  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00.000Z`) : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError("Invalid date")
  }

  return date
}

/**
 * 解析可选模型 id。
 */
function parseModelId(value: unknown) {
  if (value == null || value === "") return null
  if (typeof value !== "string") throw new ValidationError("Invalid model")

  return value.trim() || null
}

/**
 * 解析是否强制重新生成。
 */
function parseRegenerate(value: unknown) {
  if (value == null) return false
  if (typeof value !== "boolean") throw new ValidationError("Invalid regenerate flag")

  return value
}

/**
 * 手动触发每日 AI 新闻生成。
 *
 * 成功或失败都会写入后台通知，便于管理员从通知中心回看任务结果。
 */
export async function POST(request: Request) {
  let runDate: Date | null = null
  let notifyFailure = false

  try {
    const session = await requireAdminSession()
    const body = await request.json().catch(() => ({}))
    const payload = body as { date?: unknown; modelId?: unknown; regenerate?: unknown }
    const date = parseRunDate(payload.date)
    const modelId = parseModelId(payload.modelId)
    const regenerate = parseRegenerate(payload.regenerate)
    runDate = date
    notifyFailure = true
    const result = await runDailyAiNews({ authorId: session.user.id, date, modelId, regenerate, trigger: "manual" })

    await notifyDailyAiNewsSuccess(result, date)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    if (notifyFailure && runDate) {
      await notifyDailyAiNewsFailure(runDate, error)
    }

    return toErrorResponse(error, error instanceof Error ? error.message : "Daily AI news generation failed")
  }
}

/**
 * 查询最近的每日 AI 新闻运行记录。
 *
 * 兼容 aiNewsRun delegate 尚未生成的环境，临时回退到原始 SQL。
 */
export async function GET() {
  try {
    await requireAdminSession()
    const aiNewsRun = (prisma as PrismaWithOptionalAiNewsRun).aiNewsRun
    const runs = aiNewsRun
      ? await aiNewsRun.findMany({
          orderBy: { createdAt: "desc" },
          take: 20,
        })
      : await prisma.$queryRawUnsafe(`
          SELECT
            "id",
            "runDate",
            "trigger",
            "status",
            "sourceCount",
            "failureCount",
            "rawCandidateCount",
            "dedupedCandidateCount",
            "scoredCandidateCount",
            "selectedCandidateCount",
            "sourceFailureJson",
            "qualityScore",
            "citationCoverage",
            "generationMode",
            "error",
            "postId",
            "postTitle",
            "postSlug",
            "published",
            "reviewVerdict",
            "reviewScore",
            "reviewSummary",
            "startedAt",
            "finishedAt",
            "durationMs",
            "createdAt",
            "updatedAt"
          FROM "ai_news_runs"
          ORDER BY "createdAt" DESC
          LIMIT 20
        `)

    return NextResponse.json({ success: true, data: runs })
  } catch (error) {
    return toErrorResponse(error, error instanceof Error ? error.message : "Failed to load daily AI news runs")
  }
}
