import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/api-auth"
import { toErrorResponse } from "@/lib/api-errors"
import { backfillMissingPostCovers } from "@/lib/cover-assets"
import { parseCoverRandomizeInput } from "@/lib/validation"

async function POSTHandler(request: Request) {
  try {
    await requireAdminSession()

    const input = parseCoverRandomizeInput(await request.json())
    const result = await backfillMissingPostCovers(input)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export const POST = withApiOperationLogging(POSTHandler, { scope: 'admin', operation: 'admin.covers.randomizeposts.create', route: '/api/admin/covers/randomize-posts' });
