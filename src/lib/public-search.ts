import { prisma } from "@/lib/prisma"

/**
 * The public search ranking contract. Keep these weights in one place so the
 * database ranking and the response metadata cannot drift apart.
 */
export const PUBLIC_SEARCH_SCORE_WEIGHTS = {
  title: 12,
  excerpt: 8,
  content: 4,
  author: 3,
  category: 2,
  tags: 2,
} as const

export type PublicSearchInput = {
  query: string
  page: number
  limit: number
}

export type PublicSearchMeta = {
  score: number
  hitFields: string[]
}

type SearchPostRecord = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  content: string | null
  coverImage: string | null
  createdAt: Date
  author: {
    id: string
    name: string | null
    image: string | null
  }
  category: {
    name?: string | null
    slug?: string | null
  } | null
  tags: Array<{
    name?: string | null
    slug?: string | null
  }>
  _count: {
    comments: number
    likes: number
  }
}

export type PublicSearchPost = SearchPostRecord & {
  searchMeta: PublicSearchMeta
}

type RankedSearchItem = {
  id: string
  score: number | string | bigint
  hitFields: string[] | null
}

type RankedSearchEnvelope = {
  total: number | string | bigint
  items: RankedSearchItem[] | null
}

const PUBLIC_SEARCH_POST_INCLUDE = {
  author: { select: { id: true, name: true, image: true } },
  category: true,
  tags: { where: { deletedAt: null } },
  _count: { select: { comments: { where: { deletedAt: null, status: "APPROVED" } }, likes: true } },
} as const

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`)
}

function toInteger(value: number | string | bigint | null | undefined) {
  if (typeof value === "bigint") return Number(value)
  if (typeof value === "string") return Number(value)
  return value ?? 0
}

function normalizePagination({ page, limit }: Pick<PublicSearchInput, "page" | "limit">) {
  const normalizedPage = Number.isInteger(page) && page > 0 ? page : 1
  const normalizedLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 50) : 10

  return {
    page: normalizedPage,
    limit: normalizedLimit,
    offset: (normalizedPage - 1) * normalizedLimit,
  }
}

/**
 * Runs the complete public search ranking in PostgreSQL, then hydrates only the
 * selected page through the shared Prisma client.
 */
export async function searchPublicPosts(input: PublicSearchInput): Promise<{
  items: PublicSearchPost[]
  total: number
}> {
  const { limit, offset } = normalizePagination(input)
  const pattern = `%${escapeLikePattern(input.query)}%`

  const rankedRows = await prisma.$queryRaw<RankedSearchEnvelope[]>`
    WITH field_matches AS (
      SELECT
        p."id",
        p."createdAt",
        p."published",
        p."deletedAt",
        (p."title" ILIKE ${pattern} ESCAPE E'\\\\') AS title_hit,
        (p."excerpt" ILIKE ${pattern} ESCAPE E'\\\\') AS excerpt_hit,
        (p."content" ILIKE ${pattern} ESCAPE E'\\\\') AS content_hit,
        (u."name" ILIKE ${pattern} ESCAPE E'\\\\') AS author_hit,
        (c."name" ILIKE ${pattern} ESCAPE E'\\\\') AS category_hit,
        EXISTS (
          SELECT 1
          FROM "_PostToTag" pt
          INNER JOIN "tags" t ON t."id" = pt."B"
          WHERE pt."A" = p."id"
            AND t."deletedAt" IS NULL
            AND t."name" ILIKE ${pattern} ESCAPE E'\\\\'
        ) AS tags_hit,
        -- Keep the legacy relation predicate for candidate eligibility. The
        -- response metadata still ignores soft-deleted tags via tags_hit.
        EXISTS (
          SELECT 1
          FROM "_PostToTag" pt
          INNER JOIN "tags" t ON t."id" = pt."B"
          WHERE pt."A" = p."id"
            AND t."name" ILIKE ${pattern} ESCAPE E'\\\\'
        ) AS tag_candidate_hit
      FROM "posts" p
      LEFT JOIN "users" u ON u."id" = p."authorId"
      LEFT JOIN "categories" c ON c."id" = p."categoryId"
    ), candidates AS (
      SELECT
        "id",
        "createdAt",
        (
          CASE WHEN title_hit THEN ${PUBLIC_SEARCH_SCORE_WEIGHTS.title} ELSE 0 END
          + CASE WHEN excerpt_hit THEN ${PUBLIC_SEARCH_SCORE_WEIGHTS.excerpt} ELSE 0 END
          + CASE WHEN content_hit THEN ${PUBLIC_SEARCH_SCORE_WEIGHTS.content} ELSE 0 END
          + CASE WHEN author_hit THEN ${PUBLIC_SEARCH_SCORE_WEIGHTS.author} ELSE 0 END
          + CASE WHEN category_hit THEN ${PUBLIC_SEARCH_SCORE_WEIGHTS.category} ELSE 0 END
          + CASE WHEN tags_hit THEN ${PUBLIC_SEARCH_SCORE_WEIGHTS.tags} ELSE 0 END
        )::int AS score,
        ARRAY_REMOVE(
          ARRAY[
            CASE WHEN title_hit THEN 'title'::text ELSE NULL::text END,
            CASE WHEN excerpt_hit THEN 'excerpt'::text ELSE NULL::text END,
            CASE WHEN content_hit THEN 'content'::text ELSE NULL::text END,
            CASE WHEN author_hit THEN 'author'::text ELSE NULL::text END,
            CASE WHEN category_hit THEN 'category'::text ELSE NULL::text END,
            CASE WHEN tags_hit THEN 'tags'::text ELSE NULL::text END
          ],
          NULL::text
        ) AS "hitFields"
      FROM field_matches
      WHERE "published" = true
        AND "deletedAt" IS NULL
        AND (
          title_hit OR excerpt_hit OR content_hit OR author_hit OR category_hit OR tag_candidate_hit
        )
    ), ranked_page AS (
      SELECT "id", "createdAt", score, "hitFields"
      FROM candidates
      ORDER BY score DESC, "createdAt" DESC, "id" DESC
      OFFSET ${offset}
      LIMIT ${limit}
    )
    SELECT
      (SELECT COUNT(*)::int FROM candidates) AS "total",
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', ranked_page."id",
              'score', ranked_page.score,
              'hitFields', ranked_page."hitFields"
            )
            ORDER BY ranked_page.score DESC, ranked_page."createdAt" DESC, ranked_page."id" DESC
          )
          FROM ranked_page
        ),
        '[]'::jsonb
      ) AS "items"
  `

  const envelope = rankedRows[0]
  const rankedItems: RankedSearchItem[] = Array.isArray(envelope?.items)
    ? envelope.items.filter((item: unknown): item is RankedSearchItem => Boolean(item && typeof item === "object"))
    : []
  const total = toInteger(envelope?.total)
  const ids = rankedItems
    .map((item: RankedSearchItem) => item.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0)

  if (ids.length === 0) {
    return { items: [], total }
  }

  const hydratedPosts = (await prisma.post.findMany({
    where: {
      id: { in: ids },
      published: true,
      deletedAt: null,
    },
    include: PUBLIC_SEARCH_POST_INCLUDE,
  })) as unknown as SearchPostRecord[]

  const postsById = new Map(hydratedPosts.map((post) => [post.id, post]))
  const items = rankedItems.flatMap((rankedItem: RankedSearchItem) => {
    const post = postsById.get(rankedItem.id)
    if (!post) return []

    return [
      {
        ...post,
        searchMeta: {
          score: toInteger(rankedItem.score),
          hitFields: Array.isArray(rankedItem.hitFields) ? rankedItem.hitFields : [],
        },
      },
    ]
  })

  return { items, total }
}
