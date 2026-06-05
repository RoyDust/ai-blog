import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/api-auth"
import { toErrorResponse } from "@/lib/api-errors"
import { createCoverAsset, listCoverAssets } from "@/lib/cover-assets"
import { clampPagination, parseCoverAssetInput } from "@/lib/validation"

async function GETHandler(request: Request) {
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
      generatedByAi: searchParams.get("generatedByAi") === "true" ? true : searchParams.get("generatedByAi") === "false" ? false : undefined,
      source: searchParams.get("source") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return toErrorResponse(error)
  }
}

async function POSTHandler(request: Request) {
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

export const GET = withApiOperationLogging(GETHandler, { scope: 'admin', operation: 'admin.covers.read', route: '/api/admin/covers' });
export const POST = withApiOperationLogging(POSTHandler, { scope: 'admin', operation: 'admin.covers.create', route: '/api/admin/covers' });
