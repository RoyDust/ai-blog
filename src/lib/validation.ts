const MAX_LIMIT = 50

function readString(value: unknown, fieldName: string) {
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${fieldName}`)
  }

  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error(`Invalid ${fieldName}`)
  }

  return trimmed
}

function optionalString(value: unknown, fieldName: string) {
  if (value == null) {
    return undefined
  }

  if (typeof value !== 'string') {
    throw new Error(`Invalid ${fieldName}`)
  }

  const trimmed = value.trim()
  return trimmed || undefined
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

  if (!email.includes('@')) {
    throw new Error('Invalid email')
  }

  if (password.length < 8) {
    throw new Error('Password too short')
  }

  return { email, password, name }
}

/**
 * 校验登录请求体，避免后续查询收到非法输入。
 */
export function parseLoginInput(payload: unknown) {
  const data = (payload ?? {}) as { email?: unknown; password?: unknown }
  const email = readString(data.email, 'email')
  const password = readString(data.password, 'password')

  if (!email.includes('@')) {
    throw new Error('Invalid email')
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

  return {
    postId: readString(data.postId, 'postId'),
    content: readString(data.content, 'content'),
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

  const tagIds = data.tagIds
  if (tagIds != null && (!Array.isArray(tagIds) || tagIds.some((tagId) => typeof tagId !== 'string' || !tagId.trim()))) {
    throw new Error('Invalid tagIds')
  }

  if (data.published != null && typeof data.published !== 'boolean') {
    throw new Error('Invalid published')
  }

  return {
    title: readString(data.title, 'title'),
    content: readString(data.content, 'content'),
    slug: readString(data.slug, 'slug'),
    excerpt: optionalString(data.excerpt, 'excerpt'),
    coverImage: optionalString(data.coverImage, 'coverImage'),
    categoryId: optionalString(data.categoryId, 'categoryId'),
    tagIds: tagIds?.map((tagId) => tagId.trim()) as string[] | undefined,
    published: data.published === true,
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
  }

  const title = optionalString(data.title, 'title')
  const content = optionalString(data.content, 'content')
  const tagIds = data.tagIds

  if (!title || !content) {
    throw new Error('Title and content are required')
  }

  if (tagIds != null && (!Array.isArray(tagIds) || tagIds.some((tagId) => typeof tagId !== 'string' || !tagId.trim()))) {
    throw new Error('Invalid tagIds')
  }

  if (data.published != null && typeof data.published !== 'boolean') {
    throw new Error('Invalid published')
  }

  return {
    title,
    content,
    excerpt: optionalString(data.excerpt, 'excerpt'),
    coverImage: optionalString(data.coverImage, 'coverImage'),
    categoryId: optionalString(data.categoryId, 'categoryId'),
    tagIds: tagIds?.map((tagId) => tagId.trim()) as string[] | undefined,
    published: data.published,
  }
}
