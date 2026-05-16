import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/api-auth"
import { NotFoundError, toErrorResponse } from "@/lib/api-errors"
import { updateAdminPost } from "@/lib/ai-authoring"
import { prisma } from "@/lib/prisma"
import { parsePostPatchInput } from "@/lib/validation"

async function GETHandler(_: Request, { params }: { params: Promise<{ id: string }> }) {
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
        seriesId: true,
        seriesOrder: true,
        series: {
          select: { id: true, title: true, slug: true },
        },
        tags: {
          where: { deletedAt: null },
          select: { id: true, name: true, slug: true },
        },
        published: true,
        scheduledAt: true,
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

async function PATCHHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

export const GET = withApiOperationLogging(GETHandler, { scope: 'admin', operation: 'admin.posts.byId.read', route: '/api/admin/posts/[id]' });
export const PATCH = withApiOperationLogging(PATCHHandler, { scope: 'admin', operation: 'admin.posts.byId.update', route: '/api/admin/posts/[id]' });
