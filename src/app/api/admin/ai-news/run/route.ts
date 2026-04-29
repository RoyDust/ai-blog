import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/api-auth"
import { runDailyAiNews } from "@/lib/ai-news"
import { toErrorResponse, ValidationError } from "@/lib/api-errors"

function parseRunDate(value: unknown) {
  if (value == null || value === "") return new Date()
  if (typeof value !== "string") throw new ValidationError("Invalid date")

  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00.000Z`) : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError("Invalid date")
  }

  return date
}

export async function POST(request: Request) {
  try {
    const session = await requireAdminSession()
    const body = await request.json().catch(() => ({}))
    const date = parseRunDate((body as { date?: unknown }).date)
    const result = await runDailyAiNews({ authorId: session.user.id, date })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return toErrorResponse(error, error instanceof Error ? error.message : "Daily AI news generation failed")
  }
}
