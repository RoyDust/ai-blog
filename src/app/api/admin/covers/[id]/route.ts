import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/api-auth"
import { toErrorResponse } from "@/lib/api-errors"
import { softDeleteCoverAsset, updateCoverAsset } from "@/lib/cover-assets"
import { parseCoverAssetPatchInput } from "@/lib/validation"

/**
 * 更新封面素材元信息。
 *
 * 只修改标题、alt、备注、标签和状态，不改变已经被文章引用的 URL。
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminSession()

    const { id } = await params
    const input = parseCoverAssetPatchInput(await request.json())
    const asset = await updateCoverAsset(id, input)

    return NextResponse.json({ success: true, data: asset })
  } catch (error) {
    return toErrorResponse(error)
  }
}

/**
 * 软删除封面素材。
 *
 * 归档不会清空已有文章的封面字段，只让该素材从可选图库中消失。
 */
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminSession()

    const { id } = await params
    const asset = await softDeleteCoverAsset(id)

    return NextResponse.json({ success: true, data: asset })
  } catch (error) {
    return toErrorResponse(error)
  }
}
