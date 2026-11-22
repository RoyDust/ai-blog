import { afterEach, describe, expect, test, vi } from 'vitest'

const originalDatabaseUrl = process.env.DATABASE_URL
const originalDatabasePoolMax = process.env.DATABASE_POOL_MAX

async function importPrismaWithoutDatabaseUrl() {
  delete process.env.DATABASE_URL
  vi.resetModules()
  vi.doMock('../database-url', () => ({
    findDatabaseUrl: () => undefined,
  }))

  return import('../prisma')
}

function resetGlobalPrisma() {
  const globalForPrisma = globalThis as unknown as {
    prisma: unknown
    prismaPoolSignature: unknown
  }

  globalForPrisma.prisma = undefined
  globalForPrisma.prismaPoolSignature = undefined
}

afterEach(() => {
  vi.doUnmock('../database-url')
  vi.doUnmock('pg')
  vi.doUnmock('@prisma/adapter-pg')
  vi.doUnmock('@prisma/client')
  vi.unstubAllEnvs()
  vi.resetModules()
  resetGlobalPrisma()

  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl
  }

  if (originalDatabasePoolMax === undefined) {
    delete process.env.DATABASE_POOL_MAX
  } else {
    process.env.DATABASE_POOL_MAX = originalDatabasePoolMax
  }
})

describe('lazy prisma client', () => {
  test('does not require DATABASE_URL during module import', async () => {
    await expect(importPrismaWithoutDatabaseUrl()).resolves.toHaveProperty('prisma')
  })

  test('is not treated as a thenable when returned from an async function without DATABASE_URL', async () => {
    const { prisma } = await importPrismaWithoutDatabaseUrl()
    const getAsyncPrisma = async () => prisma

    await expect(getAsyncPrisma()).resolves.toBe(prisma)
  })

  test('rejects query execution with a clear missing database error', async () => {
    const { prisma } = await importPrismaWithoutDatabaseUrl()
    const prismaForTest = prisma as unknown as {
      user: {
        findMany: () => Promise<unknown>
      }
    }

    await expect(prismaForTest.user.findMany()).rejects.toThrow('DATABASE_URL is not configured')
  })

  test('allows adapters to read model delegates before runtime secrets are available', async () => {
    const { prisma } = await importPrismaWithoutDatabaseUrl()
    const prismaForTest = prisma as unknown as {
      user: {
        create: (args: unknown) => Promise<unknown>
      }
    }

    expect(() => prismaForTest.user.create).not.toThrow()
    await expect(prismaForTest.user.create({ data: {} })).rejects.toThrow('DATABASE_URL is not configured')
  })

  test('defaults DATABASE_POOL_MAX to 8 in production and 1 outside production when unset or invalid', async () => {
    const { readPoolMax } = await import('../prisma')

    delete process.env.DATABASE_POOL_MAX
    vi.stubEnv('NODE_ENV', 'production')
    expect(readPoolMax()).toBe(8)

    for (const invalidValue of ['', '0', '-4', '2.5', 'invalid']) {
      vi.stubEnv('DATABASE_POOL_MAX', invalidValue)
      expect(readPoolMax()).toBe(8)
    }

    delete process.env.DATABASE_POOL_MAX
    vi.stubEnv('NODE_ENV', 'test')
    expect(readPoolMax()).toBe(1)

    vi.stubEnv('NODE_ENV', 'development')
    expect(readPoolMax()).toBe(1)

    vi.stubEnv('DATABASE_POOL_MAX', '12')
    expect(readPoolMax()).toBe(12)

    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('DATABASE_POOL_MAX', '3')
    expect(readPoolMax()).toBe(3)
  })

  test('creates pg Pool with production default max=8 when DATABASE_POOL_MAX is unset', async () => {
    delete process.env.DATABASE_POOL_MAX
    vi.stubEnv('NODE_ENV', 'production')
    vi.resetModules()

    const poolConstructor = vi.fn(function MockPool() {})
    const adapterConstructor = vi.fn(function MockPrismaPg() {})
    const clientConstructor = vi.fn(function MockPrismaClient() {
      return {
        user: { findMany: vi.fn().mockResolvedValue([]) },
        $disconnect: vi.fn().mockResolvedValue(undefined),
      }
    })

    vi.doMock('../database-url', () => ({
      findDatabaseUrl: () => 'postgresql://postgres:postgres@127.0.0.1:5432/test_db',
    }))
    vi.doMock('pg', () => ({ Pool: poolConstructor }))
    vi.doMock('@prisma/adapter-pg', () => ({ PrismaPg: adapterConstructor }))
    vi.doMock('@prisma/client', () => ({
      Prisma: { ModelName: { User: 'User' } },
      PrismaClient: clientConstructor,
    }))

    const { prisma } = await import('../prisma')
    await (prisma as unknown as { user: { findMany: () => Promise<unknown[]> } }).user.findMany()

    expect(poolConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionString: 'postgresql://postgres:postgres@127.0.0.1:5432/test_db',
        max: 8,
      }),
    )
  })
})
