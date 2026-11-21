'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { getOrCreateBrowserId } from '@/lib/browser-id'
import { apiMutate, toErrorMessage } from '@/lib/client-api'

interface CommentFormProps {
  postId: string
}

const commentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, '请输入评论内容')
    .max(5000, '评论最多 5000 字'),
})

type CommentFormValues = z.infer<typeof commentSchema>

export function CommentForm({ postId }: CommentFormProps) {
  const router = useRouter()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CommentFormValues>({
    resolver: zodResolver(commentSchema),
    defaultValues: { content: '' },
  })
  const [success, setSuccess] = useState('')

  const handleSubmitComment = async (data: CommentFormValues) => {
    setSuccess('')

    try {
      const browserId = getOrCreateBrowserId()

      await apiMutate('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-browser-id': browserId,
        },
        body: JSON.stringify({ postId, content: data.content }),
      })

      reset()
      setSuccess('评论已提交，审核通过后会公开显示。')
      router.refresh()
    } catch (error) {
      toast.error(toErrorMessage(error, '评论提交失败，请稍后重试'))
    }
  }

  return (
    <form className="space-y-2.5" onSubmit={handleSubmit(handleSubmitComment)} noValidate>
      {success && (
        <div className="ui-status-success rounded-xl px-3.5 py-2.5">
          <p className="text-xs font-medium">{success}</p>
        </div>
      )}
      <textarea
        placeholder="写下你的评论..."
        className="ui-ring w-full rounded-xl border border-[var(--reader-border)] bg-[color:color-mix(in_oklab,var(--surface-alt)_52%,var(--card-bg)_48%)] px-3.5 py-3 text-sm leading-6 text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        rows={3}
        aria-invalid={Boolean(errors.content)}
        {...register('content')}
      />
      {errors.content ? <p className="text-xs text-[var(--danger-foreground)]">{errors.content.message}</p> : null}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="ui-btn shrink-0 whitespace-nowrap rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-strong)] disabled:opacity-50"
        >
          {isSubmitting ? '提交中...' : '发表评论'}
        </button>
      </div>
    </form>
  )
}
