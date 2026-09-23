/**
 * E2E ADMIN 账号 seed 脚本。
 *
 * 用途：
 * - CI / 本地 E2E 前执行，保证存在固定的 ADMIN 账号供 storageState 登录使用。
 * - 幂等：按邮箱 upsert，不覆盖已有密码（除非显式传入 E2E_ADMIN_PASSWORD）。
 *
 * 环境变量：
 * - DATABASE_URL（必填，沿用 .env）
 * - E2E_ADMIN_EMAIL（默认 e2e-admin@test.local）
 * - E2E_ADMIN_PASSWORD（默认 e2e-admin-password-2026，至少 8 位）
 */
const path = require('path')
const dotenv = require('dotenv')
const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')
const { Pool } = require('pg')
const { PrismaPg } = require('@prisma/adapter-pg')

dotenv.config({ path: path.resolve(process.cwd(), '.env') })
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not configured')
}

const email = process.env.E2E_ADMIN_EMAIL || 'e2e-admin@test.local'
const password = process.env.E2E_ADMIN_PASSWORD || 'e2e-admin-password-2026'

if (password.length < 8) {
  throw new Error('E2E_ADMIN_PASSWORD must be at least 8 characters')
}

const pool = new Pool({ connectionString })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  const hashed = await bcrypt.hash(password, 12)

  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hashed, role: 'ADMIN' },
    create: {
      name: 'E2E Admin',
      email,
      password: hashed,
      role: 'ADMIN',
    },
    select: { id: true, email: true, role: true },
  })

  console.log(`Seeded E2E admin: ${user.email} (${user.role})`)
}

main()
  .catch((error) => {
    console.error('Failed to seed E2E admin:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
