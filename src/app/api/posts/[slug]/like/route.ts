import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { resolveAnonymousActor } from '@/lib/anonymous-actor'
import { getLikeState, toggleLike, type LikeIdentity } from '@/lib/likes'
import { checkInteractionRateLimit } from '@/lib/rate-limit'
import { NotFoundError, toErrorResponse, TooManyRequestsError } from '@/lib/api-errors'

async function resolveLikeIdentity(request: Request): Promise<LikeIdentity> {
  const session = await getServerSession(authOptions)

  return {
    userId: session?.user?.id ?? null,
    browserId: resolveAnonymousActor(request.headers)?.actorId ?? null,
  }
}

async function findPublishedPostId(slug: string) {
  const post = await prisma.post.findFirst({
    where: { slug, deletedAt: null, published: true },
    select: { id: true },
  })

  if (!post) {
    throw new NotFoundError('Post not found')
  }

  return post.id
}

async function POSTHandler(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const rateLimit = await checkInteractionRateLimit(request)
    if (!rateLimit.allowed) {
      throw new TooManyRequestsError()
    }

    const { slug } = await params
    const identity = await resolveLikeIdentity(request)
    const postId = await findPublishedPostId(slug)
    const { liked, count } = await toggleLike(postId, identity)

    return NextResponse.json({ success: true, liked, count })
  } catch (error) {
    console.error('Like error:', error)
    return toErrorResponse(error)
  }
}

async function GETHandler(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const identity = await resolveLikeIdentity(request)
    const postId = await findPublishedPostId(slug)
    const { liked, count } = await getLikeState(postId, identity)

    return NextResponse.json({
      success: true,
      data: { count, liked },
    })
  } catch (error) {
    console.error('Get like status error:', error)
    return toErrorResponse(error)
  }
}

export const POST = withApiOperationLogging(POSTHandler, { scope: 'public', operation: 'public.posts.bySlug.like.create', route: '/api/posts/[slug]/like' });
export const GET = withApiOperationLogging(GETHandler, { scope: 'public', operation: 'public.posts.bySlug.like.read', route: '/api/posts/[slug]/like' });
