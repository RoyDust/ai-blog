import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NextResponse } from "next/server"

import { runDailyAiNews } from "@/lib/ai-news"
import { notifyDailyAiNewsFailure, notifyDailyAiNewsSuccess } from "@/lib/ai-news-notifications"
import { toErrorResponse, UnauthorizedError, ValidationError } from "@/lib/api-errors"
import { prisma } from "@/lib/prisma"

const activeRuns = new Set<string>()

function requireCronSecret(request: Request) {
  const configuredSecret = process.env.AI_NEWS_CRON_SECRET?.trim()
  if (!configuredSecret) {
    throw new Error("AI_NEWS_CRON_SECRET is not configured")
  }

  const authorization = request.headers.get("authorization") ?? ""
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  if (token !== configuredSecret) {
    throw new UnauthorizedError()
  }
}

function parseRunDate(request: Request) {
  const value = new URL(request.url).searchParams.get("date")
  if (!value) return new Date()

  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00.000Z`) : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError("Invalid date")
  }

  return date
}

function parseRegenerate(request: Request) {
  const value = new URL(request.url).searchParams.get("regenerate")
  if (value == null || value === "") return false
  return value === "1" || value.toLowerCase() === "true"
}

function formatDateId(date: Date) {
  return date.toISOString().slice(0, 10)
}

function queueDailyAiNewsRun({ authorId, date, regenerate }: { authorId: string; date: Date; regenerate: boolean }) {
  const dateId = formatDateId(date)
  if (activeRuns.has(dateId)) {
    return { operation: "already-queued" as const, date: dateId }
  }

  activeRuns.add(dateId)
  void (async () => {
    try {
      const result = await runDailyAiNews({ authorId, date, regenerate, trigger: "cron" })
      try {
        await notifyDailyAiNewsSuccess(result, date)
      } catch (error) {
        console.error("Daily AI news success notification failed:", error)
      }
    } catch (error) {
      try {
        await notifyDailyAiNewsFailure(date, error)
      } catch (notificationError) {
        console.error("Daily AI news failure notification failed:", notificationError)
      }
      console.error("Daily AI news cron failed:", error)
    } finally {
      activeRuns.delete(dateId)
    }
  })()

  return { operation: "queued" as const, date: dateId }
}

async function POSTHandler(request: Request) {
  try {
    requireCronSecret(request)

    const author = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    })

    if (!author) {
      throw new Error("No admin author available for daily AI news")
    }

    const result = queueDailyAiNewsRun({ authorId: author.id, date: parseRunDate(request), regenerate: parseRegenerate(request) })
    return NextResponse.json({ success: true, data: result }, { status: 202 })
  } catch (error) {
    return toErrorResponse(error, error instanceof Error ? error.message : "Daily AI news cron failed")
  }
}

export const POST = withApiOperationLogging(POSTHandler, { scope: 'cron', operation: 'cron.ainews.create', route: '/api/cron/ai-news' });
