import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { UserNav } from '@/components/UserNav'

export default async function TagsPage() {
  const tags = await prisma.tag.findMany({
    include: {
      _count: {
        select: { posts: true }
      }
    },
    orderBy: { name: 'asc' }
  })

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-gray-900 dark:text-white">
            My Blog
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/categories" className="text-gray-700 dark:text-gray-300 hover:text-blue-600">
              分类
            </Link>
            <UserNav />
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">标签</h1>

        <div className="flex flex-wrap gap-3">
          {tags.map(tag => (
            <Link
              key={tag.id}
              href={`/tags/${tag.slug}`}
              className="px-4 py-2 bg-white dark:bg-gray-800 rounded-full shadow-md hover:shadow-lg transition-shadow"
              style={{ borderLeft: tag.color ? `4px solid ${tag.color}` : undefined }}
            >
              <span className="text-gray-900 dark:text-white">{tag.name}</span>
              <span className="ml-2 text-gray-500 dark:text-gray-400 text-sm">
                ({tag._count.posts})
              </span>
            </Link>
          ))}
        </div>

        {tags.length === 0 && (
          <p className="text-gray-500 dark:text-gray-400 text-center py-12">
            暂无标签
          </p>
        )}
      </main>
    </div>
  )
}
