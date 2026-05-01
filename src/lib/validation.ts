import { AI_AUTHORING_PATTERNS } from "@/lib/ai-contract"
import { ValidationError } from "@/lib/api-errors"
import type { Prisma } from "@prisma/client"

const MAX_LIMIT = 50
const MAX_NAME_LENGTH = 80
const MAX_SLUG_LENGTH = 120
const MAX_COLOR_LENGTH = 32
const MAX_EXCERPT_LENGTH = 320
const MAX_SEO_DESCRIPTION_LENGTH = 500
const MAX_COMMENT_LENGTH = 5_000
const MAX_POST_TITLE_LENGTH = 160
const MAX_COVER_URL_LENGTH = 2_048
const MAX_COVER_TEXT_LENGTH = 160
const MAX_COVER_DESCRIPTION_LENGTH = 1_000
const MAX_COVER_TAGS = 20
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const AI_EXTERNAL_ID_PATTERN = new RegExp(AI_AUTHORING_PATTERNS.externalId)
const COVER_ASSET_STATUSES = new Set(["active", "archived"])
const COVER_ASSET_SOURCES = new Set(["upload", "manual", "ai"])
const UPLOAD_PURPOSES = ["cover", "avatar"] as const

export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number]

function readString(value: unknown, fieldName: string) {
  if (typeof value !== 'string') {
    throw new ValidationError(`Invalid ${fieldName}`)
  }

  const trimmed = value.trim()
  if (!trimmed) {
    throw new ValidationError(`Invalid ${fieldName}`)
  }

  return trimmed
}

function optionalString(value: unknown, fieldName: string) {
  if (value == null) {
    return undefined
  }

  if (typeof value !== 'string') {
    throw new ValidationError(`Invalid ${fieldName}`)
  }

  const trimmed = value.trim()
  return trimmed || undefined
}

function optionalNullableString(value: unknown, fieldName: string) {
  if (value === null || value === "") {
    return null
  }

  return optionalString(value, fieldName)
}

function assertLength(value: string | undefined, fieldName: string, maxLength: number) {
  if (value && value.length > maxLength) {
    throw new ValidationError(`${fieldName} is too long`)
  }
}

function assertSlug(value: string, fieldName: string) {
  assertLength(value, fieldName, MAX_SLUG_LENGTH)

  if (!SLUG_PATTERN.test(value)) {
    throw new ValidationError(`Invalid ${fieldName}`)
  }
}

function assertAiExternalId(value: string) {
  if (!AI_EXTERNAL_ID_PATTERN.test(value)) {
    throw new ValidationError("Invalid externalId")
  }
}

export function parseAiDraftExternalId(value: unknown) {
  const externalId = readString(value, "externalId")
  assertAiExternalId(externalId)
  return externalId
}

function normalizeStringArray(value: unknown, fieldName: string) {
  if (value == null) {
    return undefined
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new ValidationError(`Invalid ${fieldName}`)
  }

  return value.map((item) => item.trim())
}

function readBoolean(value: unknown, fieldName: string) {
  if (typeof value !== "boolean") {
    throw new ValidationError(`Invalid ${fieldName}`)
  }

  return value
}

function readHttpUrl(value: unknown, fieldName: string) {
  const url = readString(value, fieldName)
  assertLength(url, fieldName, MAX_COVER_URL_LENGTH)

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new ValidationError(`Invalid ${fieldName}`)
    }
  } catch {
    throw new ValidationError(`Invalid ${fieldName}`)
  }

  return url
}

function optionalInteger(value: unknown, fieldName: string) {
  if (value == null || value === "") {
    return undefined
  }

  const number = Number(value)
  if (!Number.isInteger(number) || number < 0) {
    throw new ValidationError(`Invalid ${fieldName}`)
  }

  return number
}

function optionalJsonObject(value: unknown, fieldName: string) {
  if (value == null) {
    return undefined
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(`Invalid ${fieldName}`)
  }

  return value as Prisma.InputJsonObject
}

function normalizeCoverTags(value: unknown) {
  const tags = normalizeStringArray(value, "tags") ?? []

  if (tags.length > MAX_COVER_TAGS) {
    throw new ValidationError("Too many tags")
  }

  return [...new Set(tags)].map((tag) => {
    assertLength(tag, "tag", MAX_COVER_TEXT_LENGTH)
    return tag
  })
}

