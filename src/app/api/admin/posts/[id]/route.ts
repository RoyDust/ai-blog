import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/api-auth"
import { NotFoundError, toErrorResponse } from "@/lib/api-errors"
import { updateAdminPost } from "@/lib/ai-authoring"
import { prisma } from "@/lib/prisma"
import { parsePostPatchInput } from "@/lib/validation"

/**
 * 读取文章编辑页需要的完整表单数据。
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminSession()

    const { id } = await params
    const post = await prisma.post.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        title: true,
        slug: true,
        content: true,
        excerpt: true,
        seoDescription: true,
        coverImage: true,
        coverAssetId: true,
        readingTimeMinutes: true,
        categoryId: true,
        tags: {
          where: { deletedAt: null },
          select: { id: true, name: true, slug: true },
        },
        published: true,
        featured: true,
      },
    })

    if (!post) {
      throw new NotFoundError("Post not found")
    }

    return NextResponse.json({ success: true, data: post })
  } catch (error) {
    return toErrorResponse(error)
  }
}

/**
 * 更新后台文章。
 *
 * 具体字段校验、slug 冲突、封面解析、精选限制和缓存刷新都交给 updateAdminPost。
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminSession()

    const { id } = await params
    const body = parsePostPatchInput(await request.json())
    const updated = await updateAdminPost({ id, input: body })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return toErrorResponse(error)
  }
}
