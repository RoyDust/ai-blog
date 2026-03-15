import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAnonymousActorId } from '@/lib/anonymous-actor'
import { checkInteractionRateLimit } from '@/lib/rate-limit'
import { NotFoundError, toErrorResponse } from '@/lib/api-errors'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const rateLimit = await checkInteractionRateLimit(request)
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const anonymousActor = createAnonymousActorId(request.headers)

    const { slug } = await params
    const post = await prisma.post.findFirst({ where: { slug, deletedAt: null, published: true } })

    if (!post) {
      throw new NotFoundError('Post not found')
    }

    const existingLike = await prisma.like.findFirst({
      where: {
        postId: post.id,
        browserId: anonymousActor.actorId,
      },
    })

    if (existingLike) {
      await prisma.like.delete({ where: { id: existingLike.id } })
      return NextResponse.json({ success: true, liked: false })
    }

    await prisma.like.create({
      data: {
        postId: post.id,
        browserId: anonymousActor.actorId,
      },
    })

    return NextResponse.json({ success: true, liked: true })
  } catch (error) {
    console.error('Like error:', error)
    return toErrorResponse(error)
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const anonymousActor = (() => {
      try {
        return createAnonymousActorId(request.headers)
      } catch {
        return null
      }
    })()
    const post = await prisma.post.findFirst({ where: { slug, deletedAt: null, published: true } })

    if (!post) {
      throw new NotFoundError('Post not found')
    }

    const likeCount = await prisma.like.count({ where: { postId: post.id } })

    let isLiked = false
    if (anonymousActor) {
      const like = await prisma.like.findFirst({
        where: {
          postId: post.id,
          browserId: anonymousActor.actorId,
        },
      })
      isLiked = Boolean(like)
    }

    return NextResponse.json({
      success: true,
      data: {
        count: likeCount,
        liked: isLiked,
      },
    })
  } catch (error) {
    console.error('Get like status error:', error)
    return toErrorResponse(error)
  }
}
