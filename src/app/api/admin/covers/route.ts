import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/api-auth"
import { toErrorResponse } from "@/lib/api-errors"
import { createCoverAsset, listCoverAssets } from "@/lib/cover-assets"
import { clampPagination, parseCoverAssetInput } from "@/lib/validation"

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
