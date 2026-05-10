import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NextResponse } from 'next/server'

async function POSTHandler() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export const POST = withApiOperationLogging(POSTHandler, { scope: 'admin', operation: 'admin.setadmin.create', route: '/api/admin/set-admin' });
