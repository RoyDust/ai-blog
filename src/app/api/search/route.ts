import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { clampPagination } from "@/lib/validation"

function contains(source: string | null | undefined, query: string) {
  return source?.toLowerCase().includes(query) ?? false
}

function getSearchMeta(
  post: {
    title?: string | null
    excerpt?: string | null
    content?: string | null
    author?: { name?: string | null } | null
    category?: { name?: string | null } | null
    tags?: Array<{ name?: string | null }>
  },
  query: string,
) {
  const hitFields: string[] = []
  let score = 0

  if (contains(post.title, query)) {
    hitFields.push('title')
    score += 12
  }
  if (contains(post.excerpt, query)) {
    hitFields.push('excerpt')
    score += 8
  }
  if (contains(post.content, query)) {
    hitFields.push('content')
    score += 4
  }
  if (contains(post.author?.name, query)) {
    hitFields.push('author')
    score += 3
  }
  if (contains(post.category?.name, query)) {
    hitFields.push('category')
    score += 2
  }
  if (post.tags?.some((tag) => contains(tag.name, query))) {
    hitFields.push('tags')
    score += 2
  }

  return { score, hitFields }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim() ?? ''
    const normalizedQuery = query.toLowerCase()

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const { page, limit } = clampPagination({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
    })

    const where: NonNullable<Parameters<typeof prisma.post.findMany>[0]>['where'] = {
      published: true,
      deletedAt: null,
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { excerpt: { contains: query, mode: 'insensitive' } },
        { content: { contains: query, mode: 'insensitive' } },
        { author: { name: { contains: query, mode: 'insensitive' } } },
        { category: { name: { contains: query, mode: 'insensitive' } } },
        { tags: { some: { name: { contains: query, mode: 'insensitive' } } } },
      ],
    }

    const [items, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          author: { select: { id: true, name: true, image: true } },
          category: true,
          tags: { where: { deletedAt: null } },
          _count: { select: { comments: { where: { deletedAt: null } }, likes: true } },
        },
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.post.count({ where }),
    ])

    const rankedItems = items
      .map((item: (typeof items)[number]) => ({
        ...item,
        searchMeta: getSearchMeta(item, normalizedQuery),
      }))
      .sort((left: ((typeof items)[number] & { searchMeta: ReturnType<typeof getSearchMeta> }), right: ((typeof items)[number] & { searchMeta: ReturnType<typeof getSearchMeta> })) => {
        if (right.searchMeta.score !== left.searchMeta.score) {
          return right.searchMeta.score - left.searchMeta.score
        }

        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      })

    return NextResponse.json({
      success: true,
      data: rankedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      meta: {
        query,
      },
    })
  } catch (error) {
    console.error('Search posts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
