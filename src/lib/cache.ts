import { revalidatePath } from 'next/cache'

export const PUBLIC_REVALIDATE_SECONDS = 300

const PUBLIC_LIST_PATHS = ['/', '/posts', '/archives'] as const

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
  const paths = dedupePaths([
    ...PUBLIC_LIST_PATHS,
    options.slug ? buildPostPath(options.slug) : null,
    options.previousSlug ? buildPostPath(options.previousSlug) : null,
    options.categorySlug ? buildCategoryPath(options.categorySlug) : null,
    options.previousCategorySlug ? buildCategoryPath(options.previousCategorySlug) : null,
    ...(options.tagSlugs ?? []).map(buildTagPath),
    ...(options.previousTagSlugs ?? []).map(buildTagPath),
  ])

  for (const path of paths) {
    revalidatePath(path)
  }
}
