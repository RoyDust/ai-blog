import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LogoutButton } from '@/components/LogoutButton'

async function getUserPosts(userId: string) {
  const posts = await prisma.post.findMany({
    where: { authorId: userId },
    include: {
      _count: {
        select: { comments: true, likes: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  })
  return posts
}

export default async function ProfilePage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/login')
  }

  const posts = await getUserPosts(session.user.id)

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
            <Link href="/bookmarks" className="text-gray-700 dark:text-gray-300 hover:text-blue-600">
              收藏
            </Link>
            <Link href="/write" className="text-gray-700 dark:text-gray-300 hover:text-blue-600">
              写文章
            </Link>
            <LogoutButton />
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                {session.user.name?.charAt(0) || session.user.email?.charAt(0) || 'U'}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {session.user.name || '用户'}
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  {session.user.email}
                </p>
                {session.user.role === 'ADMIN' && (
                  <Link href="/admin" className="text-blue-600 hover:underline text-sm">
                    管理后台
                  </Link>
                )}
              </div>
            </div>
            <Link
              href="/profile/edit"
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              编辑资料
            </Link>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            我的文章
          </h2>
          <Link
            href="/write"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            写新文章
          </Link>
        </div>

        <div className="space-y-4">
          {posts.map(post => (
            <div key={post.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <Link href={`/posts/${post.slug}`}>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">
                      {post.title}
                    </h3>
                  </Link>
                  <p className="text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
                    {post.excerpt || '无摘要'}
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                    <span>{new Date(post.createdAt).toLocaleDateString('zh-CN')}</span>
                    <span>{post.viewCount} 阅读</span>
                    <span>{post._count.comments} 评论</span>
                    <span>{post._count.likes} 点赞</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${post.published ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {post.published ? '已发布' : '草稿'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {posts.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
              <p className="text-gray-500 dark:text-gray-400 mb-4">你还没有发表任何文章</p>
              <Link
                href="/write"
                className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                写第一篇文章
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
