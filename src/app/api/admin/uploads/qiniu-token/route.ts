import crypto from 'node:crypto'
import { NextResponse } from 'next/server'

import { requireAdminSession } from '@/lib/api-auth'
import { ApiError } from '@/lib/api-errors'
import { checkUploadRateLimit } from '@/lib/rate-limit'
import { parseUploadRequest } from '@/lib/validation'

const defaultUploadUrl = 'https://upload.qiniup.com'

function encodeBase64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function sanitizeFilename(filename: string, fallbackBase = 'cover') {
  const extIndex = filename.lastIndexOf('.')
  const ext = extIndex > -1 ? filename.slice(extIndex).toLowerCase() : ''

  return {
    ext,
    base:
      filename
        .slice(0, extIndex > -1 ? extIndex : filename.length)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || fallbackBase,
  }
}

function buildUploadKey(filename: string, purpose: 'cover' | 'avatar') {
  const folder = purpose === 'avatar' ? 'avatars' : 'covers'
  const { base, ext } = sanitizeFilename(filename, purpose)
  const timestamp = Date.now()
  const random = crypto.randomBytes(4).toString('hex')
  return `${folder}/${timestamp}-${random}-${base}${ext}`
}

function createUploadToken(bucket: string, key: string, accessKey: string, secretKey: string) {
  const deadline = Math.floor(Date.now() / 1000) + 3600
  const putPolicy = {
    scope: `${bucket}:${key}`,
    deadline,
    returnBody: '{"key":"$(key)","hash":"$(etag)","fsize":$(fsize)}',
  }

  const encodedPolicy = encodeBase64Url(JSON.stringify(putPolicy))
  const digest = crypto.createHmac('sha1', secretKey).update(encodedPolicy).digest()
  const encodedDigest = encodeBase64Url(digest)

  return `${accessKey}:${encodedDigest}:${encodedPolicy}`
}

export async function POST(request: Request) {
  try {
    const rateLimit = await checkUploadRateLimit(request)
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
    }

    await requireAdminSession()

    const { filename, purpose } = parseUploadRequest(await request.json())
    const accessKey = process.env.QINIU_ACCESS_KEY
    const secretKey = process.env.QINIU_SECRET_KEY
    const bucket = process.env.QINIU_BUCKET
    const domain = process.env.QINIU_DOMAIN
    const uploadUrl = process.env.QINIU_UPLOAD_URL || defaultUploadUrl

    if (!accessKey || !secretKey || !bucket || !domain) {
      return NextResponse.json({ success: false, error: 'Missing Qiniu config' }, { status: 500 })
    }

    const key = buildUploadKey(filename, purpose)
    const token = createUploadToken(bucket, key, accessKey, secretKey)

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
    if (error instanceof ApiError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }

    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
