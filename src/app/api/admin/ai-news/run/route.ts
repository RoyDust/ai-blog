import { withApiOperationLogging } from "@/lib/api-operation-log-route";
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

function parseRunDate(value: unknown) {
  if (value == null || value === "") return new Date()
  if (typeof value !== "string") throw new ValidationError("Invalid date")

  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00.000Z`) : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError("Invalid date")
  }

  return date
}

function parseModelId(value: unknown) {
  if (value == null || value === "") return null
  if (typeof value !== "string") throw new ValidationError("Invalid model")

  return value.trim() || null
}

function parseRegenerate(value: unknown) {
  if (value == null) return false
  if (typeof value !== "boolean") throw new ValidationError("Invalid regenerate flag")

  return value
}

async function POSTHandler(request: Request) {
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

async function GETHandler() {
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

export const POST = withApiOperationLogging(POSTHandler, { scope: 'admin', operation: 'admin.ainews.run.create', route: '/api/admin/ai-news/run' });
export const GET = withApiOperationLogging(GETHandler, { scope: 'admin', operation: 'admin.ainews.run.read', route: '/api/admin/ai-news/run' });
