'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

interface Post {
  id: string
  title: string
  slug: string
  published: boolean
  viewCount: number
  createdAt: string
  author: { name: string | null; email: string }
  category: { name: string } | null
  _count: { comments: number; likes: number }
}

export default function AdminPostsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
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
    fetchPosts()
  }, [])

  const fetchPosts = async () => {
    try {
      const res = await fetch('/api/admin/posts')
      const data = await res.json()
      if (data.success) {
        setPosts(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这篇文章吗？')) return

    setDeleting(id)
    try {
      const res = await fetch(`/api/admin/posts?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setPosts(posts.filter(p => p.id !== id))
      } else {
        alert(data.error || '删除失败')
      }
    } catch (error) {
      alert('删除失败')
    } finally {
      setDeleting(null)
    }
  }

  const handleTogglePublish = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/admin/posts/publish', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, published: !currentStatus })
      })
      const data = await res.json()
      if (data.success) {
        setPosts(posts.map(p => p.id === id ? { ...p, published: !currentStatus } : p))
      }
    } catch (error) {
      alert('操作失败')
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
            My Blog - 文章管理
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/admin" className="text-gray-700 dark:text-gray-300 hover:text-blue-600">
              返回后台
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">文章管理</h1>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  标题
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  作者
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  统计
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  日期
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {posts.map(post => (
                <tr key={post.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4">
                    <Link
                      href={`/posts/${post.slug}`}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                    >
                      {post.title}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                    {post.author.name || post.author.email}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleTogglePublish(post.id, post.published)}
                      className={`px-2 py-1 text-xs rounded-full ${
                        post.published
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}
                    >
                      {post.published ? '已发布' : '草稿'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-gray-700 dark:text-gray-300 text-sm">
                    阅读: {post.viewCount} | 评论: {post._count.comments} | 点赞: {post._count.likes}
                  </td>
                  <td className="px-6 py-4 text-gray-700 dark:text-gray-300 text-sm">
                    {new Date(post.createdAt).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/posts/${post.slug}/edit`}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-sm"
                      >
                        编辑
                      </Link>
                      <button
                        onClick={() => handleDelete(post.id)}
                        disabled={deleting === post.id}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 text-sm disabled:opacity-50"
                      >
                        {deleting === post.id ? '删除中...' : '删除'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {posts.length === 0 && (
          <p className="text-gray-500 dark:text-gray-400 text-center py-12">
            暂无文章
          </p>
        )}
      </main>
    </div>
  )
}
