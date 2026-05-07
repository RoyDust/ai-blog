import type { Metadata } from 'next'

/**
 * SEO / 结构化数据辅助工具。
 *
 * 职责：
 * - 统一站点 URL 与 canonical 构造逻辑
 * - 生成常用页面 metadata
 * - 生成文章页与面包屑 JSON-LD
 *
 * 这样做可以避免各页面各写一套 SEO 逻辑，减少字段漂移。
 */
export const SITE_NAME = 'My Blog'

const defaultSiteUrl = 'http://roydust.top'

function normalizeSiteUrl(value: string | undefined) {
  return value?.trim().replace(/\/$/, '')
}

/**
 * 返回站点对外公开的根 URL。
 * 读取顺序按“前台显式配置优先，认证配置兜底”处理。
 */
export function getSiteUrl() {
  return (
    normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalizeSiteUrl(process.env.SITE_URL) ||
    normalizeSiteUrl(process.env.NEXTAUTH_URL) ||
    defaultSiteUrl
  )
}

/**
 * 把相对路径转换成完整 canonical URL。
 */
export function buildCanonicalUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${getSiteUrl()}${normalizedPath}`
}

/**
 * 生成通用页面 metadata。
 * 适用于首页、列表页、普通内容页等“website”类型页面。
 */
export function buildPageMetadata({
  title,
  description,
  path,
  image,
}: {
  title: string
  description: string
  path: string
  image?: string | null
}): Metadata {
  const canonical = buildCanonicalUrl(path)

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image ? [image] : undefined,
    },
  }
}

/**
 * 生成 noindex 页面 metadata。
 * 常用于搜索页、书签页等不希望被搜索引擎收录的工具型页面。
 */
export function buildNoIndexMetadata({
  title,
  description,
  path,
}: {
  title: string
  description: string
  path: string
}): Metadata {
  return {
    ...buildPageMetadata({ title, description, path }),
    robots: {
      index: false,
      follow: true,
    },
  }
}

/**
 * 生成文章页 metadata。
 * 在通用页面字段之上补充 article 类型和发布时间信息。
 */
export function buildArticleMetadata({
  title,
  description,
  path,
  image,
  publishedTime,
  modifiedTime,
}: {
  title: string
  description: string
  path: string
  image?: string | null
  publishedTime?: string
  modifiedTime?: string
}): Metadata {
  const metadata = buildPageMetadata({ title, description, path, image })

  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      type: 'article',
      publishedTime,
      modifiedTime,
    },
  }
}

/**
 * 生成文章页 JSON-LD，提升搜索引擎对文章实体的理解能力。
 */
export function buildArticleJsonLd({
  title,
  description,
  path,
  publishedTime,
  modifiedTime,
  authorName,
  image,
  categoryName,
  tags,
}: {
  title: string
  description: string
  path: string
  publishedTime: string
  modifiedTime?: string
  authorName: string
  image?: string | null
  categoryName?: string | null
  tags?: string[]
}) {
  const url = buildCanonicalUrl(path)

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    url,
    mainEntityOfPage: url,
    datePublished: publishedTime,
    dateModified: modifiedTime || publishedTime,
    author: {
      '@type': 'Person',
      name: authorName,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: getSiteUrl(),
    },
    image: image || undefined,
    articleSection: categoryName || undefined,
    keywords: tags && tags.length > 0 ? tags.join(', ') : undefined,
  }
}

/**
 * 生成面包屑 JSON-LD。
 * 适合分类页、文章页等有层级导航关系的页面。
 */
export function buildBreadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: buildCanonicalUrl(item.path),
    })),
  }
}
