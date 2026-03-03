export const dynamic = "force-dynamic";
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { PostCard } from '@/components/blog'
import { UserNav } from '@/components/UserNav'

async function getTag(slug: string) {
  try {
    // Log what's being received
    console.log('Received slug:', slug)
    console.log('Type:', typeof slug)

    // Get all tags from database
    const allTags = await prisma.tag.findMany({
      include: {
        _count: { select: { posts: true } }
      }
    })

    console.log('All tags in DB:', allTags.map(t => t.slug))

    // Try different matching approaches
    for (const tag of allTags) {
      // Check direct match
      if (tag.slug === slug) return tag
      if (tag.name === slug) return tag

      // Check with decoded input
      try {
        const decoded = decodeURIComponent(slug)
        if (tag.slug === decoded || tag.name === decoded) return tag
      } catch (e) {}

      // Check with encoded DB value
      try {
        if (encodeURI(tag.slug) === slug) return tag
        if (encodeURI(tag.name) === slug) return tag
      } catch (e) {}
    }

    return null
  } catch (error) {
    console.error('Error finding tag:', error)
    return null
  }
}

export default async function TagPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const tag = await getTag(slug)

  if (!tag) {
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">标签不存在</h1>
          <Link href="/tags" className="text-blue-600 hover:underline mt-4 inline-block">
            返回标签列表
          </Link>
        </main>
      </div>
    )
  }

  const posts = await prisma.post.findMany({
    where: {
      published: true,
      tags: {
        some: { slug }
      }
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
          <div className="flex items-center gap-3 mb-4">
            <span
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: tag.color || '#6b7280' }}
            />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {tag.name}
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            共有 {tag._count.posts} 篇文章
          </p>
          <Link href="/tags" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
            查看所有标签
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


