import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { CommentForm } from '@/components/CommentForm'
import { LikeButton } from '@/components/blog'
import { BookmarkButton } from '@/components/blog'

async function getPost(slug: string) {
  const post = await prisma.post.findUnique({
    where: { slug },
    include: {
      author: {
        select: { id: true, name: true, image: true }
      },
      category: true,
      tags: true,
      comments: {
        where: { parentId: null },
        include: {
          author: {
            select: { id: true, name: true, image: true }
          },
          replies: {
            include: {
              author: {
                select: { id: true, name: true, image: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      },
      _count: {
        select: { comments: true, likes: true }
      }
    }
  })
  return post
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPost(slug)
  const session = await getServerSession(authOptions)

  if (!post) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-gray-900 dark:text-white">
            My Blog
          </Link>
          <nav className="flex items-center gap-4">
            {session ? (
              <>
                <Link href="/write" className="text-gray-700 dark:text-gray-300 hover:text-blue-600">
                  写文章
                </Link>
                <Link href="/profile" className="text-gray-700 dark:text-gray-300 hover:text-blue-600">
                  {session.user.name || '个人中心'}
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="text-gray-700 dark:text-gray-300 hover:text-blue-600">
                  登录
                </Link>
                <Link href="/register" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  注册
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <article className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          {post.coverImage && (
            <div className="relative h-64 md:h-96 w-full">
              <Image
                src={post.coverImage}
                alt={post.title}
                fill
                className="object-cover"
                priority
              />
            </div>
          )}

          <div className="p-8">
            <div className="flex items-center gap-4 mb-6">
              {post.category && (
                <Link
                  href={`/categories/${post.category.slug}`}
                  className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full text-sm"
                >
                  {post.category.name}
                </Link>
              )}
              <span className="text-gray-500 dark:text-gray-400 text-sm">
                {new Date(post.createdAt).toLocaleDateString('zh-CN')}
              </span>
              <span className="text-gray-500 dark:text-gray-400 text-sm">
                {post.viewCount} 阅读
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-6">
              {post.title}
            </h1>

            <div className="flex items-center gap-3 mb-8 pb-8 border-b dark:border-gray-700">
              {post.author.image ? (
                <Image
                  src={post.author.image}
                  alt={post.author.name || 'Author'}
                  width={40}
                  height={40}
                  className="rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                  <span className="text-gray-600 dark:text-gray-300">
                    {post.author.name?.charAt(0) || 'A'}
                  </span>
                </div>
              )}
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {post.author.name}
                </p>
              </div>
            </div>

            <div className="prose dark:prose-invert max-w-none">
              <div dangerouslySetInnerHTML={{ __html: post.content.replace(/\n/g, '<br/>') }} />
            </div>

            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-8 pt-8 border-t dark:border-gray-700">
                {post.tags.map(tag => (
                  <Link
                    key={tag.slug}
                    href={`/tags/${tag.slug}`}
                    className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    {tag.name}
                  </Link>
                ))}
              </div>
            )}

            <div className="flex items-center gap-4 mt-8 pt-8 border-t dark:border-gray-700">
              <LikeButton
                slug={post.slug}
                initialLiked={false}
                initialCount={post._count.likes}
              />
              <BookmarkButton
                slug={post.slug}
                initialBookmarked={false}
              />
            </div>
          </div>
        </article>

        {/* 评论区域 */}
        <section className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            评论 ({post._count.comments})
          </h2>

          {session ? (
            <CommentForm postId={post.id} />
          ) : (
            <p className="mb-8 text-gray-600 dark:text-gray-400">
              <Link href="/login" className="text-blue-600 hover:underline">登录</Link> 后发表评论
            </p>
          )}

          <div className="space-y-6">
            {post.comments.map(comment => (
              <div key={comment.id} className="border-b dark:border-gray-700 pb-6">
                <div className="flex items-center gap-3 mb-2">
                  {comment.author.image ? (
                    <Image
                      src={comment.author.image}
                      alt={comment.author.name || ''}
                      width={32}
                      height={32}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600" />
                  )}
                  <span className="font-medium text-gray-900 dark:text-white">
                    {comment.author.name}
                  </span>
                  <span className="text-gray-500 text-sm">
                    {new Date(comment.createdAt).toLocaleDateString('zh-CN')}
                  </span>
                </div>
                <p className="text-gray-700 dark:text-gray-300 ml-11">
                  {comment.content}
                </p>

                {/* 回复 */}
                {comment.replies.length > 0 && (
                  <div className="ml-11 mt-4 space-y-4">
                    {comment.replies.map(reply => (
                      <div key={reply.id} className="border-l-2 border-gray-200 dark:border-gray-700 pl-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {reply.author.name}
                          </span>
                          <span className="text-gray-500 text-sm">
                            {new Date(reply.createdAt).toLocaleDateString('zh-CN')}
                          </span>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300">
                          {reply.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {post.comments.length === 0 && (
              <p className="text-gray-500 text-center py-4">暂无评论</p>
            )}
          </div>
        </section>
      </main>

      <footer className="bg-white dark:bg-gray-800 border-t dark:border-gray-700 mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-gray-600 dark:text-gray-400">
          &copy; {new Date().getFullYear()} My Blog. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
