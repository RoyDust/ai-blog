import { revalidatePath } from 'next/cache'

export const PUBLIC_REVALIDATE_SECONDS = 300

const PUBLIC_LIST_PATHS = ['/', '/posts', '/archives'] as const

function normalizePathSlug(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

export function buildPostPath(slug: string) {
  return `/posts/${slug}`
}

export function buildCategoryPath(slug: string) {
  return `/categories/${slug}`
}

export function buildTagPath(slug: string) {
  return `/tags/${slug}`
}

function dedupePaths(paths: Array<string | null | undefined>) {
  return [...new Set(paths.filter((path): path is string => Boolean(path)))]
}

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
    revalidatePath(path)
  }
}
