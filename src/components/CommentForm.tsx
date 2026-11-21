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
    <form className="mb-8" onSubmit={handleSubmit(handleSubmitComment)} noValidate>
      {success && (
        <div className="mb-4 rounded-lg border border-[var(--success-border)] bg-[var(--success-surface)] p-3 text-[var(--success-foreground)]">
          <p className="text-sm">{success}</p>
        </div>
      )}
      <textarea
        placeholder="写下你的评论..."
        className="ui-ring w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-[var(--ring)] focus:outline-none"
        rows={3}
        aria-invalid={Boolean(errors.content)}
        {...register('content')}
      />
      {errors.content ? <p className="mt-1 text-sm text-rose-500">{errors.content.message}</p> : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 rounded-lg bg-[var(--brand)] px-6 py-2 text-white transition hover:bg-[var(--brand-strong)] disabled:opacity-50"
      >
        {isSubmitting ? '提交中...' : '发表评论'}
      </button>
    </form>
  )
}
