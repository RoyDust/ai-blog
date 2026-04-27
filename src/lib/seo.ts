import type { Metadata } from 'next'

export const SITE_NAME = 'My Blog'

const defaultSiteUrl = 'http://roydust.top'

function normalizeSiteUrl(value: string | undefined) {
  return value?.trim().replace(/\/$/, '')
}

export function getSiteUrl() {
  return (
    normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalizeSiteUrl(process.env.SITE_URL) ||
    normalizeSiteUrl(process.env.NEXTAUTH_URL) ||
    defaultSiteUrl
  )
}

export function buildCanonicalUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${getSiteUrl()}${normalizedPath}`
}

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
