import { withApiOperationLogging } from "@/lib/api-operation-log-route";
/**
 * 后台文章 AI 审稿 API。
 *
 * 职责：
 * - 校验管理员身份
 * - 接收当前编辑中的文章内容
 * - 调用 AI 审稿模块返回结构化发布意见
 */
import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/api-auth"
import { toErrorResponse } from "@/lib/api-errors"
import { generatePostReview } from "@/lib/ai-review"

/**
 * 对当前文章执行一次 AI 审稿。
 * 该接口只返回审稿结果，不直接改变文章发布状态。
 */
async function POSTHandler(request: Request) {
  try {
    await requireAdminSession()

    const body = (await request.json()) as { title?: string; slug?: string; content?: string; coverImage?: string }
    const review = await generatePostReview(
      {
        title: body.title ?? "",
        slug: body.slug ?? "",
        content: body.content ?? "",
        coverImage: body.coverImage,
      },
      { requireConfigured: true },
    )

    if (!review) {
      return NextResponse.json({ error: "Review generation failed" }, { status: 502 })
    }

    return NextResponse.json({ success: true, data: review })
  } catch (error) {
    return toErrorResponse(error, error instanceof Error ? error.message : "Review generation failed")
  }
}

export const POST = withApiOperationLogging(POSTHandler, { scope: 'admin', operation: 'admin.posts.review.create', route: '/api/admin/posts/review' });
