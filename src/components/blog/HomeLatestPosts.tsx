'use client'

import Link from 'next/link'
import { getListRevealAnimationProps } from './listAnimation'
import { PostCard } from './PostCard'
import { SectionHeader } from './SectionHeader'

interface HomeLatestPost {
  id: string
  title: string
  slug: string
  excerpt: string | null
  createdAt: Date | string
  coverImage?: string | null
  author: { id: string; name: string | null; image: string | null }
  category: { id?: string; name: string; slug: string } | null
  tags: Array<{ id?: string; name: string; slug: string }>
  _count: { comments: number; likes: number }
}

interface HomeLatestPostsProps {
  posts: HomeLatestPost[]
}

export function HomeLatestPosts({ posts }: HomeLatestPostsProps) {
  if (posts.length === 0) {
    return null
  }

  return (
    <section className="ui-section">
      <SectionHeader
        eyebrow="最新"
        title="最新发布"
        description="保留最近更新的内容入口，但把持续浏览交给文章列表页。"
        action={
          <Link href="/posts" className="btn-plain rounded-xl px-4 py-2 text-sm font-medium">
            查看全部
          </Link>
        }
      />

      <div className="space-y-4">
        {posts.slice(0, 4).map((post, index) => (
          <div key={post.id} {...getListRevealAnimationProps(index)}>
            <PostCard post={post} />
          </div>
        ))}
      </div>
    </section>
  )
}
