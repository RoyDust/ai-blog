import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NextResponse } from 'next/server'

// This legacy bootstrap endpoint is intentionally disabled. Admin grants must
// go through a controlled database or deployment-time process, not a public API.
async function POSTHandler() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export const POST = withApiOperationLogging(POSTHandler, { scope: 'admin', operation: 'admin.setadmin.create', route: '/api/admin/set-admin' });
