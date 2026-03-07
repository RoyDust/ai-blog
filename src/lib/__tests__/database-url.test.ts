import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { findDatabaseUrl, parseEnvValue } from '../database-url'

const originalDatabaseUrl = process.env.DATABASE_URL

/**
 * 每个用例结束后恢复原始环境变量，避免不同测试之间互相污染。
 */
afterEach(() => {
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl
  }
})

describe('database url resolution', () => {
  test('parses quoted env values', () => {
    expect(parseEnvValue('DATABASE_URL="postgres://example"', 'DATABASE_URL')).toBe('postgres://example')
  })

  test('prefers process env when present', () => {
    process.env.DATABASE_URL = 'postgres://runtime'
    expect(findDatabaseUrl('C:/missing')).toBe('postgres://runtime')
  })

  test('finds DATABASE_URL from ancestor env file', () => {
    delete process.env.DATABASE_URL

    // 模拟“仓库根目录有 .env，而工作树目录本身没有 .env”的场景。
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-db-url-'))
    const worktreeDir = path.join(tempRoot, '.worktrees', 'feature-branch')
    fs.mkdirSync(worktreeDir, { recursive: true })
    fs.writeFileSync(path.join(tempRoot, '.env'), 'DATABASE_URL="postgres://from-root"\n', 'utf8')

    expect(findDatabaseUrl(worktreeDir)).toBe('postgres://from-root')
  })
})
