import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NextResponse } from 'next/server'
import { createPublicComment } from '@/lib/comments'
import { createAnonymousActorId } from '@/lib/anonymous-actor'
import { parseCommentInput } from '@/lib/validation'
import { checkInteractionRateLimit } from '@/lib/rate-limit'
import { toErrorResponse, TooManyRequestsError } from '@/lib/api-errors'
import { createAdminNotification, NOTIFICATION_SEVERITIES, NOTIFICATION_TYPES } from '@/lib/notifications'

async function POSTHandler(request: Request) {
  try {
    const rateLimit = await checkInteractionRateLimit(request)
    if (!rateLimit.allowed) {
      throw new TooManyRequestsError()
    }

    const anonymousActor = createAnonymousActorId(request.headers)
    const { postId, content, parentId } = parseCommentInput(await request.json())
    const { post, comment } = await createPublicComment({
      postId, content, parentId,
      browserId: anonymousActor.actorId,
      authorLabel: anonymousActor.authorLabel,
    })

    try {
      await createAdminNotification({
        type: NOTIFICATION_TYPES.commentCreated,
        severity: NOTIFICATION_SEVERITIES.info,
        title: '有新评论',
        body: `${comment.authorLabel || '匿名访客'} 评论了《${post.title}》，等待审核。`,
        actionUrl: '/admin/comments',
        entityType: 'comment',
        entityId: comment.id,
        dedupeKey: `comment:${comment.id}:created`,
        metadata: { postId: post.id, postSlug: post.slug, parentId: parentId ?? null },
      })
    } catch (notificationError) {
      console.error('Create comment notification error:', notificationError)
    }

    return NextResponse.json({ success: true, data: comment })
  } catch (error) {
    console.error('Create comment error:', error)
    return toErrorResponse(error)
  }
}

export const POST = withApiOperationLogging(POSTHandler, { scope: 'public', operation: 'public.comments.create', route: '/api/comments' });