function readCoverAssetStatus(value: unknown) {
  const status = readString(value, "status").toLowerCase()
  if (!COVER_ASSET_STATUSES.has(status)) {
    throw new ValidationError("Invalid status")
  }

  return status
}

function readCoverAssetSource(value: unknown) {
  const source = readString(value, "source").toLowerCase()
  if (!COVER_ASSET_SOURCES.has(source)) {
    throw new ValidationError("Invalid source")
  }

  return source
}

/**
 * 规范化列表分页参数，并限制在安全范围内。
 */
export function clampPagination(input: { page?: string | null; limit?: string | null }) {
  const page = Math.max(1, Number.parseInt(input.page ?? '1', 10) || 1)
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(input.limit ?? '10', 10) || 10))

  return { page, limit }
}

/**
 * 校验注册请求体，并返回去除首尾空白后的用户凭据。
 */
export function parseRegisterInput(payload: unknown) {
  const data = (payload ?? {}) as { email?: unknown; password?: unknown; name?: unknown }
  const email = readString(data.email, 'email')
  const password = readString(data.password, 'password')
  const name = optionalString(data.name, 'name')

  if (!EMAIL_PATTERN.test(email)) {
    throw new ValidationError('Invalid email')
  }

  if (password.length < 8) {
    throw new ValidationError('Password too short')
  }

  assertLength(name, 'name', MAX_NAME_LENGTH)

  return { email, password, name }
}

/**
 * 校验登录请求体，避免后续查询收到非法输入。
 */
export function parseLoginInput(payload: unknown) {
  const data = (payload ?? {}) as { email?: unknown; password?: unknown }
  const email = readString(data.email, 'email')
  const password = readString(data.password, 'password')

  if (!EMAIL_PATTERN.test(email)) {
    throw new ValidationError('Invalid email')
  }

  return { email, password }
}

/**
 * 校验上传请求，确保后续上传 token 生成只处理合法字符串。
 */
export function parseUploadRequest(payload: unknown) {
  const data = (payload ?? {}) as { filename?: unknown; contentType?: unknown; purpose?: unknown }
  const purpose = optionalString(data.purpose, 'purpose') ?? 'cover'

  if (!UPLOAD_PURPOSES.includes(purpose as UploadPurpose)) {
    throw new ValidationError('Invalid purpose')
  }

  return {
    filename: readString(data.filename, 'filename'),
    contentType: optionalString(data.contentType, 'contentType'),
    purpose: purpose as UploadPurpose,
  }
}

export function parseCoverAssetInput(payload: unknown) {
  const data = (payload ?? {}) as {
    url?: unknown
    key?: unknown
    provider?: unknown
    source?: unknown
    status?: unknown
    title?: unknown
    alt?: unknown
    description?: unknown
    tags?: unknown
    width?: unknown
    height?: unknown
    blurDataUrl?: unknown
    aiPrompt?: unknown
    aiModelId?: unknown
    metadata?: unknown
  }

  const title = optionalString(data.title, "title")
  const alt = optionalString(data.alt, "alt")
  const description = optionalString(data.description, "description")
  const provider = optionalString(data.provider, "provider") ?? "qiniu"
  const key = optionalString(data.key, "key")
  const aiPrompt = optionalString(data.aiPrompt, "aiPrompt")
  const aiModelId = optionalString(data.aiModelId, "aiModelId")

  assertLength(provider, "provider", MAX_COVER_TEXT_LENGTH)
  assertLength(key, "key", MAX_COVER_URL_LENGTH)
  assertLength(title, "title", MAX_COVER_TEXT_LENGTH)
  assertLength(alt, "alt", MAX_COVER_TEXT_LENGTH)
  assertLength(description, "description", MAX_COVER_DESCRIPTION_LENGTH)
  assertLength(aiPrompt, "aiPrompt", MAX_COVER_DESCRIPTION_LENGTH)
  assertLength(aiModelId, "aiModelId", MAX_COVER_TEXT_LENGTH)

  return {
    url: readHttpUrl(data.url, "url"),
    key,
    provider,
    source: data.source == null ? "upload" : readCoverAssetSource(data.source),
    status: data.status == null ? "active" : readCoverAssetStatus(data.status),
    title,
    alt,
    description,
    tags: normalizeCoverTags(data.tags),
    width: optionalInteger(data.width, "width"),
    height: optionalInteger(data.height, "height"),
    blurDataUrl: optionalString(data.blurDataUrl, "blurDataUrl"),
    aiPrompt,
    aiModelId,
    metadata: optionalJsonObject(data.metadata, "metadata"),
  }
}

