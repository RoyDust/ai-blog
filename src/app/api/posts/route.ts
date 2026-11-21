import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NextResponse } from "next/server"
import { getPublishedPostsPage } from "@/lib/posts"
import { clampPagination } from "@/lib/validation"
import { toErrorResponse } from "@/lib/api-errors"

async function GETHandler(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const { page, limit } = clampPagination({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    })
    const category = searchParams.get("category")
    const tag = searchParams.get("tag")
    const search = searchParams.get("search")
    const rawType = searchParams.get("type")?.trim()
    const type = rawType === "original" || rawType === "ai-daily" ? rawType : undefined

    const { posts, pagination } = await getPublishedPostsPage({
      page,
      limit,
      category,
      tag,
      search,
      ...(type ? { type } : {}),
    })

    return NextResponse.json({
      success: true,
      data: posts,
      pagination,
    })
  } catch (error) {
    console.error("Get posts error:", error)
    return toErrorResponse(error)
  }
}

export const GET = withApiOperationLogging(GETHandler, { scope: 'public', operation: 'public.posts.read', route: '/api/posts' });
