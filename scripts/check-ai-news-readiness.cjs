const path = require('path')
const dotenv = require('dotenv')
const { PrismaClient } = require('@prisma/client')
const { Pool } = require('pg')
const { PrismaPg } = require('@prisma/adapter-pg')

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const connectionString = process.env.DATABASE_URL

function fail(message) {
  return { ok: false, message }
}

function pass(message) {
  return { ok: true, message }
}

function readPositiveIntegerEnv(key, fallback) {
  const value = Number(process.env[key])
  return Number.isInteger(value) && value > 0 ? value : fallback
}

async function main() {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured')
  }

  const pool = new Pool({ connectionString, max: 1 })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })
  const checks = []

  try {
    const tables = await prisma.$queryRawUnsafe(`
      SELECT
        to_regclass('public.ai_news_sources') IS NOT NULL AS "hasSources",
        to_regclass('public.ai_news_candidates') IS NOT NULL AS "hasCandidates"
    `)
    const tableStatus = tables[0] || {}
    checks.push(tableStatus.hasSources && tableStatus.hasCandidates
      ? pass('AI news source/candidate tables exist')
      : fail('AI news source/candidate migration has not been applied'))

    if (tableStatus.hasSources) {
      const sourceRows = await prisma.$queryRawUnsafe(`
        SELECT "type"::text AS "type", COUNT(*)::int AS "count"
        FROM "ai_news_sources"
        WHERE "enabled" = true
        GROUP BY "type"
        ORDER BY "type"
      `)
      const sourceTypes = new Map(sourceRows.map((row) => [row.type, row.count]))
      checks.push((sourceTypes.get('RSS') || 0) > 0
        ? pass(`Enabled RSS sources: ${sourceTypes.get('RSS')}`)
        : fail('No enabled RSS sources found'))
      checks.push((sourceTypes.get('HACKERNEWS') || 0) > 0
        ? pass(`Enabled Hacker News sources: ${sourceTypes.get('HACKERNEWS')}`)
        : fail('No enabled Hacker News source found'))
      checks.push((sourceTypes.get('GITHUB_RELEASES') || 0) > 0
        ? pass(`Enabled GitHub release sources: ${sourceTypes.get('GITHUB_RELEASES')}`)
        : fail('No enabled GitHub release sources found'))
    }

    const adminRows = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS "count"
      FROM "users"
      WHERE "role" = 'ADMIN'
    `)
    checks.push((adminRows[0]?.count || 0) > 0
      ? pass(`Admin authors available: ${adminRows[0].count}`)
      : fail('No ADMIN user exists for cron-authored daily AI news'))

    const modelRows = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS "count"
      FROM "ai_models"
      WHERE "enabled" = true
        AND 'post-summary' = ANY("capabilities")
    `).catch(() => [{ count: 0 }])
    const hasEnvModel = Boolean(process.env.DASHSCOPE_API_KEY || process.env.AI_OPENAI_COMPAT_API_KEY)
    checks.push((modelRows[0]?.count || 0) > 0 || hasEnvModel
      ? pass(`Post-summary model source available: ${(modelRows[0]?.count || 0) > 0 ? 'database' : 'environment'}`)
      : fail('No enabled post-summary AI model or compatible API key is configured'))

    checks.push(process.env.AI_NEWS_CRON_SECRET?.trim()
      ? pass('AI_NEWS_CRON_SECRET is configured')
      : fail('AI_NEWS_CRON_SECRET is not configured'))

    checks.push(pass(`AI call budget: score<=${readPositiveIntegerEnv('AI_NEWS_MAX_CANDIDATES_TO_SCORE', 24)}, factCards<=${readPositiveIntegerEnv('AI_NEWS_MAX_FACT_CARDS', 12)}, concurrency=${readPositiveIntegerEnv('AI_NEWS_AI_CONCURRENCY', 3)}`))

    for (const check of checks) {
      console.log(`${check.ok ? 'OK' : 'FAIL'} ${check.message}`)
    }

    if (checks.some((check) => !check.ok)) {
      process.exitCode = 1
    }
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((error) => {
  console.error('Failed to check AI news readiness:', error)
  process.exitCode = 1
})
