import type { Metadata } from 'next'

const defaultSiteUrl = 'https://example.com'

export function getSiteUrl() {
  return (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || defaultSiteUrl).replace(/\/$/, '')
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
}: {
  title: string
  description: string
  path: string
  publishedTime: string
  modifiedTime?: string
  authorName: string
  image?: string | null
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    mainEntityOfPage: buildCanonicalUrl(path),
    datePublished: publishedTime,
    dateModified: modifiedTime || publishedTime,
    author: {
      '@type': 'Person',
      name: authorName,
    },
    image: image || undefined,
  }
}
