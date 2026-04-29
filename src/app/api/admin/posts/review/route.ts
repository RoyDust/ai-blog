import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/api-auth"
import { toErrorResponse } from "@/lib/api-errors"
import { generatePostReview } from "@/lib/ai-review"

export async function POST(request: Request) {
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
