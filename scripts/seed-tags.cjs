const path = require('path')
const tagCatalog = require('./tag-catalog.json')

/**
 * 按 slug 幂等写入标签。
 * Tag.slug 在软删除 + 部分唯一索引迁移后不再是 Prisma 层的 @unique，
 * 不能用 upsert({ where: { slug } })；改为"查未软删的同 slug 行 → 有则 update，无则 create"。
 */
async function seedTags(prisma, catalog = tagCatalog) {
  const results = []

  for (const tag of catalog) {
    const existing = await prisma.tag.findFirst({
      where: { slug: tag.slug, deletedAt: null },
      select: { id: true },
    })

    const record = existing
      ? await prisma.tag.update({
          where: { id: existing.id },
          data: {
            name: tag.name,
            color: tag.color,
          },
        })
      : await prisma.tag.create({
          data: {
            name: tag.name,
            slug: tag.slug,
            color: tag.color,
          },
        })

    results.push(record)
  }

  return results
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
    const results = await seedTags(prisma)

    console.log(`Seeded ${results.length} tags.`)
    for (const tag of results) {
      console.log(`- ${tag.name} (${tag.slug})`)
    }
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

module.exports = { seedTags }

if (require.main === module) {
  main().catch((error) => {
    console.error('Failed to seed tags:', error)
    process.exitCode = 1
  })
}
