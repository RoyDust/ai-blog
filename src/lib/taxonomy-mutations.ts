import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { NotFoundError } from '@/lib/api-errors'
import { getPublicContentPaths, revalidatePublicPathsStrict } from '@/lib/cache'

type TaxonomyKind = 'category' | 'tag'

/** Capture old identities under the same lock as mutation, then invalidate after commit. */
export async function mutateTaxonomy<T>(
  kind: TaxonomyKind,
  ids: string[],
  newSlug: string | undefined,
  mutate: (tx: Prisma.TransactionClient, liveIds: string[]) => Promise<T>,
) {
  const { data, paths } = await prisma.$transaction(async (tx) => {
    if (ids.length) {
      await tx.$queryRawUnsafe(
        kind === 'category'
          ? 'SELECT id FROM categories WHERE id = ANY($1::text[]) ORDER BY id FOR NO KEY UPDATE'
          : 'SELECT id FROM tags WHERE id = ANY($1::text[]) ORDER BY id FOR NO KEY UPDATE', ids,
      )
    }
    const entities = ids.length
      ? kind === 'category'
        ? await tx.category.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true, slug: true } })
        : await tx.tag.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true, slug: true } })
      : []
    if (ids.length && !entities.length) throw new NotFoundError(kind === 'category' ? 'Category not found' : 'Tag not found')
    const liveIds = entities.map((entity) => entity.id)
    const posts = liveIds.length ? await tx.post.findMany({
      where: { deletedAt: null, published: true, ...(kind === 'category' ? { categoryId: { in: liveIds } } : { tags: { some: { id: { in: liveIds } } } }) },
      select: {
        slug: true, category: { select: { slug: true } }, tags: { where: { deletedAt: null }, select: { slug: true } }, series: { select: { slug: true } },
        topicGuidePosts: { where: { guide: { deletedAt: null, status: 'published' } }, select: { guide: { select: { slug: true } } } },
      },
    }) : []
    const family = kind === 'category' ? '/categories/' : '/tags/'
    const paths = new Set(['/', '/posts', '/archives', '/series', '/categories', '/tags', '/search', '/rss.xml', '/sitemap.xml'])
    for (const entity of entities) paths.add(family + entity.slug)
    if (newSlug) paths.add(family + newSlug)
    for (const post of posts) for (const { guide } of post.topicGuidePosts) paths.add('/guides/' + guide.slug)
    for (const post of posts) for (const path of getPublicContentPaths({
      slug: post.slug, categorySlug: post.category?.slug, tagSlugs: post.tags.map((tag) => tag.slug), seriesSlug: post.series?.slug,
    })) paths.add(path)
    return { data: await mutate(tx, liveIds), paths: [...paths] }
  })
  const result = revalidatePublicPathsStrict(paths)
  if (result.errors.length) console.error('Taxonomy cache revalidation failed', { kind, ids, errors: result.errors })
  return { data, cache: { paths: result.paths, failedPaths: result.errors.map(({ path }) => path) } }
}
