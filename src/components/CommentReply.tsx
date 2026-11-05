'use client'

import { useId, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { collapseMotion } from '@/components/editorial'
import { CommentForm } from '@/components/CommentForm'

interface CommentReplyProps {
  postId: string
  /** 回复挂到哪条顶层评论下（楼中楼统一挂到顶层，列表只有一层缩进） */
  parentId: string
  /** 被回复者的展示名，用于读屏标签 */
  authorLabel: string
}

/** 评论底部的「回复」文字链接：点开后在原位展开回复框（高度过渡），提交走同一个评论接口 */
export function CommentReply({ postId, parentId, authorLabel }: CommentReplyProps) {
  const [open, setOpen] = useState(false)
  const reduce = useReducedMotion()
  const regionId = useId()

  return (
    <div>
      <button
        aria-controls={open ? regionId : undefined}
        aria-expanded={open}
        aria-label={open ? `收起对 ${authorLabel} 的回复` : `回复 ${authorLabel}`}
        className="article-comment__reply"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        回复
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="reply-form"
            className="overflow-hidden"
            id={regionId}
            {...(reduce
              ? { initial: false, animate: { height: 'auto', opacity: 1 }, exit: { height: 0, opacity: 0, transition: { duration: 0 } } }
              : collapseMotion)}
          >
            <div className="pb-1 pt-2">
              <CommentForm autoFocus onCancel={() => setOpen(false)} parentId={parentId} postId={postId} variant="reply" />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
