const path = require('path')
const categoryCatalog = require('./category-catalog.json')

/**
 * 按 slug 幂等写入分类。
 * Category.slug 在软删除 + 部分唯一索引迁移后不再是 Prisma 层的 @unique，
 * 不能用 upsert({ where: { slug } })；改为"查未软删的同 slug 行 → 有则 update，无则 create"。
 */
async function seedCategories(prisma, catalog = categoryCatalog) {
  const results = []

  for (const category of catalog) {
    const existing = await prisma.category.findFirst({
      where: { slug: category.slug, deletedAt: null },
      select: { id: true },
    })

    const record = existing
      ? await prisma.category.update({
          where: { id: existing.id },
          data: {
            name: category.name,
            description: category.description,
          },
        })
      : await prisma.category.create({
          data: {
            name: category.name,
            slug: category.slug,
            description: category.description,
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
    const results = await seedCategories(prisma)

    console.log(`Seeded ${results.length} categories.`)
    for (const category of results) {
      console.log(`- ${category.name} (${category.slug})`)
    }
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

module.exports = { seedCategories }

if (require.main === module) {
  main().catch((error) => {
    console.error('Failed to seed categories:', error)
    process.exitCode = 1
  })
}
