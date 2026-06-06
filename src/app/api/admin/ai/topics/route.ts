import { withApiOperationLogging } from "@/lib/api-operation-log-route"
import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/api-auth"
import { listAiTopics, materializeTopicsFromRecentCandidates } from "@/lib/ai-topic-radar"
import { toErrorResponse, ValidationError } from "@/lib/api-errors"

function parseDays(value: string | null) {
  if (!value) return 7

  const days = Number(value)
  if (!Number.isInteger(days) || days <= 0 || days > 90) {
    throw new ValidationError("Invalid days")
  }

  return days
}

function parseExcludeSelected(value: unknown) {
  if (value == null) return false
  if (typeof value !== "boolean") throw new ValidationError("Invalid excludeSelected")

  return value
}

async function GETHandler(request: Request) {
  try {
    await requireAdminSession()
    const { searchParams } = new URL(request.url)
    const data = await listAiTopics({ status: searchParams.get("status") })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return toErrorResponse(error, error instanceof Error ? error.message : "Failed to load AI topics")
  }
}

async function POSTHandler(request: Request) {
  try {
    await requireAdminSession()
    const body = await request.json().catch(() => ({}))
    const payload = body as { days?: unknown; excludeSelected?: unknown }
    const days = typeof payload.days === "string" || typeof payload.days === "number" ? parseDays(String(payload.days)) : 7
    const data = await materializeTopicsFromRecentCandidates({
      days,
      excludeSelected: parseExcludeSelected(payload.excludeSelected),
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return toErrorResponse(error, error instanceof Error ? error.message : "Failed to generate AI topics")
  }
}

export const GET = withApiOperationLogging(GETHandler, { scope: "admin", operation: "admin.ai.topics.read", route: "/api/admin/ai/topics" })
export const POST = withApiOperationLogging(POSTHandler, { scope: "admin", operation: "admin.ai.topics.create", route: "/api/admin/ai/topics" })