export function parseCoverAssetPatchInput(payload: unknown) {
  const data = (payload ?? {}) as {
    title?: unknown
    alt?: unknown
    description?: unknown
    tags?: unknown
    status?: unknown
  }

  const title = optionalNullableString(data.title, "title")
  const alt = optionalNullableString(data.alt, "alt")
  const description = optionalNullableString(data.description, "description")

  assertLength(title ?? undefined, "title", MAX_COVER_TEXT_LENGTH)
  assertLength(alt ?? undefined, "alt", MAX_COVER_TEXT_LENGTH)
  assertLength(description ?? undefined, "description", MAX_COVER_DESCRIPTION_LENGTH)

  return {
    title,
    alt,
    description,
    tags: data.tags == null ? undefined : normalizeCoverTags(data.tags),
    status: data.status == null ? undefined : readCoverAssetStatus(data.status),
  }
}

export function parseCoverRandomizeInput(payload: unknown) {
  const data = (payload ?? {}) as { postIds?: unknown; publishedOnly?: unknown }

  return {
    postIds: normalizeStringArray(data.postIds, "postIds") ?? undefined,
    publishedOnly: data.publishedOnly == null ? true : readBoolean(data.publishedOnly, "publishedOnly"),
  }
}

/**
 * 校验评论创建与回复场景使用的请求体。
 */
export function parseCommentInput(payload: unknown) {
  const data = (payload ?? {}) as { postId?: unknown; content?: unknown; parentId?: unknown }
  const content = readString(data.content, 'content')
  assertLength(content, 'content', MAX_COMMENT_LENGTH)

  return {
    postId: readString(data.postId, 'postId'),
    content,
    parentId: optionalString(data.parentId, 'parentId'),
  }
}

/**
 * 校验文章创建请求体，包括可选的分类和标签信息。
 */
export function parsePostInput(payload: unknown) {
  const data = (payload ?? {}) as {
    title?: unknown
    content?: unknown
    slug?: unknown
    excerpt?: unknown
    coverImage?: unknown
    coverAssetId?: unknown
    categoryId?: unknown
    tagIds?: unknown
    published?: unknown
    featured?: unknown
  }

  const title = readString(data.title, 'title')
  const slug = readString(data.slug, 'slug')
  const content = readString(data.content, 'content')
  const excerpt = optionalString(data.excerpt, 'excerpt')

  assertLength(title, 'title', MAX_POST_TITLE_LENGTH)
  assertLength(excerpt, 'excerpt', MAX_EXCERPT_LENGTH)
  assertSlug(slug, 'slug')

  return {
    title,
    content,
    slug,
    excerpt,
    coverImage: optionalString(data.coverImage, 'coverImage'),
    coverAssetId: optionalNullableString(data.coverAssetId, 'coverAssetId'),
    categoryId: optionalNullableString(data.categoryId, 'categoryId'),
    tagIds: normalizeStringArray(data.tagIds, 'tagIds'),
    published: data.published == null ? false : readBoolean(data.published, 'published'),
    featured: data.featured == null ? false : readBoolean(data.featured, 'featured'),
  }
}

export function parseAiDraftInput(payload: unknown) {
  const data = (payload ?? {}) as {
    externalId?: unknown
    title?: unknown
    slug?: unknown
    content?: unknown
    excerpt?: unknown
    seoDescription?: unknown
    coverImage?: unknown
    categorySlug?: unknown
    tagSlugs?: unknown
  }

  const title = readString(data.title, "title")
  const slug = readString(data.slug, "slug")
  const content = readString(data.content, "content")
  const excerpt = optionalString(data.excerpt, "excerpt")
  const externalId = parseAiDraftExternalId(data.externalId)

  assertLength(title, "title", MAX_POST_TITLE_LENGTH)
  assertLength(excerpt, "excerpt", MAX_EXCERPT_LENGTH)
  assertSlug(slug, "slug")

  return {
    externalId,
    title,
    slug,
    content,
    excerpt,
    coverImage: optionalString(data.coverImage, "coverImage"),
    categorySlug: optionalString(data.categorySlug, "categorySlug"),
    tagSlugs: normalizeStringArray(data.tagSlugs, "tagSlugs") ?? [],
  }
}

