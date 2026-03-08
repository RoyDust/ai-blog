const path = require('path')
const dotenv = require('dotenv')
const { PrismaClient } = require('@prisma/client')
const { Pool } = require('pg')
const { PrismaPg } = require('@prisma/adapter-pg')
const engagementCatalog = require('./mock-engagement-catalog.json')

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not configured')
}

const pool = new Pool({ connectionString })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  let totalComments = 0
  let totalLikes = 0

  for (const item of engagementCatalog) {
    const post = await prisma.post.findUnique({ where: { slug: item.postSlug }, select: { id: true } })
    if (!post) {
      throw new Error(`Post not found: ${item.postSlug}`)
    }

    await prisma.comment.deleteMany({
      where: {
        postId: post.id,
        browserId: { startsWith: `seed-comment:${item.postSlug}:` },
      },
    })

    await prisma.like.deleteMany({
      where: {
        postId: post.id,
        browserId: { startsWith: `seed-like:${item.postSlug}:` },
      },
    })

    for (let index = 0; index < item.comments.length; index += 1) {
      const comment = item.comments[index]
      await prisma.comment.create({
        data: {
          postId: post.id,
          content: comment.content,
          browserId: `seed-comment:${item.postSlug}:${index + 1}`,
          authorLabel: `访客 ${index + 1}`,
        },
      })
      totalComments += 1
    }

    for (let index = 0; index < item.likes; index += 1) {
      await prisma.like.create({
        data: {
          postId: post.id,
          browserId: `seed-like:${item.postSlug}:${index + 1}`,
        },
      })
      totalLikes += 1
    }
  }

  console.log(`Seeded ${totalComments} comments and ${totalLikes} likes.`)
}

main()
  .catch((error) => {
    console.error('Failed to seed mock engagement:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
