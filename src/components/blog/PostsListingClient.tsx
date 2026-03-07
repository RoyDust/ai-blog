'use client'

import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { FilterBar } from './FilterBar'
import { PostCard } from './PostCard'
import { filterPosts } from './posts-filter'

interface ListingPost {
  id: string
  title: string
  slug: string
  excerpt: string | null
  createdAt: Date
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
  posts: ListingPost[]
  categories: ListingOption[]
  tags: ListingOption[]
}

export function PostsListingClient({ posts, categories, tags }: PostsListingClientProps) {
  const searchParams = useSearchParams()
  const search = searchParams.get('q')?.trim() ?? ''
  const category = searchParams.get('category')?.trim() ?? ''
  const tag = searchParams.get('tag')?.trim() ?? ''

  const filteredPosts = useMemo(
    () => filterPosts(posts, { search, category, tag }),
    [posts, search, category, tag],
  )

  return (
    <>
      <div className="card-base onload-animation p-6 md:p-8">
        <h1 className="text-90 text-3xl font-bold md:text-4xl">博客文章</h1>
        <p className="text-75 mt-2">共 {filteredPosts.length} 篇文章</p>
      </div>

      <FilterBar category={category} categories={categories} search={search} tag={tag} tags={tags} />

      <div className="space-y-4">
        {filteredPosts.length > 0 ? (
          filteredPosts.map((post, index) => (
            <div key={post.id} className="onload-animation" style={{ animationDelay: `${100 + index * 50}ms` }}>
              <PostCard post={post} />
            </div>
          ))
        ) : (
          <div className="card-base p-8 text-sm text-[var(--muted)]">未找到匹配内容，请尝试调整筛选条件。</div>
        )}
      </div>
    </>
  )
}
