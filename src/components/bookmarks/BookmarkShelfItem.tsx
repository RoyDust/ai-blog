import Link from "next/link"
import { ArrowUpRight, Clock3, MessageCircle } from "lucide-react"
import { PostMeta } from "@/components/blog/PostMeta"

interface BookmarkShelfItemProps {
  post: {
    id: string
    title: string
    slug: string
    excerpt?: string | null
    createdAt: string | Date
    author: {
      id: string
      name: string | null
      image: string | null
    }
    category?: {
      name: string
      slug: string
    } | null
    tags: Array<{
      name: string
      slug: string
    }>
    _count: {
      comments: number
      likes: number
    }
  }
}

export function BookmarkShelfItem({ post }: BookmarkShelfItemProps) {
  return (
    <article className="group rounded-[var(--radius-large)] border border-[var(--border)] bg-[var(--surface)]/95 p-6 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.4)] transition duration-200 hover:-translate-y-0.5 hover:border-[color:color-mix(in_srgb,var(--primary)_30%,var(--border))]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PostMeta category={post.category} publishedAt={post.createdAt} tags={post.tags.slice(0, 2)} />
        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
          <Clock3 className="h-3.5 w-3.5" />
          已留存
        </span>
      </div>

      <div className="mt-5 max-w-3xl">
        <Link href={`/posts/${post.slug}`} className="outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
          <h2 className="text-balance text-2xl font-black tracking-[-0.03em] text-[var(--foreground)] transition-colors group-hover:text-[var(--primary)] md:text-[2rem]">
            {post.title}
          </h2>
        </Link>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
          {post.excerpt?.trim() || "保留下这篇文章，方便在更合适的时候回来看。"}
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-dashed border-[var(--border)] pt-4 text-sm text-[var(--muted)]">
        <div className="flex flex-wrap items-center gap-4">
          <span>作者 {post.author.name ?? "匿名作者"}</span>
          <span className="inline-flex items-center gap-1.5">
            <MessageCircle className="h-4 w-4" />
            {post._count.comments} 评论
          </span>
        </div>

        <Link
          href={`/posts/${post.slug}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--primary)] px-3 py-1.5 font-medium text-[var(--primary)] transition hover:bg-[color:color-mix(in_srgb,var(--primary)_10%,transparent)]"
        >
          打开文章
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  )
}
