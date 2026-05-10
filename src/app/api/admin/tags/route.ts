import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/api-auth"
import { isPrismaConflictError, NotFoundError, toErrorResponse } from "@/lib/api-errors"
import { prisma } from "@/lib/prisma"
import { parseIdList, parseTaxonomyInput } from "@/lib/validation"

async function GETHandler(request: Request) {
  try {
    await requireAdminSession()

    const { searchParams } = new URL(request.url)
    if (searchParams.get("preview") === "delete") {
      const ids = parseIdList(searchParams)
      if (ids.length === 0) {
        return NextResponse.json({ error: "Tag IDs are required" }, { status: 400 })
      }

      const [tagCount, postCount] = await Promise.all([
        prisma.tag.count({ where: { id: { in: ids }, deletedAt: null } }),
        prisma.post.count({ where: { deletedAt: null, tags: { some: { id: { in: ids } } } } }),
      ])

      return NextResponse.json({
        success: true,
        data: {
          title: ids.length > 1 ? "批量隐藏标签" : "隐藏标签",
          description: "隐藏后标签会从后台默认列表和前台展示中移除。",
          impacts: [
            { label: "将隐藏标签", value: tagCount, unit: "个" },
            { label: "将影响文章标签展示", value: postCount, unit: "篇" },
          ],
        },
      })
    }

    const tags = await prisma.tag.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { posts: { where: { deletedAt: null } } } } },
      orderBy: { name: "asc" },
    })

    return NextResponse.json({ success: true, data: tags })
  } catch (error) {
    return toErrorResponse(error)
  }
}

async function POSTHandler(request: Request) {
  try {
    await requireAdminSession()
    const { name, slug, color } = parseTaxonomyInput(await request.json())
    const tag = await prisma.tag.create({ data: { name, slug, color } })

    return NextResponse.json({ success: true, data: tag })
  } catch (error) {
    if (isPrismaConflictError(error)) {
      return NextResponse.json({ error: "Tag name or slug already exists" }, { status: 409 })
    }
    return toErrorResponse(error)
  }
}

async function PATCHHandler(request: Request) {
  try {
    await requireAdminSession()
    const { id, name, slug, color } = parseTaxonomyInput(await request.json())

    if (!id) {
      return NextResponse.json({ error: "Id is required" }, { status: 400 })
    }

    const tag = await prisma.tag.update({
      where: { id },
      data: { name, slug, color },
    })

    return NextResponse.json({ success: true, data: tag })
  } catch (error) {
    if (isPrismaConflictError(error)) {
      return NextResponse.json({ error: "Tag name or slug already exists" }, { status: 409 })
    }
    return toErrorResponse(error, "Failed to update tag")
  }
}

async function DELETEHandler(request: Request) {
  try {
    await requireAdminSession()

    const { searchParams } = new URL(request.url)
    const ids = parseIdList(searchParams)
    if (ids.length === 0) {
      return NextResponse.json({ error: "Tag ID is required" }, { status: 400 })
    }

    const tags = await prisma.tag.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true } })
    if (tags.length === 0) {
      throw new NotFoundError("Tag not found")
    }

    await prisma.tag.updateMany({ where: { id: { in: tags.map((tag: { id: string }) => tag.id) }, deletedAt: null }, data: { deletedAt: new Date() } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return toErrorResponse(error, "Failed to delete tag")
  }
}

export const GET = withApiOperationLogging(GETHandler, { scope: 'admin', operation: 'admin.tags.read', route: '/api/admin/tags' });
export const POST = withApiOperationLogging(POSTHandler, { scope: 'admin', operation: 'admin.tags.create', route: '/api/admin/tags' });
export const PATCH = withApiOperationLogging(PATCHHandler, { scope: 'admin', operation: 'admin.tags.update', route: '/api/admin/tags' });
export const DELETE = withApiOperationLogging(DELETEHandler, { scope: 'admin', operation: 'admin.tags.delete', route: '/api/admin/tags' });
