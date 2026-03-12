import { prisma } from '@/lib/prisma'

const taxonomyPostSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  coverImage: true,
  createdAt: true,
  viewCount: true,
  author: {
    select: { id: true, name: true, image: true },
  },
  category: {
    select: { id: true, name: true, slug: true },
  },
  tags: {
    where: { deletedAt: null },
    select: { id: true, name: true, slug: true, color: true },
  },
  _count: {
    select: { comments: { where: { deletedAt: null } }, likes: true },
  },
} as const

export async function getCategoryDirectory() {
  return prisma.category.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      createdAt: true,
      _count: {
        select: { posts: { where: { deletedAt: null, published: true } } },
      },
    },
    orderBy: [{ posts: { _count: 'desc' } }, { name: 'asc' }],
  })
}

export async function getTagDirectory() {
  return prisma.tag.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      color: true,
      createdAt: true,
      _count: {
        select: { posts: { where: { deletedAt: null, published: true } } },
      },
    },
    orderBy: [{ posts: { _count: 'desc' } }, { name: 'asc' }],
  })
}

export async function getCategoryDetail(slug: string) {
  return prisma.category.findFirst({
    where: { slug, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      createdAt: true,
      _count: {
        select: { posts: { where: { deletedAt: null, published: true } } },
      },
      posts: {
        where: { deletedAt: null, published: true },
        select: taxonomyPostSelect,
        orderBy: { createdAt: 'desc' },
        take: 12,
      },
    },
  })
}

export async function getTagDetail(slug: string) {
  return prisma.tag.findFirst({
    where: { slug, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      color: true,
      createdAt: true,
      _count: {
        select: { posts: { where: { deletedAt: null, published: true } } },
      },
      posts: {
        where: { deletedAt: null, published: true },
        select: taxonomyPostSelect,
        orderBy: { createdAt: 'desc' },
        take: 12,
      },
    },
  })
}
