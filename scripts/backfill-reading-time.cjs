#!/usr/bin/env node

require('dotenv/config')

const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')

const CJK_CHARACTER_REGEX = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g
const LATIN_WORD_REGEX = /[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g
const READING_UNITS_PER_MINUTE = 300

function normalizeMarkdown(content) {
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, ' $1 ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, ' $1 ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function calculateReadingTimeMinutes(content) {
  const normalized = normalizeMarkdown(content)

  if (!normalized) {
    return 1
  }

  const cjkCharacterCount = (normalized.match(CJK_CHARACTER_REGEX) ?? []).length
  const latinWordCount = (normalized.replace(CJK_CHARACTER_REGEX, ' ').match(LATIN_WORD_REGEX) ?? []).length
  const readingUnits = cjkCharacterCount + latinWordCount

  return Math.max(1, Math.ceil(readingUnits / READING_UNITS_PER_MINUTE))
}

async function main() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured')
  }

  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  try {
    const posts = await prisma.post.findMany({
      select: { id: true, content: true, readingTimeMinutes: true },
    })

    let updatedCount = 0

    for (const post of posts) {
      const nextReadingTimeMinutes = calculateReadingTimeMinutes(post.content)

      if (post.readingTimeMinutes === nextReadingTimeMinutes) {
        continue
      }

      await prisma.post.update({
        where: { id: post.id },
        data: { readingTimeMinutes: nextReadingTimeMinutes },
      })

      updatedCount += 1
    }

    console.log(`Backfilled reading time for ${updatedCount} posts.`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('Backfill reading time failed:', error)
  process.exitCode = 1
})
