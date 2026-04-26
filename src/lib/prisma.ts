import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { findDatabaseUrl } from './database-url'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaPoolSignature: string | undefined
}

function hasCurrentModelDelegates(client: PrismaClient | undefined) {
  return Boolean(client && 'aiModel' in client)
}

function readPoolMax() {
  const value = Number(process.env.DATABASE_POOL_MAX)

  return Number.isInteger(value) && value > 0 ? value : 1
}

function getPoolSignature() {
  return `max=${readPoolMax()};connectionTimeout=10000;idleTimeout=30000;keepAlive=1`
}

function createPrismaClient() {
  const connectionString = findDatabaseUrl()

  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured')
  }

  const pool = new Pool({
    connectionString,
    max: readPoolMax(),
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    keepAlive: true,
  })
  const adapter = new PrismaPg(pool)

  return new PrismaClient({ adapter })
}

const poolSignature = getPoolSignature()

if (
  globalForPrisma.prisma &&
  (!hasCurrentModelDelegates(globalForPrisma.prisma) || globalForPrisma.prismaPoolSignature !== poolSignature)
) {
  void globalForPrisma.prisma.$disconnect().catch(() => undefined)
  globalForPrisma.prisma = undefined
  globalForPrisma.prismaPoolSignature = undefined
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
  globalForPrisma.prismaPoolSignature = poolSignature
}
