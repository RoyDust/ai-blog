import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NotFoundError, toErrorResponse } from '@/lib/api-errors'

// This legacy bootstrap endpoint is intentionally disabled. Admin grants must
// go through a controlled database or deployment-time process, not a public API.
async function POSTHandler() {
  return toErrorResponse(new NotFoundError('Not found'))
}

export const POST = withApiOperationLogging(POSTHandler, { scope: 'admin', operation: 'admin.setadmin.create', route: '/api/admin/set-admin' });
