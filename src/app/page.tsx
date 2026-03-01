import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { PostCard } from '@/components/blog'
import { UserNav } from '@/components/UserNav'

async function getData() {
  const [posts, categories, tags] = await Promise.all([
    prisma.post.findMany({
      where: { published: true },
      include: {
        author: {
          select: { id: true, name: true, image: true }
        },
        category: true,
        tags: true,
        _count: {
          select: { comments: true, likes: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    }),
    prisma.category.findMany({
      include: {
        _count: { select: { posts: true } }
      },
      orderBy: { name: 'asc' },
      take: 10
    }),
    prisma.tag.findMany({
      include: {
        _count: { select: { posts: true } }
      },
      orderBy: { name: 'asc' },
      take: 20
    })
  ])
  return { posts, categories, tags }
}

export default async function Home() {
  const { posts, categories, tags } = await getData()

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
            <Link href="/tags" className="text-gray-700 dark:text-gray-300 hover:text-blue-600">
              标签
            </Link>
            <UserNav />
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>

            {posts.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">暂无文章</p>
                <Link href="/write" className="mt-4 inline-block text-blue-600 hover:underline">
                  写第一篇文章
                </Link>
              </div>
            )}
          </div>

          <aside className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                分类
              </h3>
              <div className="space-y-2">
                {categories.map(category => (
                  <Link
                    key={category.id}
                    href={`/categories/${category.slug}`}
                    className="flex justify-between items-center text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    <span>{category.name}</span>
                    <span className="text-sm text-gray-500">({category._count.posts})</span>
                  </Link>
                ))}
                {categories.length === 0 && (
                  <p className="text-gray-500 text-sm">暂无分类</p>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                标签
              </h3>
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <Link
                    key={tag.id}
                    href={`/tags/${tag.slug}`}
                    className="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded-full text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    {tag.name}
                  </Link>
                ))}
                {tags.length === 0 && (
                  <p className="text-gray-500 text-sm">暂无标签</p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>

      <footer className="bg-white dark:bg-gray-800 border-t dark:border-gray-700 mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-gray-600 dark:text-gray-400">
          &copy; {new Date().getFullYear()} My Blog. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
