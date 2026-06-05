import { withApiOperationLogging } from "@/lib/api-operation-log-route"
import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/api-auth"
import { createAiNewsSource, listAiNewsSources } from "@/lib/ai-news-source-admin"
import { toErrorResponse } from "@/lib/api-errors"
import { parseAdminListPagination } from "@/lib/admin-list-pagination"

async function GETHandler(request: Request = new Request("http://localhost/api/admin/ai-news/sources")) {
  try {
    await requireAdminSession()

    const searchParams = new URL(request.url).searchParams
    const pagination = parseAdminListPagination(
      {
        page: searchParams.get("page"),
        limit: searchParams.get("limit"),
      },
      { defaultLimit: 10, maxLimit: 50 },
    )
    const result = await listAiNewsSources({
      ...pagination,
      query: searchParams.get("q"),
      category: searchParams.get("category"),
    })

    return NextResponse.json({ success: true, data: result.sources, pagination: result.pagination, summary: result.summary })
  } catch (error) {
    return toErrorResponse(error, error instanceof Error ? error.message : "Failed to load AI news sources")
  }
}

async function POSTHandler(request: Request) {
  try {
    await requireAdminSession()

    const source = await createAiNewsSource(await request.json().catch(() => ({})))
    return NextResponse.json({ success: true, data: source }, { status: 201 })
  } catch (error) {
    return toErrorResponse(error, error instanceof Error ? error.message : "Failed to create AI news source")
  }
}

export const GET = withApiOperationLogging(GETHandler, { scope: "admin", operation: "admin.ainews.sources.read", route: "/api/admin/ai-news/sources" })
export const POST = withApiOperationLogging(POSTHandler, { scope: "admin", operation: "admin.ainews.sources.create", route: "/api/admin/ai-news/sources" })
