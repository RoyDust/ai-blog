import { withApiOperationLogging } from "@/lib/api-operation-log-route"
import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/api-auth"
import { testAiNewsSource } from "@/lib/ai-news-source-admin"
import { toErrorResponse } from "@/lib/api-errors"

type RouteContext = {
  params: Promise<{ id: string }>
}

async function POSTHandler(_request: Request, context: RouteContext) {
  try {
    await requireAdminSession()

    const { id } = await context.params
    const result = await testAiNewsSource(id)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return toErrorResponse(error, error instanceof Error ? error.message : "Failed to test AI news source")
  }
}

export const POST = withApiOperationLogging(POSTHandler, { scope: "admin", operation: "admin.ainews.sources.byId.test", route: "/api/admin/ai-news/sources/[id]/test" })
