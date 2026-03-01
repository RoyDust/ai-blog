import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { PostCard } from '@/components/blog'
import { UserNav } from '@/components/UserNav'

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({
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
            <Link href="/tags" className="text-gray-700 dark:text-gray-300 hover:text-blue-600">
              标签
            </Link>
            <UserNav />
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">分类</h1>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {categories.map(category => (
            <Link
              key={category.id}
              href={`/categories/${category.slug}`}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {category.name}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {category._count.posts} 篇文章
              </p>
              {category.description && (
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                  {category.description}
                </p>
              )}
            </Link>
          ))}
        </div>

        {categories.length === 0 && (
          <p className="text-gray-500 dark:text-gray-400 text-center py-12">
            暂无分类
          </p>
        )}
      </main>
    </div>
  )
}
