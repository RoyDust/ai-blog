import Link from 'next/link'
import Image from 'next/image'

interface PostCardProps {
  post: {
    id: string
    title: string
    slug: string
    excerpt?: string | null
    coverImage?: string | null
    createdAt: string | Date
    author: {
      id: string
      name: string | null
      image: string | null
    }
    category?: {
      name: string
      slug: string
    } | null
    tags: Array<{
      name: string
      slug: string
    }>
    _count: {
      comments: number
      likes: number
    }
  }
}

export function PostCard({ post }: PostCardProps) {
  return (
    <article className="ui-surface overflow-hidden rounded-2xl shadow-sm transition-shadow hover:shadow-lg">
      {post.coverImage && (
        <div className="relative h-52 w-full overflow-hidden">
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            className="object-cover transition-transform duration-300 hover:scale-105"
          />
        </div>
      )}
      <div className="p-6">
        <div className="flex items-center gap-2 mb-3">
          {post.category && (
            <Link
              href={`/categories/${post.category.slug}`}
              className="rounded-full bg-[var(--surface-alt)] px-2 py-1 text-xs font-semibold text-[var(--brand)]"
            >
              {post.category.name}
            </Link>
          )}
          <span className="text-xs text-[var(--muted)]">
            {new Date(post.createdAt).toLocaleDateString('zh-CN')}
          </span>
        </div>

        <Link href={`/posts/${post.slug}`}>
          <h2 className="mb-2 font-display text-xl font-bold text-[var(--foreground)] transition-colors hover:text-[var(--brand)]">
            {post.title}
          </h2>
        </Link>

        {post.excerpt && (
          <p className="mb-4 line-clamp-2 text-sm text-[var(--muted)]">
            {post.excerpt}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {post.author.image ? (
              <Image
                src={post.author.image}
                alt={post.author.name || 'Author'}
                width={32}
                height={32}
                className="rounded-full"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                <span className="text-sm text-[var(--muted)]">
                  {post.author.name?.charAt(0) || 'A'}
                </span>
              </div>
            )}
            <span className="text-sm text-[var(--foreground)]">
              {post.author.name}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs text-[var(--muted)]">
            <span>{post._count.comments} 评论</span>
            <span>{post._count.likes} 点赞</span>
          </div>
        </div>

        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {post.tags.map(tag => (
              <Link
                key={tag.slug}
                href={`/tags/${tag.slug}`}
                className="rounded-full bg-[var(--surface-alt)] px-2 py-1 text-xs text-[var(--muted)] transition-colors hover:text-[var(--brand)]"
              >
                {tag.name}
              </Link>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}
