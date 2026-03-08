'use client'

import { useSearchParams } from 'next/navigation'

import { FilterBar } from './FilterBar'
import { PostCard } from './PostCard'
import { useInfinitePosts } from './useInfinitePosts'

interface ListingPost {
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

interface ListingOption {
  name: string
  slug: string
}

interface PostsListingClientProps {
  initialPosts: ListingPost[]
  initialPagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  categories: ListingOption[]
  tags: ListingOption[]
}

export function PostsListingClient({ initialPosts, initialPagination, categories, tags }: PostsListingClientProps) {
  const searchParams = useSearchParams()
  const search = searchParams.get('q')?.trim() ?? ''
  const category = searchParams.get('category')?.trim() ?? ''
  const tag = searchParams.get('tag')?.trim() ?? ''

  const { posts, isLoading, error, hasNextPage } = useInfinitePosts({
    initialPosts,
    initialPagination,
    buildUrl: (page) => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(initialPagination.limit),
      })

      if (search) {
        params.set('search', search)
      }

      if (category) {
        params.set('category', category)
      }

      if (tag) {
        params.set('tag', tag)
      }

      return `/api/posts?${params.toString()}`
    },
    resetKey: `${search}|${category}|${tag}`,
  })

  return (
    <>
      <div className="card-base onload-animation p-6 md:p-8">
        <h1 className="text-90 text-3xl font-bold md:text-4xl">博客文章</h1>
        <p className="text-75 mt-2">共 {initialPagination.total} 篇文章</p>
      </div>

      <FilterBar category={category} categories={categories} search={search} tag={tag} tags={tags} />

      <div className="space-y-4">
        {posts.length > 0 ? (
          posts.map((post, index) => (
            <div key={post.id} className="onload-animation" style={{ animationDelay: `${100 + index * 50}ms` }}>
              <PostCard post={post} />
            </div>
          ))
        ) : (
          <div className="card-base p-8 text-sm text-[var(--muted)]">未找到匹配内容，请尝试调整筛选条件。</div>
        )}

        {isLoading && <div className="px-2 py-4 text-sm text-[var(--muted)]">正在加载下一页...</div>}
        {error && <div className="px-2 py-2 text-sm text-red-500">{error}</div>}
        {!hasNextPage && posts.length > 0 && initialPagination.totalPages > 1 && (
          <div className="px-2 py-2 text-sm text-[var(--muted)]">已加载全部文章</div>
        )}
      </div>
    </>
  )
}
