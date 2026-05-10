import { Prisma, PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { findDatabaseUrl } from './database-url'

/**
 * Prisma client singleton module.
 *
 * Responsibilities:
 * - Create the Prisma + pg Pool adapter in one place.
 * - Reuse the global singleton during development to avoid reconnecting on hot reload.
 * - Drop stale clients when the model shape or pool signature changes.
 * - Keep module import safe during Docker/Next.js build-time route collection, where
 *   runtime-only secrets such as DATABASE_URL are intentionally unavailable.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaPoolSignature: string | undefined
}

const MISSING_DATABASE_URL_MESSAGE = 'DATABASE_URL is not configured'
let localPrisma: PrismaClient | undefined
let localPrismaPoolSignature: string | undefined

function toDelegateName(modelName: string) {
  return `${modelName.charAt(0).toLowerCase()}${modelName.slice(1)}`
}

/**
 * Checks whether the current Prisma Client still exposes every model delegate in
 * the latest schema. This avoids reusing an outdated client after hot reloads or
 * schema changes.
 */
function hasCurrentModelDelegates(client: PrismaClient | undefined) {
  return Boolean(
    client &&
      Object.values(Prisma.ModelName).every((modelName) => toDelegateName(modelName) in client),
  )
}

function readPoolMax() {
  const value = Number(process.env.DATABASE_POOL_MAX)

  return Number.isInteger(value) && value > 0 ? value : 1
}

/**
 * Pool signature used to decide whether the global singleton can still be reused.
 */
function getPoolSignature() {
  return `max=${readPoolMax()};connectionTimeout=10000;idleTimeout=30000;keepAlive=1`
}

/**
 * Creates a new PrismaClient.
 *
 * Side effects:
 * - Reads DATABASE_URL.
 * - Opens the pg connection pool.
 * - Returns a PrismaClient bound to the PrismaPg adapter.
 */
function createPrismaClient(connectionString: string) {
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

function createUnavailablePrismaOperation(path: string): unknown {
  return new Proxy(function unavailablePrismaOperation() {}, {
    get(_target, property) {
      if (property === 'then' || property === 'catch' || property === 'finally') {
        return undefined
      }

      if (property === 'toString') {
        return () => `[Unavailable Prisma operation: ${path}]`
      }

      return createUnavailablePrismaOperation(`${path}.${String(property)}`)
    },
    apply() {
      return Promise.reject(new Error(MISSING_DATABASE_URL_MESSAGE))
    },
  })
}

function createUnavailablePrismaClient() {
  const delegates = new Map<PropertyKey, unknown>()

  return new Proxy({} as PrismaClient, {
    get(_target, property) {
      if (property === Symbol.toStringTag) {
        return 'PrismaClient'
      }

      if (property === '$disconnect') {
        return async () => undefined
      }

      if (property === '$connect' || property === '$transaction' || property === '$executeRaw' || property === '$queryRaw') {
        return () => Promise.reject(new Error(MISSING_DATABASE_URL_MESSAGE))
      }

      if (property === '$on' || property === '$use') {
        return () => undefined
      }

      if (property === '$extends') {
        return () => createUnavailablePrismaClient()
      }

      if (!delegates.has(property)) {
        delegates.set(property, createUnavailablePrismaOperation(String(property)))
      }

      return delegates.get(property)
    },
  })
}

const unavailablePrisma = createUnavailablePrismaClient()

function resolvePrismaClient() {
  const connectionString = findDatabaseUrl()

  if (!connectionString) {
    return unavailablePrisma
  }

  const poolSignature = getPoolSignature()
  const currentClient = process.env.NODE_ENV === 'production' ? localPrisma : globalForPrisma.prisma
  const currentPoolSignature =
    process.env.NODE_ENV === 'production' ? localPrismaPoolSignature : globalForPrisma.prismaPoolSignature

  if (
    currentClient &&
    (!hasCurrentModelDelegates(currentClient) || currentPoolSignature !== poolSignature)
  ) {
    void currentClient.$disconnect().catch(() => undefined)

    if (process.env.NODE_ENV === 'production') {
      localPrisma = undefined
      localPrismaPoolSignature = undefined
    } else {
      globalForPrisma.prisma = undefined
      globalForPrisma.prismaPoolSignature = undefined
    }
  }

  const reusableClient = process.env.NODE_ENV === 'production' ? localPrisma : globalForPrisma.prisma
  const client = reusableClient ?? createPrismaClient(connectionString)

  if (process.env.NODE_ENV === 'production') {
    localPrisma = client
    localPrismaPoolSignature = poolSignature
  } else {
    globalForPrisma.prisma = client
    globalForPrisma.prismaPoolSignature = poolSignature
  }

  return client
}

/**
 * Shared Prisma access point. Business code should import this client instead of
 * constructing PrismaClient directly.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = resolvePrismaClient()
    const value = Reflect.get(client, property)

    return client !== unavailablePrisma && typeof value === 'function' ? value.bind(client) : value
  },
})
