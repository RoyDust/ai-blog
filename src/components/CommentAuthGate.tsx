'use client'

import { CommentForm } from '@/components/CommentForm'

interface CommentAuthGateProps {
  postId: string
}

export function CommentAuthGate({ postId }: CommentAuthGateProps) {
  return (
    <div className="mb-5 space-y-2">
      <p className="text-xs text-[var(--text-muted)]">无需登录即可评论，展示名称会使用脱敏 IP。</p>
      <CommentForm postId={postId} />
    </div>
  )
}
