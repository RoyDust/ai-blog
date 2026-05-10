import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/api-auth"
import { toErrorResponse } from "@/lib/api-errors"
import { softDeleteCoverAsset, updateCoverAsset } from "@/lib/cover-assets"
import { parseCoverAssetPatchInput } from "@/lib/validation"

async function PATCHHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

async function DELETEHandler(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminSession()

    const { id } = await params
    const asset = await softDeleteCoverAsset(id)

    return NextResponse.json({ success: true, data: asset })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export const PATCH = withApiOperationLogging(PATCHHandler, { scope: 'admin', operation: 'admin.covers.byId.update', route: '/api/admin/covers/[id]' });
export const DELETE = withApiOperationLogging(DELETEHandler, { scope: 'admin', operation: 'admin.covers.byId.delete', route: '/api/admin/covers/[id]' });
