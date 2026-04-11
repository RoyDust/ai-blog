import { AI_AUTHORING_PATTERNS } from "@/lib/ai-contract"
import { ValidationError } from "@/lib/api-errors"

const MAX_LIMIT = 50
const MAX_NAME_LENGTH = 80
const MAX_SLUG_LENGTH = 120
const MAX_COLOR_LENGTH = 32
const MAX_EXCERPT_LENGTH = 320
const MAX_COMMENT_LENGTH = 5_000
const MAX_POST_TITLE_LENGTH = 160
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const AI_EXTERNAL_ID_PATTERN = new RegExp(AI_AUTHORING_PATTERNS.externalId)

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
  const data = (payload ?? {}) as { filename?: unknown; contentType?: unknown }

  return {
    filename: readString(data.filename, 'filename'),
    contentType: optionalString(data.contentType, 'contentType'),
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
    categoryId?: unknown
    tagIds?: unknown
    published?: unknown
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
    categoryId: optionalNullableString(data.categoryId, 'categoryId'),
    tagIds: normalizeStringArray(data.tagIds, 'tagIds'),
    published: data.published == null ? false : readBoolean(data.published, 'published'),
  }
}

export function parseAiDraftInput(payload: unknown) {
  const data = (payload ?? {}) as {
    externalId?: unknown
    title?: unknown
    slug?: unknown
    content?: unknown
    excerpt?: unknown
    coverImage?: unknown
    categorySlug?: unknown
    tagSlugs?: unknown
  }

  const title = readString(data.title, "title")
  const slug = readString(data.slug, "slug")
  const content = readString(data.content, "content")
  const excerpt = optionalString(data.excerpt, "excerpt")
  const externalId = readString(data.externalId, "externalId")

  assertLength(title, "title", MAX_POST_TITLE_LENGTH)
  assertLength(excerpt, "excerpt", MAX_EXCERPT_LENGTH)
  assertSlug(slug, "slug")
  assertAiExternalId(externalId)

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
    coverImage?: unknown
    categoryId?: unknown
    tagIds?: unknown
    published?: unknown
    slug?: unknown
  }

  const title = optionalString(data.title, 'title')
  const content = optionalString(data.content, 'content')

  if (!title || !content) {
    throw new ValidationError('Title and content are required')
  }

  assertLength(title, 'title', MAX_POST_TITLE_LENGTH)
  assertLength(optionalString(data.excerpt, 'excerpt'), 'excerpt', MAX_EXCERPT_LENGTH)

  return {
    title,
    content,
    slug: data.slug == null ? undefined : readString(data.slug, 'slug'),
    excerpt: optionalString(data.excerpt, 'excerpt'),
    coverImage: optionalString(data.coverImage, 'coverImage'),
    categoryId: optionalNullableString(data.categoryId, 'categoryId'),
    tagIds: normalizeStringArray(data.tagIds, 'tagIds'),
    published: data.published == null ? undefined : readBoolean(data.published, 'published'),
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
  const data = (payload ?? {}) as { name?: unknown; email?: unknown }
  const name = optionalString(data.name, 'name')
  const email = optionalString(data.email, 'email')

  assertLength(name, 'name', MAX_NAME_LENGTH)

  if (email && !EMAIL_PATTERN.test(email)) {
    throw new ValidationError('Invalid email')
  }

  return {
    name,
    email,
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
