import { Prisma, PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { findDatabaseUrl } from './database-url'

/**
 * Prisma 客户端单例模块。
 *
 * 职责：
 * - 统一创建 Prisma + pg Pool 适配器
 * - 在开发环境复用全局单例，避免热更新反复建连
 * - 当 Prisma model 结构或连接池签名变化时，主动丢弃过期实例
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaPoolSignature: string | undefined
}

function toDelegateName(modelName: string) {
  return `${modelName.charAt(0).toLowerCase()}${modelName.slice(1)}`
}

/**
 * 校验当前 Prisma Client 是否仍然覆盖最新 schema 里的全部 model delegate。
 * 这可以减少热更新或 schema 变化后继续复用旧 client 导致的奇怪运行时错误。
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
 * 连接池签名用于判断“当前全局单例是否还能安全复用”。
 */
function getPoolSignature() {
  return `max=${readPoolMax()};connectionTimeout=10000;idleTimeout=30000;keepAlive=1`
}

/**
 * 创建新的 PrismaClient。
 *
 * 副作用：
 * - 读取 DATABASE_URL
 * - 建立 pg 连接池
 * - 返回绑定 PrismaPg adapter 的 PrismaClient
 */
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

/**
 * 全局共享的 Prisma 访问入口。
 * 业务层统一从这里拿 client，不要在其他模块自行 new PrismaClient。
 */
export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
  globalForPrisma.prismaPoolSignature = poolSignature
}
