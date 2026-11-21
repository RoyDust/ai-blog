'use client'

import { CommentForm } from '@/components/CommentForm'

interface CommentAuthGateProps {
  postId: string
}

/** 评论区主输入框：无需登录，说明文字放在输入框下方左侧，「发表评论」右对齐 */
export function CommentAuthGate({ postId }: CommentAuthGateProps) {
  return <CommentForm hint="无需登录即可评论，展示名称会使用脱敏 IP。" postId={postId} />
}
