'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { getOrCreateBrowserId } from '@/lib/browser-id'
import { apiMutate, toErrorMessage } from '@/lib/client-api'
import { cn } from '@/lib/cn'

interface CommentFormProps {
  postId: string
  /** 回复某条评论时传入被回复评论的 id */
  parentId?: string
  /** comment：评论区主输入框（本页唯一主按钮「发表评论」）；reply：评论下方就地展开的回复框（描边按钮） */
  variant?: 'comment' | 'reply'
  /** 输入框下方左侧的一句说明 */
  hint?: ReactNode
  /** 回复框的「取消」 */
  onCancel?: () => void
  autoFocus?: boolean
}

const commentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, '请输入评论内容')
    .max(5000, '评论最多 5000 字'),
})

type CommentFormValues = z.infer<typeof commentSchema>

/** 评论区主输入框的 id：「写评论 →」跳转后聚焦它 */
export const COMMENT_INPUT_ID = 'comment-content'

const fadeSwap = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const },
}

export function CommentForm({ postId, parentId, variant = 'comment', hint, onCancel, autoFocus = false }: CommentFormProps) {
  const router = useRouter()
  const reduce = useReducedMotion()
  const generatedId = useId()
  const isReply = variant === 'reply'
  const inputId = isReply ? `comment-reply-${generatedId}` : COMMENT_INPUT_ID
  const errorId = `${inputId}-error`
  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<CommentFormValues>({
    resolver: zodResolver(commentSchema),
    defaultValues: { content: '' },
  })
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (autoFocus) setFocus('content')
  }, [autoFocus, setFocus])

  const motionProps = reduce ? { initial: false as const } : fadeSwap

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
        body: JSON.stringify(parentId ? { postId, content: data.content, parentId } : { postId, content: data.content }),
      })

      reset()
      setSuccess(isReply ? '回复已提交，审核通过后会公开显示。' : '评论已提交，审核通过后会公开显示。')
      router.refresh()
    } catch (error) {
      toast.error(toErrorMessage(error, isReply ? '回复提交失败，请稍后重试' : '评论提交失败，请稍后重试'))
    }
  }

  const submitLabel = isReply ? '发表回复' : '发表评论'

  return (
    <form className="space-y-2.5" onSubmit={handleSubmit(handleSubmitComment)} noValidate>
      <AnimatePresence initial={false}>
        {success ? (
          <motion.div key="success" className="ed-banner ed-banner--success" role="status" {...motionProps}>
            {success}
          </motion.div>
        ) : null}
      </AnimatePresence>
      <textarea
        id={inputId}
        aria-label={isReply ? '写回复' : '写评论'}
        aria-describedby={errors.content ? errorId : undefined}
        aria-invalid={Boolean(errors.content)}
        className={cn('ed-textarea text-base leading-[1.7] sm:text-[0.9375rem]', isReply && 'min-h-[4.5rem]')}
        placeholder={isReply ? '写下你的回复…' : '写下你的想法…'}
        rows={isReply ? 3 : 4}
        {...register('content')}
      />
      <AnimatePresence initial={false}>
        {errors.content ? (
          <motion.p key="error" id={errorId} className="ed-field-error" role="alert" {...motionProps}>
            {errors.content.message}
          </motion.p>
        ) : null}
      </AnimatePresence>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 text-[0.8125rem] leading-6 text-[var(--text-muted)]">{hint}</div>
        <div className="flex items-center gap-4">
          {onCancel ? (
            <button className="ed-link" onClick={onCancel} type="button">
              取消
            </button>
          ) : null}
          <button
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className={cn(isReply ? 'ed-btn-outline' : 'ed-btn', 'min-w-[7.5rem]')}
          >
            <AnimatePresence initial={false} mode="wait">
              <motion.span key={isSubmitting ? 'submitting' : 'idle'} {...motionProps}>
                {isSubmitting ? '提交中...' : submitLabel}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </div>
    </form>
  )
}
