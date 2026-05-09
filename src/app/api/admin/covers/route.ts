import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/api-auth"
import { toErrorResponse } from "@/lib/api-errors"
import { createCoverAsset, listCoverAssets } from "@/lib/cover-assets"
import { clampPagination, parseCoverAssetInput } from "@/lib/validation"

/**
 * 查询封面图库列表。
 *
 * 支持分页、关键词、来源和状态过滤，供图库管理页和选择器复用。
 */
export async function GET(request: Request) {
  try {
    await requireAdminSession()

    const { searchParams } = new URL(request.url)
    const pagination = clampPagination({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    })

    const data = await listCoverAssets({
      ...pagination,
      q: searchParams.get("q") ?? undefined,
      source: searchParams.get("source") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return toErrorResponse(error)
  }
}

/**
 * 创建一条封面素材记录。
 *
 * 上传直传和手填外链最终都会落到这里，由 cover-assets 服务处理去重和恢复软删除记录。
 */
export async function POST(request: Request) {
  try {
    const session = await requireAdminSession()
    const input = parseCoverAssetInput(await request.json())
    const asset = await createCoverAsset({
      ...input,
      createdById: session.user.id,
    })

    return NextResponse.json({ success: true, data: asset })
  } catch (error) {
    return toErrorResponse(error)
  }
}
