'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { CommentForm } from '@/components/CommentForm'

interface CommentAuthGateProps {
  postId: string
}

export function CommentAuthGate({ postId }: CommentAuthGateProps) {
  const { status } = useSession()

  if (status === 'authenticated') {
    return <CommentForm postId={postId} />
  }

  if (status === 'loading') {
    return <p className="mb-8 text-[var(--muted)]">正在检查登录状态...</p>
  }

  return (
    <p className="mb-8 text-[var(--muted)]">
      <Link className="text-[var(--brand)] hover:underline" href="/login">
        登录
      </Link>{' '}
      后发表评论
    </p>
  )
}
