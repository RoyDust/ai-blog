import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeAll, describe, expect, test } from 'vitest'
import { parse } from 'dotenv'

const root = process.cwd()
const valid = { DATABASE_URL: 'postgresql://test:private-password@localhost/app', AUTH_SECRET: 'existing-private-auth-value', NEXTAUTH_SECRET: 'separate-private-nextauth-value', NEXTAUTH_URL: 'http://localhost:3000', NEXT_PUBLIC_SITE_URL: 'https://site.test' }
beforeAll(() => { execFileSync(process.execPath, ['scripts/build-web-health.cjs'], { cwd: root }) })

function prepare(values: Record<string, string>, project = 'current') {
  const dir = mkdtempSync(path.join(tmpdir(), 'inkforge-env-preflight-'))
  const file = path.join(dir, 'app.env')
  const original = Object.entries(values).map(([key, value]) => key + '=' + JSON.stringify(value)).join('\n') + '\n'
  writeFileSync(file, original)
  try {
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/prepare-production-env.cjs'), file], {
      encoding: 'utf8', env: { ...process.env, ...valid, DEPLOY_COMPOSE_PROJECT_NAME: project },
    })
    if (result.error) throw result.error
    return { ...result, original, content: readFileSync(file, 'utf8') }
  } finally { rmSync(dir, { recursive: true, force: true }) }
}

describe('production environment preflight', () => {
  test('retains two valid existing secrets and fixes the Compose identity', () => {
    const r = prepare(valid)
    expect(r.status).toBe(0)
    expect(parse(r.content)).toEqual({ ...valid, COMPOSE_PROJECT_NAME: 'current' })
  })
  test.each(['', 'replace-with-a-long-random-secret'])('aligns an invalid alias without rotating AUTH_SECRET: %s', (value) => {
    const r = prepare({ ...valid, NEXTAUTH_SECRET: value })
    expect(r.status).toBe(0)
    expect(parse(r.content).AUTH_SECRET).toBe(valid.AUTH_SECRET)
    expect(parse(r.content).NEXTAUTH_SECRET).toBe('${AUTH_SECRET}')
    expect(r.stdout + r.stderr).not.toContain(valid.AUTH_SECRET)
    expect(r.stdout + r.stderr).not.toContain('private-password')
  })
  test('accepts a previously normalized alias without duplicating it', () => {
    const r = prepare({ ...valid, NEXTAUTH_SECRET: '${AUTH_SECRET}', COMPOSE_PROJECT_NAME: 'current' })
    expect(r.status).toBe(0)
    expect(r.content).toBe(r.original)
  })
  test('does not use inherited CI defaults for missing production values', () => {
    const r = prepare({ ...valid, DATABASE_URL: '' })
    expect(r.status).toBe(1)
    expect(r.content).toBe(r.original)
  })
  test('fails without modifying invalid authentication configuration', () => {
    const r = prepare({ ...valid, AUTH_SECRET: 'changeme', NEXTAUTH_SECRET: '' })
    expect(r.status).toBe(1)
    expect(r.content).toBe(r.original)
  })
  test('rejects an invalid Compose project before modifying the file', () => {
    const r = prepare(valid, 'current;echo private')
    expect(r.status).toBe(1)
    expect(r.content).toBe(r.original)
  })
  test('accepts https public URLs and loopback http URLs while rejecting plaintext non-loopback URLs', () => {
    expect(prepare({ ...valid, NEXTAUTH_URL: 'https://blog.example.com', NEXT_PUBLIC_SITE_URL: 'https://blog.example.com' }).status).toBe(0)
    expect(prepare({ ...valid, NEXTAUTH_URL: 'http://127.0.0.1:3000', NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3000' }).status).toBe(0)

    for (const insecureUrl of ['http://blog.example.com', 'http://47.98.167.32']) {
      const badAuthUrl = prepare({ ...valid, NEXTAUTH_URL: insecureUrl })
      expect(badAuthUrl.status).toBe(1)
      expect(badAuthUrl.content).toBe(badAuthUrl.original)

      const badSiteUrl = prepare({ ...valid, NEXT_PUBLIC_SITE_URL: insecureUrl })
      expect(badSiteUrl.status).toBe(1)
      expect(badSiteUrl.content).toBe(badSiteUrl.original)
    }
  })
  test('preserves literal $ in single-quoted cron secrets across dotenv.parse and read-dotenv.cjs', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { parseEnvFile, parseDotenvFallback } = require(path.join(root, 'scripts/deploy/read-dotenv.cjs')) as {
      parseEnvFile: (filePath: string) => Record<string, string>
      parseDotenvFallback: (source: string) => Record<string, string>
    }
    const dir = mkdtempSync(path.join(tmpdir(), 'inkforge-env-dollar-'))
    const file = path.join(dir, 'app.env')
    const aiSecret = 'ai$secret${UNSET}$$literal"slash\\end'
    const cronSecret = 'cron$secret${PATH}$$123!#space '
    try {
      const raw = [
        ...Object.entries(valid).map(([k, v]) => `${k}=${JSON.stringify(v)}`),
        `AI_NEWS_CRON_SECRET='${aiSecret}'`,
        `CRON_SECRET='${cronSecret}'`,
      ].join('\n') + '\n'
      writeFileSync(file, raw)
      const res = spawnSync(process.execPath, [path.join(root, 'scripts/prepare-production-env.cjs'), file], {
        encoding: 'utf8',
        env: { ...process.env, DEPLOY_COMPOSE_PROJECT_NAME: 'current' },
      })
      expect(res.status).toBe(0)
      const finalContent = readFileSync(file, 'utf8')
      expect(parse(finalContent).AI_NEWS_CRON_SECRET).toBe(aiSecret)
      expect(parse(finalContent).CRON_SECRET).toBe(cronSecret)
      expect(parseEnvFile(file).AI_NEWS_CRON_SECRET).toBe(aiSecret)
      expect(parseEnvFile(file).CRON_SECRET).toBe(cronSecret)
      expect(parseDotenvFallback(finalContent).AI_NEWS_CRON_SECRET).toBe(aiSecret)
      expect(parseDotenvFallback(finalContent).CRON_SECRET).toBe(cronSecret)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
