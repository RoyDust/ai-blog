import { withApiOperationLogging } from "@/lib/api-operation-log-route"
import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/api-auth"
import { createDraftFromTopic } from "@/lib/ai-topic-radar"
import { toErrorResponse } from "@/lib/api-errors"

type RouteContext = {
  params: Promise<{ id: string }>
}

async function POSTHandler(_request: Request, context: RouteContext) {
  try {
    const session = await requireAdminSession()
    const { id } = await context.params
    const data = await createDraftFromTopic(id, session.user.id)

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return toErrorResponse(error, error instanceof Error ? error.message : "Failed to create draft from AI topic")
  }
}

export const POST = withApiOperationLogging(POSTHandler, { scope: "admin", operation: "admin.ai.topics.draft.create", route: "/api/admin/ai/topics/[id]/draft" })
