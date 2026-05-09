import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/api-auth"
import { toErrorResponse } from "@/lib/api-errors"
import { backfillMissingPostCovers } from "@/lib/cover-assets"
import { parseCoverRandomizeInput } from "@/lib/validation"

/**
 * 批量给缺少封面的文章随机补齐图库素材。
 *
 * 这是会修改文章数据的显式管理动作，默认由服务层限制到已发布文章。
 */
export async function POST(request: Request) {
  try {
    await requireAdminSession()

    const input = parseCoverRandomizeInput(await request.json())
    const result = await backfillMissingPostCovers(input)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return toErrorResponse(error)
  }
}
