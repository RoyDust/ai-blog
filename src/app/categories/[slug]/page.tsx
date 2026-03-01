import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { PostCard } from '@/components/blog'
import { UserNav } from '@/components/UserNav'

async function getCategory(slug: string) {
  try {
    // Decode the URL-encoded slug
    const decodedSlug = decodeURIComponent(slug)

    // Get all categories
    const allCategories = await prisma.category.findMany({
      include: {
        _count: { select: { posts: true } }
      }
    })

    // Try to find matching category by exact match first
    let category = allCategories.find(c => c.slug === decodedSlug)

    // If not found, try by name
    if (!category) {
      category = allCategories.find(c => c.name === decodedSlug)
    }

    // Try case insensitive
    if (!category) {
      category = allCategories.find(c =>
        c.slug.toLowerCase() === decodedSlug.toLowerCase() ||
        c.name.toLowerCase() === decodedSlug.toLowerCase()
      )
    }

    return category || null
  } catch (error) {
    console.error('Error finding category:', error)
    return null
  }
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const category = await getCategory(slug)

  if (!category) {
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">分类不存在</h1>
          <Link href="/categories" className="text-blue-600 hover:underline mt-4 inline-block">
            返回分类列表
          </Link>
        </main>
      </div>
    )
  }

  const posts = await prisma.post.findMany({
    where: {
      published: true,
      category: { slug }
    },
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
    orderBy: { createdAt: 'desc' }
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
            <Link href="/tags" className="text-gray-700 dark:text-gray-300 hover:text-blue-600">
              标签
            </Link>
            <UserNav />
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {category.name}
          </h1>
          {category.description && (
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              {category.description}
            </p>
          )}
          <p className="text-gray-600 dark:text-gray-400">
            共有 {category._count.posts} 篇文章
          </p>
          <Link href="/categories" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
            查看所有分类
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>

        {posts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">暂无文章</p>
          </div>
        )}
      </main>
    </div>
  )
}
