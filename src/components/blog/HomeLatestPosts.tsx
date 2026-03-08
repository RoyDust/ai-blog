'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { PostCard } from './PostCard'
import { useInfinitePosts } from './useInfinitePosts'

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
  initialPosts: HomeLatestPost[]
  initialPagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export function HomeLatestPosts({ initialPosts, initialPagination }: HomeLatestPostsProps) {
  const { posts, isLoading, error, hasNextPage } = useInfinitePosts({
    initialPosts,
    initialPagination,
    buildUrl: (page) => `/api/posts?page=${page}&limit=${initialPagination.limit}`,
  })

  return (
    <section className="onload-animation space-y-4" style={{ animationDelay: '50ms' }}>
      <div className="flex items-center justify-between">
        <h2 className="text-90 text-2xl font-bold">最新文章</h2>
        <Link href="/posts" className="btn-plain scale-animation flex h-9 items-center gap-1 rounded-lg px-4 text-sm">
          查看全部
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="space-y-4">
        {posts.map((post, index) => (
          <div key={post.id} className="onload-animation" style={{ animationDelay: `${100 + index * 50}ms` }}>
            <PostCard post={post} />
          </div>
        ))}

        {isLoading && <div className="px-2 py-4 text-sm text-[var(--muted)]">正在加载更多文章...</div>}
        {error && <div className="px-2 py-2 text-sm text-red-500">{error}</div>}
        {!hasNextPage && posts.length > 0 && initialPagination.totalPages > 1 && (
          <div className="px-2 py-2 text-sm text-[var(--muted)]">已加载全部文章</div>
        )}
      </div>
    </section>
  )
}
