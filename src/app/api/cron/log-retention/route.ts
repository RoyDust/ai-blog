import { NextResponse } from 'next/server'
import { withApiOperationLogging } from '@/lib/api-operation-log-route'
import { requireInternalSecret } from '@/lib/internal-secrets'
import { toErrorResponse } from '@/lib/api-errors'
import { runApiOperationLogRetention } from '@/lib/api-operation-log-retention'

async function POSTHandler(request: Request) {
  try {
    requireInternalSecret(request, { secretName: 'CRON_SECRET', envKeys: ['CRON_SECRET'] })
    return NextResponse.json({ success: true, data: await runApiOperationLogRetention('cron') })
  } catch (error) { return toErrorResponse(error) }
}
export const POST = withApiOperationLogging(POSTHandler, { scope: 'cron', operation: 'cron.logRetention.run', route: '/api/cron/log-retention' })
