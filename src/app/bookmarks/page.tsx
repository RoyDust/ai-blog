import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PostCard } from '@/components/blog'

async function getBookmarks(userId: string) {
  const bookmarks = await prisma.bookmark.findMany({
    where: { userId },
    include: {
      post: {
        include: {
          author: {
            select: { id: true, name: true, image: true }
          },
          category: true,
          tags: true,
          _count: {
            select: { comments: true, likes: true }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })
  return bookmarks.map(b => b.post)
}

export default async function BookmarksPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/login')
  }

  const posts = await getBookmarks(session.user.id)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-gray-900 dark:text-white">
            My Blog
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/" className="text-gray-700 dark:text-gray-300 hover:text-blue-600">
              首页
            </Link>
            <Link href="/profile" className="text-gray-700 dark:text-gray-300 hover:text-blue-600">
              个人中心
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">我的收藏</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>

        {posts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 mb-4">暂无收藏</p>
            <Link href="/" className="text-blue-600 hover:underline">
              去浏览文章
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