/**
 * 校验文章更新请求体，同时允许可选元数据字段存在。
 */
export function parsePostPatchInput(payload: unknown) {
  const data = (payload ?? {}) as {
    title?: unknown
    content?: unknown
    excerpt?: unknown
    seoDescription?: unknown
    coverImage?: unknown
    coverAssetId?: unknown
    categoryId?: unknown
    tagIds?: unknown
    published?: unknown
    featured?: unknown
    slug?: unknown
  }

  const title = optionalString(data.title, 'title')
  const content = optionalString(data.content, 'content')

  if (!title || !content) {
    throw new ValidationError('Title and content are required')
  }

  assertLength(title, 'title', MAX_POST_TITLE_LENGTH)
  assertLength(optionalString(data.excerpt, 'excerpt'), 'excerpt', MAX_EXCERPT_LENGTH)
  assertLength(optionalNullableString(data.seoDescription, 'seoDescription') ?? undefined, 'seoDescription', MAX_SEO_DESCRIPTION_LENGTH)

  return {
    title,
    content,
    slug: data.slug == null ? undefined : readString(data.slug, 'slug'),
    excerpt: optionalString(data.excerpt, 'excerpt'),
    seoDescription: optionalNullableString(data.seoDescription, 'seoDescription'),
    coverImage: optionalString(data.coverImage, 'coverImage'),
    coverAssetId: optionalNullableString(data.coverAssetId, 'coverAssetId'),
    categoryId: optionalNullableString(data.categoryId, 'categoryId'),
    tagIds: normalizeStringArray(data.tagIds, 'tagIds'),
    published: data.published == null ? undefined : readBoolean(data.published, 'published'),
    featured: data.featured == null ? undefined : readBoolean(data.featured, 'featured'),
  }
}

export function parseTaxonomyInput(payload: unknown) {
  const data = (payload ?? {}) as { id?: unknown; name?: unknown; slug?: unknown; description?: unknown; color?: unknown }
  const name = readString(data.name, 'name')
  const slug = readString(data.slug, 'slug')

  assertLength(name, 'name', MAX_NAME_LENGTH)
  assertSlug(slug, 'slug')
  assertLength(optionalString(data.description, 'description'), 'description', MAX_EXCERPT_LENGTH)
  assertLength(optionalString(data.color, 'color'), 'color', MAX_COLOR_LENGTH)

  return {
    id: optionalString(data.id, 'id'),
    name,
    slug,
    description: optionalNullableString(data.description, 'description'),
    color: optionalNullableString(data.color, 'color'),
  }
}

export function parseProfileUpdateInput(payload: unknown) {
  const data = (payload ?? {}) as { name?: unknown; email?: unknown; image?: unknown }
  const name = optionalString(data.name, 'name')
  const email = optionalString(data.email, 'email')
  const image = optionalNullableString(data.image, 'image')

  assertLength(name, 'name', MAX_NAME_LENGTH)
  assertLength(image ?? undefined, 'image', MAX_COVER_URL_LENGTH)

  if (email && !EMAIL_PATTERN.test(email)) {
    throw new ValidationError('Invalid email')
  }

  return {
    name,
    email,
    image,
  }
}

export function parseCommentStatusInput(payload: unknown) {
  const data = (payload ?? {}) as { ids?: unknown; status?: unknown }
  const ids = normalizeStringArray(data.ids, 'ids') ?? []
  const status = readString(data.status, 'status').toUpperCase()

  return { ids, status }
}

export function parsePublishInput(payload: unknown) {
  const data = (payload ?? {}) as { id?: unknown; published?: unknown }

  return {
    id: readString(data.id, 'id'),
    published: readBoolean(data.published, 'published'),
  }
}
