import * as nextCache from 'next/cache'

/**
 * 公共页面默认的重验证时间。
 * 供页面和数据层在 ISR / 缓存策略上保持一致。
 */
export const PUBLIC_REVALIDATE_SECONDS = 300

export const PUBLIC_CACHE_TAGS = {
  posts: 'public-posts',
  categories: 'public-categories',
  tags: 'public-tags',
  blogSettings: 'blog-settings',
  topicGuides: 'topic-guides',
} as const

export type PublicCacheTag = (typeof PUBLIC_CACHE_TAGS)[keyof typeof PUBLIC_CACHE_TAGS]

const PUBLIC_LIST_PATHS = ['/', '/posts', '/archives', '/series'] as const
const BLOG_SETTINGS_PATHS = [
  '/',
  '/about',
  '/contact',
  '/posts',
  '/archives',
  '/categories',
  '/tags',
  '/series',
  '/guides',
  '/search',
  '/bookmarks',
  '/admin',
  '/rss.xml',
  '/sitemap.xml',
  '/robots.txt',
  '/manifest.webmanifest',
  '/llms.txt',
  '/api/ai/openapi',
] as const

function normalizePathSlug(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

/**
 * 构造文章详情页路径。
 */
export function buildPostPath(slug: string) {
  return `/posts/${slug}`
}

/**
 * 构造分类详情页路径。
 */
export function buildCategoryPath(slug: string) {
  return `/categories/${slug}`
}

/**
 * 构造标签详情页路径。
 */
export function buildTagPath(slug: string) {
  return `/tags/${slug}`
}

/**
 * 构造系列详情页路径。
 */
export function buildSeriesPath(slug: string) {
  return `/series/${slug}`
}

/**
 * 构造专题导读详情页路径。
 */
export function buildTopicGuidePath(slug: string) {
  return `/guides/${slug}`
}

function dedupePaths(paths: Array<string | null | undefined>) {
  return [...new Set(paths.filter((path): path is string => Boolean(path)))]
}

function dedupeTags(tags: Array<PublicCacheTag | null | undefined>) {
  return [...new Set(tags.filter((tag): tag is PublicCacheTag => Boolean(tag)))]
}

function getNextCacheExport<K extends 'revalidatePath' | 'revalidateTag' | 'unstable_cache'>(
  name: K,
): (typeof nextCache)[K] | undefined {
  try {
    const candidate = nextCache[name]
    return typeof candidate === 'function' ? candidate : undefined
  } catch {
    return undefined
  }
}

function isMissingCacheStoreError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  return (
    error.message.includes('incrementalCache missing') ||
    error.message.includes('static generation store missing') ||
    error.message.includes('AsyncLocalStorage accessed in runtime where it is not available')
  )
}

function safeRevalidatePath(path: string, type?: 'layout' | 'page') {
  const revalidatePath = getNextCacheExport('revalidatePath')
  if (!revalidatePath) {
    return
  }

  try {
    if (type) {
      revalidatePath(path, type)
      return
    }

    revalidatePath(path)
  } catch (error) {
    if (isMissingCacheStoreError(error)) {
      return
    }

    throw error
  }
}

function safeRevalidateTag(tag: PublicCacheTag) {
  const revalidateTag = getNextCacheExport('revalidateTag')
  if (!revalidateTag) {
    return
  }

  try {
    revalidateTag(tag, 'max')
  } catch (error) {
    if (isMissingCacheStoreError(error)) {
      return
    }

    throw error
  }
}

export interface PublicCachedReaderOptions<TResult> {
  keyParts: string[]
  tags: PublicCacheTag[]
  revalidate?: number
  rehydrate?: (value: TResult) => TResult
}

/**
 * 为前台公共数据读取封装 Next.js `unstable_cache`（默认 300s + 语义化 tags）。
 *
 * 关键边界：
 * - 单测或脚本环境缺失 incrementalCache store 时，平滑回退为直调底层查询函数；
 * - 底层查询抛错（如无库构建期连接失败或表未就绪）时，异常原样穿透 `unstable_cache`，
 *   绝不把兜底数据/空态固化进 Data Cache。
 */
export function createPublicCachedReader<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: PublicCachedReaderOptions<TResult>,
): (...args: TArgs) => Promise<TResult> {
  const revalidate = options.revalidate ?? PUBLIC_REVALIDATE_SECONDS
  let cachedFn: ((...args: TArgs) => Promise<TResult>) | null = null

  return async (...args: TArgs): Promise<TResult> => {
    const unstableCache = getNextCacheExport('unstable_cache')
    if (!unstableCache) {
      return fn(...args)
    }

    if (!cachedFn) {
      cachedFn = unstableCache(fn, options.keyParts, {
        revalidate,
        tags: options.tags,
      })
    }

    try {
      const value = await cachedFn(...args)
      return options.rehydrate ? options.rehydrate(value) : value
    } catch (error) {
      if (isMissingCacheStoreError(error)) {
        return fn(...args)
      }

      throw error
    }
  }
}

/**
 * 在公共内容发生变化后，统一刷新受影响的前台页面缓存。
 *
 * 典型触发场景：
 * - 文章发布 / 下线 / 删除
 * - 文章 slug 变更
 * - 分类或标签归属变化
 *
 * 注意：
 * - 这里负责“哪些页面需要失效”，不负责具体写库逻辑
 * - previous* 字段用于处理内容迁移前的旧路径清理
 */
