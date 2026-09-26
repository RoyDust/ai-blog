import { defineConfig } from 'vitest/config'
import path from 'node:path'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('TEST_DATABASE_URL must identify a disposable PostgreSQL database')
const database = new URL(databaseUrl)
if (!/(_test|_p2)$/.test(database.pathname)) throw new Error('Integration database name must end in _test or _p2')
process.env.DATABASE_URL = databaseUrl
process.env.DATABASE_POOL_MAX = '10'

export default defineConfig({
  test: {
    environment: 'node', include: ['tests/integration/**/*.test.ts'],
    maxWorkers: 1, fileParallelism: false, testTimeout: 20000, hookTimeout: 20000,
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
