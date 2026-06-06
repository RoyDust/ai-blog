'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getOrCreateBrowserId } from '@/lib/browser-id'

interface CommentFormProps {
  postId: string
}

export function CommentForm({ postId }: CommentFormProps) {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const browserId = getOrCreateBrowserId()
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-browser-id': browserId,
        },
        body: JSON.stringify({ postId, content }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit comment')
      }

      setContent('')
      setSuccess('评论已提交，审核通过后会公开显示。')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-8">
      {error && (
        <div className="ui-alert-danger mb-4 rounded-lg p-3">
          <p className="text-sm">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border border-[var(--success-border)] bg-[var(--success-surface)] p-3 text-[var(--success-foreground)]">
          <p className="text-sm">{success}</p>
        </div>
      )}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="写下你的评论..."
        className="ui-ring w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-[var(--ring)] focus:outline-none"
        rows={3}
        required
      />
      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded-lg bg-[var(--brand)] px-6 py-2 text-white transition hover:bg-[var(--brand-strong)] disabled:opacity-50"
      >
        {loading ? '提交中...' : '发表评论'}
      </button>
    </form>
  )
}
