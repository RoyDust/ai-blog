import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/api-auth"
import { NotFoundError, toErrorResponse } from "@/lib/api-errors"
import { updateAdminPost } from "@/lib/ai-authoring"
import { prisma } from "@/lib/prisma"
import { parsePostPatchInput } from "@/lib/validation"

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
        coverImage: true,
        readingTimeMinutes: true,
        categoryId: true,
        tags: {
          where: { deletedAt: null },
          select: { id: true, name: true, slug: true },
        },
        published: true,
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
