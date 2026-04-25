import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { findDatabaseUrl } from './database-url'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function hasCurrentModelDelegates(client: PrismaClient | undefined) {
  return Boolean(client && 'aiModel' in client)
}

function createPrismaClient() {
  const connectionString = findDatabaseUrl()

  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured')
  }

  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)

  return new PrismaClient({ adapter })
}

if (globalForPrisma.prisma && !hasCurrentModelDelegates(globalForPrisma.prisma)) {
  void globalForPrisma.prisma.$disconnect().catch(() => undefined)
  globalForPrisma.prisma = undefined
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
