import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/api-auth"
import { toErrorResponse } from "@/lib/api-errors"
import { backfillMissingPostCovers } from "@/lib/cover-assets"
import { parseCoverRandomizeInput } from "@/lib/validation"

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
