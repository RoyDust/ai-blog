import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { parseUploadRequest } from '@/lib/validation'
import { checkUploadRateLimit } from '@/lib/rate-limit'

const defaultUploadUrl = 'https://upload.qiniup.com'

function encodeBase64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function sanitizeFilename(filename: string) {
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
        .replace(/^-|-$/g, '') || 'cover',
  }
}

function buildUploadKey(filename: string) {
  const { base, ext } = sanitizeFilename(filename)
  const timestamp = Date.now()
  const random = crypto.randomBytes(4).toString('hex')
  return `covers/${timestamp}-${random}-${base}${ext}`
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

async function assertAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return null
  }

  return session
}

/**
 * 为管理员生成七牛上传凭证，并在签发前执行鉴权、校验与限流。
 */
export async function POST(request: Request) {
  const rateLimit = checkUploadRateLimit(request)
  if (!rateLimit.allowed) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
  }

  const session = await assertAdmin()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let filename: string

  try {
    ;({ filename } = parseUploadRequest(await request.json()))
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Invalid')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }

    throw error
  }

  const accessKey = process.env.QINIU_ACCESS_KEY
  const secretKey = process.env.QINIU_SECRET_KEY
  const bucket = process.env.QINIU_BUCKET
  const domain = process.env.QINIU_DOMAIN
  const uploadUrl = process.env.QINIU_UPLOAD_URL || defaultUploadUrl

  if (!accessKey || !secretKey || !bucket || !domain) {
    return NextResponse.json({ success: false, error: 'Missing Qiniu config' }, { status: 500 })
  }

  const key = buildUploadKey(filename)
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
}
