import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

describe('search and rate-limit database migration', () => {
  test('creates the production rate-limit table and trigram search indexes', () => {
    const migration = readFileSync(
      join(process.cwd(), 'prisma/migrations/202606060003_rate_limit_and_search_indexes/migration.sql'),
      'utf8',
    )

    expect(migration).toContain('CREATE EXTENSION IF NOT EXISTS pg_trgm')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "rate_limit_entries"')
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS')
    expect(migration).not.toContain('CREATE INDEX CONCURRENTLY')
    expect(migration).toContain('"posts_title_trgm_idx"')
    expect(migration).toContain('"posts_excerpt_trgm_idx"')
    expect(migration).toContain('"posts_content_trgm_idx"')
    expect(migration).toContain('gin_trgm_ops')
  })
})
