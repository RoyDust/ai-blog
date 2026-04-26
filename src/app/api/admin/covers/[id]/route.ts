import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/api-auth"
import { toErrorResponse } from "@/lib/api-errors"
import { softDeleteCoverAsset, updateCoverAsset } from "@/lib/cover-assets"
import { parseCoverAssetPatchInput } from "@/lib/validation"

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
