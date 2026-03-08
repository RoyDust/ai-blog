const path = require('path')
const dotenv = require('dotenv')
const { PrismaClient } = require('@prisma/client')
const { Pool } = require('pg')
const { PrismaPg } = require('@prisma/adapter-pg')
const categoryCatalog = require('./category-catalog.json')

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not configured')
}

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const results = []

  for (const category of categoryCatalog) {
    const record = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
      },
      create: {
        name: category.name,
        slug: category.slug,
        description: category.description,
      },
    })

    results.push(record)
  }

  console.log(`Seeded ${results.length} categories.`)
  for (const category of results) {
    console.log(`- ${category.name} (${category.slug})`)
  }
}

main()
  .catch((error) => {
    console.error('Failed to seed categories:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
