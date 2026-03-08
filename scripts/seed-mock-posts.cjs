const path = require('path')
const dotenv = require('dotenv')
const { PrismaClient } = require('@prisma/client')
const { Pool } = require('pg')
const { PrismaPg } = require('@prisma/adapter-pg')
const postCatalog = require('./mock-post-catalog.json')

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not configured')
}

const pool = new Pool({ connectionString })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  const author = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, email: true },
  })

  if (!author) {
    throw new Error('No admin user found to own mock posts')
  }

  const created = []

  for (const post of postCatalog) {
    const category = await prisma.category.findUnique({ where: { slug: post.categorySlug }, select: { id: true } })
    if (!category) {
      throw new Error(`Category not found: ${post.categorySlug}`)
    }

    const tags = await prisma.tag.findMany({
      where: { slug: { in: post.tagSlugs } },
      select: { id: true, slug: true },
    })

    if (tags.length !== post.tagSlugs.length) {
      const found = new Set(tags.map((tag) => tag.slug))
      const missing = post.tagSlugs.filter((slug) => !found.has(slug))
      throw new Error(`Missing tags for ${post.slug}: ${missing.join(', ')}`)
    }

    const record = await prisma.post.upsert({
      where: { slug: post.slug },
      update: {
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        coverImage: post.coverImage,
        viewCount: post.viewCount,
        published: true,
        publishedAt: new Date(post.publishedAt),
        categoryId: category.id,
        authorId: author.id,
        tags: {
          set: [],
          connect: tags.map((tag) => ({ id: tag.id })),
        },
      },
      create: {
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content,
        coverImage: post.coverImage,
        viewCount: post.viewCount,
        published: true,
        publishedAt: new Date(post.publishedAt),
        authorId: author.id,
        categoryId: category.id,
        tags: {
          connect: tags.map((tag) => ({ id: tag.id })),
        },
      },
    })

    created.push(record)
  }

  console.log(`Seeded ${created.length} mock posts for ${author.name || author.email}.`)
  for (const post of created) {
    console.log(`- ${post.title} (${post.slug})`)
  }
}

main()
  .catch((error) => {
    console.error('Failed to seed mock posts:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
