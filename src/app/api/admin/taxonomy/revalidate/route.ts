import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/api-auth'
import { ValidationError, toErrorResponse } from '@/lib/api-errors'
import { withApiOperationLogging } from '@/lib/api-operation-log-route'
import { revalidatePublicPathsStrict } from '@/lib/cache'

const directoryPaths = new Set(['/', '/posts', '/archives', '/series', '/categories', '/tags', '/search', '/rss.xml', '/sitemap.xml'])
async function POSTHandler(request: Request) {
  try {
    await requireAdminSession()
    const body = await request.json()
    const paths: unknown = body?.paths
    if (!Array.isArray(paths) || !paths.length || paths.length > 500 || paths.some((path) =>
      typeof path !== 'string' || (!directoryPaths.has(path) && !/^\/(posts|categories|tags|series|guides)\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path)))) {
      throw new ValidationError('Invalid public cache paths')
    }
    const result = revalidatePublicPathsStrict(paths)
    if (result.errors.length) console.error('Taxonomy cache retry failed', result.errors)
    return NextResponse.json({ success: result.errors.length === 0, data: { paths: result.paths, failedPaths: result.errors.map(({ path }) => path) } }, { status: result.errors.length ? 503 : 200 })
  } catch (error) { return toErrorResponse(error) }
}
export const POST = withApiOperationLogging(POSTHandler, { scope: 'admin', operation: 'admin.taxonomy.revalidate', route: '/api/admin/taxonomy/revalidate' })
