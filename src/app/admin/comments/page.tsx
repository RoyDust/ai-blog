import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function AdminCommentsPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    redirect('/')
  }

  const comments = await prisma.comment.findMany({
    include: {
      author: {
        select: { name: true, email: true }
      },
      post: {
        select: { title: true, slug: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 50
  })

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-gray-900 dark:text-white">
            My Blog - 评论管理
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/admin" className="text-gray-700 dark:text-gray-300 hover:text-blue-600">
              返回后台
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">评论管理</h1>

        <div className="space-y-4">
          {comments.map(comment => (
            <div key={comment.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {comment.author.name || comment.author.email}
                    </span>
                    <span className="text-gray-500 text-sm">
                      评论于 {new Date(comment.createdAt).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 mb-2">
                    {comment.content}
                  </p>
                  <Link
                    href={`/posts/${comment.post.slug}`}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-sm"
                  >
                    文章: {comment.post.title}
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {comments.length === 0 && (
          <p className="text-gray-500 dark:text-gray-400 text-center py-12">
            暂无评论
          </p>
        )}
      </main>
    </div>
  )
}
