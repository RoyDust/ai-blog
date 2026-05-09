import crypto from 'node:crypto'
import { NextResponse } from 'next/server'

import { requireAdminSession } from '@/lib/api-auth'
import { toErrorResponse } from '@/lib/api-errors'
import { checkUploadRateLimit } from '@/lib/rate-limit'
import { parseUploadRequest } from '@/lib/validation'

const defaultUploadUrl = 'https://upload.qiniup.com'

/**
 * 七牛上传凭证要求使用 URL-safe base64。
 */
function encodeBase64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

/**
 * 清理用户上传文件名，避免对象存储 key 中出现不可控字符。
 */
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

/**
 * 根据上传用途生成对象存储 key。
 *
 * avatar 和 cover 分目录存放，后缀保留原始文件扩展名。
 */
function buildUploadKey(filename: string, purpose: 'cover' | 'avatar') {
  const folder = purpose === 'avatar' ? 'avatars' : 'covers'
  const { base, ext } = sanitizeFilename(filename, purpose)
  const timestamp = Date.now()
  const random = crypto.randomBytes(4).toString('hex')
  return `${folder}/${timestamp}-${random}-${base}${ext}`
}

/**
 * 按七牛直传协议生成单文件上传 token。
 */
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

/**
 * 返回浏览器直传七牛所需的 token、key、domain 和 uploadUrl。
 *
 * 文件内容不经过应用服务器；这里只负责鉴权、限流和生成短期上传凭证。
 */
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
    return toErrorResponse(error)
  }
}