export interface PublicContentPathsInput {
  slug?: string | null
  previousSlug?: string | null
  categorySlug?: string | null
  previousCategorySlug?: string | null
  tagSlugs?: string[]
  previousTagSlugs?: string[]
  seriesSlug?: string | null
  previousSeriesSlug?: string | null
}

export function getPublicContentPaths(options: PublicContentPathsInput) {
  const slug = normalizePathSlug(options.slug)
  const previousSlug = normalizePathSlug(options.previousSlug)
  const categorySlug = normalizePathSlug(options.categorySlug)
  const previousCategorySlug = normalizePathSlug(options.previousCategorySlug)
  const tagSlugs = (options.tagSlugs ?? []).map(normalizePathSlug).filter((value): value is string => Boolean(value))
  const previousTagSlugs = (options.previousTagSlugs ?? [])
    .map(normalizePathSlug)
    .filter((value): value is string => Boolean(value))
  const seriesSlug = normalizePathSlug(options.seriesSlug)
  const previousSeriesSlug = normalizePathSlug(options.previousSeriesSlug)

  const paths = dedupePaths([
    ...PUBLIC_LIST_PATHS,
    slug ? buildPostPath(slug) : null,
    previousSlug ? buildPostPath(previousSlug) : null,
    categorySlug ? buildCategoryPath(categorySlug) : null,
    previousCategorySlug ? buildCategoryPath(previousCategorySlug) : null,
    ...tagSlugs.map(buildTagPath),
    ...previousTagSlugs.map(buildTagPath),
    seriesSlug ? buildSeriesPath(seriesSlug) : null,
    previousSeriesSlug ? buildSeriesPath(previousSeriesSlug) : null,
  ])

  return paths
}

function getPublicTagsForPaths(paths: string[]): PublicCacheTag[] {
  const hasPosts = paths.some(
    (path) =>
      path === '/' ||
      path === '/posts' ||
      path === '/archives' ||
      path === '/series' ||
      path.startsWith('/posts/') ||
      path.startsWith('/series/'),
  )
  const hasCategories = paths.some((path) => path === '/categories' || path.startsWith('/categories/'))
  const hasTags = paths.some((path) => path === '/tags' || path.startsWith('/tags/'))
  const hasGuides = paths.some((path) => path === '/guides' || path.startsWith('/guides/'))

  return dedupeTags([
    hasPosts ? PUBLIC_CACHE_TAGS.posts : null,
    hasCategories ? PUBLIC_CACHE_TAGS.categories : null,
    hasTags ? PUBLIC_CACHE_TAGS.tags : null,
    hasGuides ? PUBLIC_CACHE_TAGS.topicGuides : null,
  ])
}

export function revalidatePublicContent(options: PublicContentPathsInput) {
  const paths = getPublicContentPaths(options)

  for (const path of paths) {
    safeRevalidatePath(path)
  }

  for (const tag of getPublicTagsForPaths(paths)) {
    safeRevalidateTag(tag)
  }
}

export function revalidatePublicPathsStrict(paths: string[]) {
  const uniquePaths = dedupePaths(paths)
  const errors: Array<{ path: string; error: string }> = []
  const revalidatePath = getNextCacheExport('revalidatePath')
  for (const path of uniquePaths) {
    try {
      revalidatePath?.(path)
    } catch (error) {
      errors.push({ path, error: error instanceof Error ? error.message : 'Cache revalidation failed' })
    }
  }

  for (const tag of getPublicTagsForPaths(uniquePaths)) {
    safeRevalidateTag(tag)
  }

  return { paths: uniquePaths, errors }
}

export function revalidatePublicContentStrict(options: PublicContentPathsInput) {
  return revalidatePublicPathsStrict(getPublicContentPaths(options))
}

export interface TopicGuidePathsInput {
  slug?: string | null
  previousSlug?: string | null
}

export function getTopicGuidePaths(options: TopicGuidePathsInput = {}) {
  const slug = normalizePathSlug(options.slug)
  const previousSlug = normalizePathSlug(options.previousSlug)

  return dedupePaths([
    '/',
    '/guides',
    slug ? buildTopicGuidePath(slug) : null,
    previousSlug ? buildTopicGuidePath(previousSlug) : null,
    '/sitemap.xml',
  ])
}

/**
 * 专题导读创建、更新（含改名/上下线）或软删后刷新前台导读目录、详情页、首页及站点地图。
 */
export function revalidateTopicGuides(options: TopicGuidePathsInput = {}) {
  for (const path of getTopicGuidePaths(options)) {
    safeRevalidatePath(path)
  }

  safeRevalidateTag(PUBLIC_CACHE_TAGS.topicGuides)
}

/**
 * 站点级配置会影响根布局、公共 metadata 和机器可读入口。
 */
export function revalidateBlogSettings() {
  safeRevalidatePath('/', 'layout')

  for (const path of BLOG_SETTINGS_PATHS) {
    safeRevalidatePath(path)
  }

  safeRevalidateTag(PUBLIC_CACHE_TAGS.blogSettings)
}
