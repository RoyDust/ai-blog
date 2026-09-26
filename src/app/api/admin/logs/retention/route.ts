import { NextResponse } from 'next/server'
import { withApiOperationLogging } from '@/lib/api-operation-log-route'
import { requireAdminSession } from '@/lib/api-auth'
import { toErrorResponse } from '@/lib/api-errors'
import { runApiOperationLogRetention } from '@/lib/api-operation-log-retention'

async function POSTHandler() {
  try {
    await requireAdminSession()
    return NextResponse.json({ success: true, data: await runApiOperationLogRetention('admin') })
  } catch (error) { return toErrorResponse(error) }
}
export const POST = withApiOperationLogging(POSTHandler, { scope: 'admin', operation: 'admin.logs.retention.run', route: '/api/admin/logs/retention' })
