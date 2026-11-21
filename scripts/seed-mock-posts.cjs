const path = require('path')
const postCatalog = require('./mock-post-catalog.json')

/**
 * 按 slug 幂等写入示例文章。
 * Post.slug / Category.slug / Tag.slug 在软删除 + 部分唯一索引迁移后不再是 Prisma 层的 @unique，
 * 不能使用 upsert({ where: { slug } }) 或 findUnique({ where: { slug } })；
 * 统一改为按 `deletedAt: null` 查找活跃行，命中则按主键 id 更新，未命中则创建新行。
 */
async function seedMockPostsWithAuthor(prisma, catalog = postCatalog) {
  const author = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, email: true },
  })

  if (!author) {
    throw new Error('No admin user found to own mock posts')
  }

  const results = []

  for (const post of catalog) {
    const category = await prisma.category.findFirst({
      where: { slug: post.categorySlug, deletedAt: null },
      select: { id: true },
    })
    if (!category) {
      throw new Error(`Category not found: ${post.categorySlug}`)
    }

    const tags = await prisma.tag.findMany({
      where: { slug: { in: post.tagSlugs }, deletedAt: null },
      select: { id: true, slug: true },
    })

    if (tags.length !== post.tagSlugs.length) {
      const found = new Set(tags.map((tag) => tag.slug))
      const missing = post.tagSlugs.filter((slug) => !found.has(slug))
      throw new Error(`Missing tags for ${post.slug}: ${missing.join(', ')}`)
    }

    const existing = await prisma.post.findFirst({
      where: { slug: post.slug, deletedAt: null },
      select: { id: true },
    })

    const publishedAt = new Date(post.publishedAt)
    const tagRefs = tags.map((tag) => ({ id: tag.id }))

    const record = existing
      ? await prisma.post.update({
          where: { id: existing.id },
          data: {
            title: post.title,
            excerpt: post.excerpt,
            content: post.content,
            coverImage: post.coverImage,
            viewCount: post.viewCount,
            published: true,
            publishedAt,
            categoryId: category.id,
            authorId: author.id,
            tags: {
              set: [],
              connect: tagRefs,
            },
          },
        })
      : await prisma.post.create({
          data: {
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt,
            content: post.content,
            coverImage: post.coverImage,
            viewCount: post.viewCount,
            published: true,
            publishedAt,
            authorId: author.id,
            categoryId: category.id,
            tags: {
              connect: tagRefs,
            },
          },
        })

    results.push(record)
  }

  return { author, posts: results }
}

async function seedMockPosts(prisma, catalog = postCatalog) {
  const { posts } = await seedMockPostsWithAuthor(prisma, catalog)
  return posts
}

async function main() {
  const dotenv = require('dotenv')
  const { PrismaClient } = require('@prisma/client')
  const { Pool } = require('pg')
  const { PrismaPg } = require('@prisma/adapter-pg')

  dotenv.config({ path: path.resolve(process.cwd(), '.env') })

  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured')
  }

  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  try {
    const { author, posts } = await seedMockPostsWithAuthor(prisma)

    console.log(`Seeded ${posts.length} mock posts for ${author.name || author.email}.`)
    for (const post of posts) {
      console.log(`- ${post.title} (${post.slug})`)
    }
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

module.exports = { seedMockPosts }

if (require.main === module) {
  main().catch((error) => {
    console.error('Failed to seed mock posts:', error)
    process.exitCode = 1
  })
}
