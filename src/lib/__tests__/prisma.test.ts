import { afterEach, describe, expect, test, vi } from 'vitest'

const originalDatabaseUrl = process.env.DATABASE_URL

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
  vi.resetModules()
  resetGlobalPrisma()

  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl
  }
})

describe('lazy prisma client', () => {
  test('does not require DATABASE_URL during module import', async () => {
    await expect(importPrismaWithoutDatabaseUrl()).resolves.toHaveProperty('prisma')
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
})
