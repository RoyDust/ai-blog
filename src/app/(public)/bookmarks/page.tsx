export const dynamic = "force-dynamic";
import Link from "next/link"
import { Bookmark, ChevronLeft } from "lucide-react"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { BookmarkShelfItem } from "@/components/bookmarks/BookmarkShelfItem"

async function getBookmarks(userId: string) {
  const bookmarks = await prisma.bookmark.findMany({
    where: { userId },
    include: {
      post: {
        include: {
          author: {
            select: { id: true, name: true, image: true },
          },
          category: true,
          tags: true,
          _count: {
            select: { comments: true, likes: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return bookmarks.map((bookmark: (typeof bookmarks)[number]) => bookmark.post)
}

export default async function BookmarksPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect("/login")
  }

  const posts = await getBookmarks(session.user.id)
  const countLabel = `已收藏 ${String(posts.length).padStart(2, "0")} 篇`

  return (
    <main className="mx-auto min-h-screen max-w-[72rem] px-4 py-10 md:px-6 md:py-14">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
        >
          <ChevronLeft className="h-4 w-4" />
          回到个人主页
        </Link>

        <section className="mt-8 rounded-[calc(var(--radius-large)+0.5rem)] border border-[var(--border)] bg-[var(--surface)]/90 px-6 py-8 shadow-[0_28px_80px_-50px_rgba(15,23,42,0.45)] md:px-10 md:py-12">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Saved Reading</p>
              <h1 className="text-4xl font-black tracking-[-0.05em] text-[var(--foreground)] md:text-6xl">我的收藏</h1>
              <p className="max-w-xl text-sm leading-7 text-[var(--muted)] md:text-base">
                留下一些值得反复阅读的内容。
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3 text-sm text-[var(--foreground)]">
              <Bookmark className="h-4 w-4 text-[var(--brand)]" />
              <span>{countLabel}</span>
            </div>
          </div>
        </section>

        {posts.length > 0 ? (
          <section className="mt-8 space-y-5" data-bookmark-shelf="true">
            {posts.map((post: (typeof posts)[number]) => (
              <BookmarkShelfItem key={post.id} post={post} />
            ))}
          </section>
        ) : (
          <section className="mt-8 rounded-[var(--radius-large)] border border-dashed border-[var(--border)] bg-[var(--surface)]/75 px-6 py-16 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Nothing Saved Yet</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[var(--foreground)]">这里还没有留下任何内容</h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-[var(--muted)]">
              当你收藏一篇文章，它会安静地留在这里。
            </p>
            <Link
              href="/posts"
              className="mt-8 inline-flex items-center rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
            >
              去看看文章
            </Link>
          </section>
        )}
      </div>
    </main>
  )
}
