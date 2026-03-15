import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAnonymousActorId } from '@/lib/anonymous-actor'
import { parseCommentInput } from '@/lib/validation'
import { checkInteractionRateLimit } from '@/lib/rate-limit'
import { ForbiddenError, NotFoundError, toErrorResponse } from '@/lib/api-errors'
import { requireSession } from '@/lib/api-auth'

export async function POST(request: Request) {
  try {
    const rateLimit = await checkInteractionRateLimit(request)
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const anonymousActor = createAnonymousActorId(request.headers)
    const { postId, content, parentId } = parseCommentInput(await request.json())
    const post = await prisma.post.findFirst({ where: { id: postId, deletedAt: null, published: true } })
    if (!post) {
      throw new NotFoundError('Post not found')
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        postId: post.id,
        parentId,
        browserId: anonymousActor.actorId,
        authorLabel: anonymousActor.authorLabel,
      },
      include: {
        author: {
          select: { id: true, name: true, image: true },
        },
      },
    })

    return NextResponse.json({ success: true, data: comment })
  } catch (error) {
    console.error('Create comment error:', error)
    return toErrorResponse(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSession()

    const { id, content } = await request.json()
    const comment = await prisma.comment.findFirst({ where: { id, deletedAt: null } })

    if (!comment) {
      throw new NotFoundError('Comment not found')
    }

    if ((!comment.authorId || comment.authorId !== session.user.id) && session.user.role !== 'ADMIN') {
      throw new ForbiddenError()
    }

    const updatedComment = await prisma.comment.update({
      where: { id },
      data: { content },
      include: {
        author: {
          select: { id: true, name: true, image: true },
        },
      },
    })

    return NextResponse.json({ success: true, data: updatedComment })
  } catch (error) {
    console.error('Update comment error:', error)
    return toErrorResponse(error)
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession()

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Comment ID is required' }, { status: 400 })
    }

    const comment = await prisma.comment.findFirst({ where: { id, deletedAt: null } })

    if (!comment) {
      throw new NotFoundError('Comment not found')
    }

    if ((!comment.authorId || comment.authorId !== session.user.id) && session.user.role !== 'ADMIN') {
      throw new ForbiddenError()
    }

    await prisma.comment.update({ where: { id }, data: { deletedAt: new Date() } })
    return NextResponse.json({ success: true, message: 'Comment deleted' })
  } catch (error) {
    console.error('Delete comment error:', error)
    return toErrorResponse(error)
  }
}
