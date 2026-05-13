import { revalidatePath } from 'next/cache'

/**
 * 公共页面默认的重验证时间。
 * 供页面和数据层在 ISR / 缓存策略上保持一致。
 */
export const PUBLIC_REVALIDATE_SECONDS = 300

const PUBLIC_LIST_PATHS = ['/', '/posts', '/archives'] as const
const BLOG_SETTINGS_PATHS = [
  '/',
  '/about',
  '/posts',
  '/archives',
  '/categories',
  '/tags',
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

function dedupePaths(paths: Array<string | null | undefined>) {
  return [...new Set(paths.filter((path): path is string => Boolean(path)))]
}

function safeRevalidatePath(path: string, type?: 'layout' | 'page') {
  try {
    if (type) {
      revalidatePath(path, type)
      return
    }

    revalidatePath(path)
  } catch (error) {
    if (error instanceof Error && error.message.includes('static generation store missing')) {
      return
    }

    throw error
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
export function revalidatePublicContent(options: {
  slug?: string | null
  previousSlug?: string | null
  categorySlug?: string | null
  previousCategorySlug?: string | null
  tagSlugs?: string[]
  previousTagSlugs?: string[]
}) {
  const slug = normalizePathSlug(options.slug)
  const previousSlug = normalizePathSlug(options.previousSlug)
  const categorySlug = normalizePathSlug(options.categorySlug)
  const previousCategorySlug = normalizePathSlug(options.previousCategorySlug)
  const tagSlugs = (options.tagSlugs ?? []).map(normalizePathSlug).filter((value): value is string => Boolean(value))
  const previousTagSlugs = (options.previousTagSlugs ?? [])
    .map(normalizePathSlug)
    .filter((value): value is string => Boolean(value))

  const paths = dedupePaths([
    ...PUBLIC_LIST_PATHS,
    slug ? buildPostPath(slug) : null,
    previousSlug ? buildPostPath(previousSlug) : null,
    categorySlug ? buildCategoryPath(categorySlug) : null,
    previousCategorySlug ? buildCategoryPath(previousCategorySlug) : null,
    ...tagSlugs.map(buildTagPath),
    ...previousTagSlugs.map(buildTagPath),
  ])

  for (const path of paths) {
    safeRevalidatePath(path)
  }
}

/**
 * 站点级配置会影响根布局、公共 metadata 和机器可读入口。
 */
export function revalidateBlogSettings() {
  safeRevalidatePath('/', 'layout')

  for (const path of BLOG_SETTINGS_PATHS) {
    safeRevalidatePath(path)
  }
}
