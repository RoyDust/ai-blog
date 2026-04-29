import { NextResponse } from "next/server"

import { runDailyAiNews } from "@/lib/ai-news"
import { toErrorResponse, UnauthorizedError, ValidationError } from "@/lib/api-errors"
import { prisma } from "@/lib/prisma"

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

export async function POST(request: Request) {
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

    const result = await runDailyAiNews({ authorId: author.id, date: parseRunDate(request) })
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return toErrorResponse(error, error instanceof Error ? error.message : "Daily AI news cron failed")
  }
}
