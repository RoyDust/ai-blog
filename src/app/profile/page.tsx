import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LogoutButton } from '@/components/LogoutButton'

type ProfilePost = Awaited<ReturnType<typeof getUserPosts>>[number]

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
    <div className="bg-background min-h-screen">
      <header className="border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_84%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-90 text-2xl font-bold">
            My Blog
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/" className="text-75 transition-colors hover:text-[var(--brand-strong)]">
              首页
            </Link>
            <Link href="/bookmarks" className="text-75 transition-colors hover:text-[var(--brand-strong)]">
              收藏
            </Link>
            <Link href="/admin/posts/new" className="text-75 transition-colors hover:text-[var(--brand-strong)]">
              写文章
            </Link>
            <LogoutButton />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="card-base mb-8 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-alt)] text-2xl font-bold text-[var(--foreground)] ring-1 ring-[var(--border-strong)]">
                {session.user.name?.charAt(0) || session.user.email?.charAt(0) || 'U'}
              </div>
              <div>
                <h1 className="text-90 text-2xl font-bold">
                  {session.user.name || '用户'}
                </h1>
                <p className="text-75">
                  {session.user.email}
                </p>
                {session.user.role === 'ADMIN' && (
                  <Link href="/admin" className="ui-link text-sm hover:underline">
                    管理后台
                  </Link>
                )}
              </div>
            </div>
            <Link
              href="/profile/edit"
              className="ui-btn inline-flex items-center rounded-lg border border-[var(--border)] px-4 py-2 text-[var(--foreground)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-alt)]"
            >
              编辑资料
            </Link>
          </div>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-90 text-xl font-bold">
            我的文章
          </h2>
          <Link
            href="/admin/posts/new"
            className="ui-btn inline-flex items-center rounded-lg bg-[var(--brand)] px-4 py-2 text-white transition hover:bg-[var(--brand-strong)]"
          >
            写新文章
          </Link>
        </div>

        <div className="space-y-4">
          {posts.map((post: ProfilePost) => (
            <div key={post.id} className="card-base p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <Link href={`/posts/${post.slug}`}>
                    <h3 className="text-90 hover:text-[var(--brand-strong)] text-lg font-semibold transition-colors">
                      {post.title}
                    </h3>
                  </Link>
                  <p className="text-75 mt-2 line-clamp-2">
                    {post.excerpt || '暂无摘要'}
                  </p>
                  <div className="text-50 mt-3 flex items-center gap-4 text-sm">
                    <span>{new Date(post.createdAt).toLocaleDateString('zh-CN')}</span>
                    <span>{post.viewCount} 阅读</span>
                    <span>{post._count.comments} 评论</span>
                    <span>{post._count.likes} 点赞</span>
                    <span className={`rounded border px-2 py-0.5 text-xs ${post.published ? 'ui-status-success' : 'ui-status-warning'}`}>
                      {post.published ? '已发布' : '草稿'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {posts.length === 0 && (
            <div className="card-base py-12 text-center">
              <p className="text-50 mb-4">你还没有发表任何文章</p>
              <Link
                href="/admin/posts/new"
                className="ui-btn inline-flex items-center rounded-lg bg-[var(--brand)] px-6 py-2 text-white transition hover:bg-[var(--brand-strong)]"
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


