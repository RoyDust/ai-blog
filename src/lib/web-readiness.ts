import { prisma } from '@/lib/prisma'
import { getWebReadinessConfig } from './web-readiness-config'

const DATABASE_BUDGET_MS = 2000
// A timed-out adapter call may still be acquiring a connection. Do not accumulate probes behind it.
let outstandingProbe: Promise<boolean> | undefined
async function probeDatabase() {
  if (outstandingProbe) return false
  // A raw read settles only after adapter acquisition/query settles. An interactive
  // transaction can reject on maxWait while still acquiring its connection.
  const probe = prisma.$queryRawUnsafe('SELECT 1').then(() => true, () => false)
  outstandingProbe = probe
  void probe.finally(() => { if (outstandingProbe === probe) outstandingProbe = undefined })
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([probe, new Promise<false>((resolve) => { timer = setTimeout(() => resolve(false), DATABASE_BUDGET_MS) })])
  } finally { if (timer) clearTimeout(timer) }
}

export async function getWebReadiness() {
  let valid = false
  try { valid = getWebReadinessConfig().valid } catch { /* Configuration resolution must fail closed without disclosing filesystem errors. */ }
  if (!valid) return { status: 'not_ready', checks: { configuration: 'failed', database: 'skipped' } } as const
  let connected = false
  try { connected = await probeDatabase() } catch { /* Client resolution can fail before returning a promise. */ }
  return { status: connected ? 'ready' : 'not_ready', checks: { configuration: 'passed', database: connected ? 'passed' : 'failed' } } as const
}
