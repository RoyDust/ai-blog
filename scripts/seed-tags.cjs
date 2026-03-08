const path = require('path')
const dotenv = require('dotenv')
const { PrismaClient } = require('@prisma/client')
const { Pool } = require('pg')
const { PrismaPg } = require('@prisma/adapter-pg')
const tagCatalog = require('./tag-catalog.json')

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

  for (const tag of tagCatalog) {
    const record = await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: {
        name: tag.name,
        color: tag.color,
      },
      create: {
        name: tag.name,
        slug: tag.slug,
        color: tag.color,
      },
    })

    results.push(record)
  }

  console.log(`Seeded ${results.length} tags.`)
  for (const tag of results) {
    console.log(`- ${tag.name} (${tag.slug})`)
  }
}

main()
  .catch((error) => {
    console.error('Failed to seed tags:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
