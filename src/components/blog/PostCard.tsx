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
    <article className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      {post.coverImage && (
        <div className="relative h-48 w-full">
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            className="object-cover"
          />
        </div>
      )}
      <div className="p-6">
        <div className="flex items-center gap-2 mb-3">
          {post.category && (
            <Link
              href={`/categories/${post.category.slug}`}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              {post.category.name}
            </Link>
          )}
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {new Date(post.createdAt).toLocaleDateString('zh-CN')}
          </span>
        </div>

        <Link href={`/posts/${post.slug}`}>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 hover:text-blue-600 dark:hover:text-blue-400">
            {post.title}
          </h2>
        </Link>

        {post.excerpt && (
          <p className="text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
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
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {post.author.name?.charAt(0) || 'A'}
                </span>
              </div>
            )}
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {post.author.name}
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
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
                className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
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
