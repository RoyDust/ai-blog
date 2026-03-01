'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

interface Comment {
  id: string
  content: string
  createdAt: string
  author: { id: string; name: string | null; email: string; image: string | null }
  post: { id: string; title: string; slug: string }
}

export default function AdminCommentsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
      router.push('/')
      return
    }
  }, [status, session, router])

  useEffect(() => {
    fetchComments()
  }, [])

  const fetchComments = async () => {
    try {
      const res = await fetch('/api/admin/comments')
      const data = await res.json()
      if (data.success) {
        setComments(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条评论吗？')) return

    setDeleting(id)
    try {
      const res = await fetch(`/api/admin/comments?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setComments(comments.filter(c => c.id !== id))
      } else {
        alert(data.error || '删除失败')
      }
    } catch (error) {
      alert('删除失败')
    } finally {
      setDeleting(null)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

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
                    <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                      {comment.author.image ? (
                        <img src={comment.author.image} alt="" className="w-8 h-8 rounded-full" />
                      ) : (
                        <span className="text-gray-600 dark:text-gray-300">
                          {comment.author.name?.charAt(0) || comment.author.email?.charAt(0) || 'A'}
                        </span>
                      )}
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {comment.author.name || comment.author.email}
                    </span>
                    <span className="text-gray-500 text-sm">
                      评论于 {new Date(comment.createdAt).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 mb-2 whitespace-pre-wrap">
                    {comment.content}
                  </p>
                  <Link
                    href={`/posts/${comment.post.slug}`}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-sm"
                  >
                    文章: {comment.post.title}
                  </Link>
                </div>
                <button
                  onClick={() => handleDelete(comment.id)}
                  disabled={deleting === comment.id}
                  className="px-3 py-1 text-sm text-red-600 hover:text-red-800 dark:text-red-400 border border-red-600 dark:border-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                >
                  {deleting === comment.id ? '删除中...' : '删除'}
                </button>
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
