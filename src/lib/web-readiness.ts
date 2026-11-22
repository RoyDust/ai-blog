import { prisma } from '@/lib/prisma'
import { getWebReadinessConfig } from './web-readiness-config'

const DATABASE_BUDGET_MS = 2000
// A timed-out adapter call may still be acquiring a connection. Do not accumulate probes behind it,
// while still coalescing healthy concurrent callers within the active budget window.
let outstandingProbe: Promise<boolean> | undefined
let outstandingTimedOut = false
async function probeDatabase() {
  if (outstandingProbe) {
    if (outstandingTimedOut) return false
    let sharedTimer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        outstandingProbe,
        new Promise<false>((resolve) => {
          sharedTimer = setTimeout(() => {
            outstandingTimedOut = true
            resolve(false)
          }, DATABASE_BUDGET_MS)
        }),
      ])
    } finally {
      if (sharedTimer) clearTimeout(sharedTimer)
    }
  }
  // A raw read settles only after adapter acquisition/query settles. An interactive
  // transaction can reject on maxWait while still acquiring its connection.
  outstandingTimedOut = false
  const probe = prisma.$queryRawUnsafe('SELECT 1').then(() => true, () => false)
  outstandingProbe = probe
  void probe.finally(() => {
    if (outstandingProbe === probe) {
      outstandingProbe = undefined
      outstandingTimedOut = false
    }
  })
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      probe,
      new Promise<false>((resolve) => {
        timer = setTimeout(() => {
          if (outstandingProbe === probe) outstandingTimedOut = true
          resolve(false)
        }, DATABASE_BUDGET_MS)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function getWebReadiness() {
  let valid = false
  try { valid = getWebReadinessConfig().valid } catch { /* Configuration resolution must fail closed without disclosing filesystem errors. */ }
  if (!valid) return { status: 'not_ready', checks: { configuration: 'failed', database: 'skipped' } } as const
  let connected = false
  try { connected = await probeDatabase() } catch { /* Client resolution can fail before returning a promise. */ }
  return { status: connected ? 'ready' : 'not_ready', checks: { configuration: 'passed', database: connected ? 'passed' : 'failed' } } as const
}
