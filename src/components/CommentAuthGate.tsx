'use client'

import { CommentForm } from '@/components/CommentForm'

interface CommentAuthGateProps {
  postId: string
}

export function CommentAuthGate({ postId }: CommentAuthGateProps) {
  return (
    <div className="mb-8 space-y-3">
      <p className="text-sm text-[var(--muted)]">无需登录即可评论，展示名称会使用脱敏 IP。</p>
      <CommentForm postId={postId} />
    </div>
  )
}
