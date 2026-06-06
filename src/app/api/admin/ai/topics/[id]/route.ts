import { withApiOperationLogging } from "@/lib/api-operation-log-route"
import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/api-auth"
import { getAiTopic, updateAiTopic } from "@/lib/ai-topic-radar"
import { toErrorResponse, ValidationError } from "@/lib/api-errors"

type RouteContext = {
  params: Promise<{ id: string }>
}

function parseTopicPatch(payload: unknown) {
  const data = (payload ?? {}) as { status?: unknown; summary?: unknown; angle?: unknown }

  for (const key of ["status", "summary", "angle"] as const) {
    if (data[key] !== undefined && data[key] !== null && typeof data[key] !== "string") {
      throw new ValidationError(`Invalid ${key}`)
    }
  }

  return {
    status: data.status as string | null | undefined,
    summary: data.summary as string | null | undefined,
    angle: data.angle as string | null | undefined,
  }
}

async function GETHandler(_request: Request, context: RouteContext) {
  try {
    await requireAdminSession()
    const { id } = await context.params
    const data = await getAiTopic(id)

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return toErrorResponse(error, error instanceof Error ? error.message : "Failed to load AI topic")
  }
}

async function PATCHHandler(request: Request, context: RouteContext) {
  try {
    await requireAdminSession()
    const { id } = await context.params
    const data = await updateAiTopic(id, parseTopicPatch(await request.json().catch(() => ({}))))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return toErrorResponse(error, error instanceof Error ? error.message : "Failed to update AI topic")
  }
}

async function DELETEHandler(_request: Request, context: RouteContext) {
  try {
    await requireAdminSession()
    const { id } = await context.params
    const data = await updateAiTopic(id, { status: "ARCHIVED" })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return toErrorResponse(error, error instanceof Error ? error.message : "Failed to archive AI topic")
  }
}

export const GET = withApiOperationLogging(GETHandler, { scope: "admin", operation: "admin.ai.topics.byId.read", route: "/api/admin/ai/topics/[id]" })
export const PATCH = withApiOperationLogging(PATCHHandler, { scope: "admin", operation: "admin.ai.topics.byId.update", route: "/api/admin/ai/topics/[id]" })
export const DELETE = withApiOperationLogging(DELETEHandler, { scope: "admin", operation: "admin.ai.topics.byId.delete", route: "/api/admin/ai/topics/[id]" })
