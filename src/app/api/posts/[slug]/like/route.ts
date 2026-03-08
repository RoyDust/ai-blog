import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getBrowserIdFromHeaders } from '@/lib/browser-id'
import { checkInteractionRateLimit } from '@/lib/rate-limit'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const rateLimit = checkInteractionRateLimit(request)
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const browserId = getBrowserIdFromHeaders(request.headers)
    if (!browserId) {
      return NextResponse.json({ error: 'Browser ID is required' }, { status: 400 })
    }

    const { slug } = await params
    const post = await prisma.post.findFirst({ where: { slug, deletedAt: null, published: true } })

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    const existingLike = await prisma.like.findFirst({
      where: {
        postId: post.id,
        browserId,
      },
    })

    if (existingLike) {
      await prisma.like.delete({ where: { id: existingLike.id } })
      return NextResponse.json({ success: true, liked: false })
    }

    await prisma.like.create({
      data: {
        postId: post.id,
        browserId,
      },
    })

    return NextResponse.json({ success: true, liked: true })
  } catch (error) {
    console.error('Like error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const browserId = getBrowserIdFromHeaders(request.headers)
    const post = await prisma.post.findFirst({ where: { slug, deletedAt: null, published: true } })

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    const likeCount = await prisma.like.count({ where: { postId: post.id } })

    let isLiked = false
    if (browserId) {
      const like = await prisma.like.findFirst({
        where: {
          postId: post.id,
          browserId,
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
