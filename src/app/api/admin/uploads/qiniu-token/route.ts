import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NextResponse } from 'next/server'

import { requireAdminSession } from '@/lib/api-auth'
import { ApiError, toErrorResponse, TooManyRequestsError } from '@/lib/api-errors'
import {
  buildUploadKey,
  createQiniuUploadToken,
  DEFAULT_QINIU_UPLOAD_URL,
} from '@/lib/qiniu-server'
import { checkUploadRateLimit } from '@/lib/rate-limit'
import { parseUploadRequest } from '@/lib/validation'

async function POSTHandler(request: Request) {
  try {
    const rateLimit = await checkUploadRateLimit(request)
    if (!rateLimit.allowed) {
      throw new TooManyRequestsError()
    }

    await requireAdminSession()

    const { filename, purpose } = parseUploadRequest(await request.json())
    const accessKey = process.env.QINIU_ACCESS_KEY
    const secretKey = process.env.QINIU_SECRET_KEY
    const bucket = process.env.QINIU_BUCKET
    const domain = process.env.QINIU_DOMAIN
    const uploadUrl = process.env.QINIU_UPLOAD_URL || DEFAULT_QINIU_UPLOAD_URL

    if (!accessKey || !secretKey || !bucket || !domain) {
      throw new ApiError(500, 'Missing Qiniu config')
    }

    const key = buildUploadKey(filename, purpose)
    const token = createQiniuUploadToken({
      bucket,
      key,
      accessKey,
      secretKey,
    })

    return NextResponse.json({
      success: true,
      data: {
        token,
        key,
        domain,
        uploadUrl,
      },
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export const POST = withApiOperationLogging(POSTHandler, { scope: 'admin', operation: 'admin.uploads.qiniutoken.create', route: '/api/admin/uploads/qiniu-token' });
