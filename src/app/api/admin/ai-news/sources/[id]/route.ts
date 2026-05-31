import { withApiOperationLogging } from "@/lib/api-operation-log-route"
import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/api-auth"
import { deleteAiNewsSource, updateAiNewsSource } from "@/lib/ai-news-source-admin"
import { toErrorResponse } from "@/lib/api-errors"

type RouteContext = {
  params: Promise<{ id: string }>
}

async function PATCHHandler(request: Request, context: RouteContext) {
  try {
    await requireAdminSession()

    const { id } = await context.params
    const source = await updateAiNewsSource(id, await request.json().catch(() => ({})))

    return NextResponse.json({ success: true, data: source })
  } catch (error) {
    return toErrorResponse(error, error instanceof Error ? error.message : "Failed to update AI news source")
  }
}

async function DELETEHandler(_request: Request, context: RouteContext) {
  try {
    await requireAdminSession()

    const { id } = await context.params
    await deleteAiNewsSource(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    return toErrorResponse(error, error instanceof Error ? error.message : "Failed to delete AI news source")
  }
}

export const PATCH = withApiOperationLogging(PATCHHandler, { scope: "admin", operation: "admin.ainews.sources.byId.update", route: "/api/admin/ai-news/sources/[id]" })
export const DELETE = withApiOperationLogging(DELETEHandler, { scope: "admin", operation: "admin.ainews.sources.byId.delete", route: "/api/admin/ai-news/sources/[id]" })
