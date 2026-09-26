import { getWebReadiness } from '@/lib/web-readiness'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET() {
  const result = await getWebReadiness()
  return Response.json(result, { status: result.status === 'ready' ? 200 : 503, headers: { 'Cache-Control': 'no-store' } })
}
