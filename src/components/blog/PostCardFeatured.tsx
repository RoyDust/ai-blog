import Image from "next/image";
import Link from "next/link";

interface PostCardFeaturedProps {
  post: {
    title: string;
    slug: string;
    excerpt?: string | null;
    coverImage?: string | null;
    createdAt: Date | string;
    category?: {
      name: string;
      slug: string;
    } | null;
  };
}

export function PostCardFeatured({ post }: PostCardFeaturedProps) {
  return (
    <article className="ui-surface overflow-hidden rounded-3xl shadow-md">
      <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr]">
        <div className="relative min-h-64">
          {post.coverImage ? (
            <Image src={post.coverImage} alt={post.title} fill className="object-cover" />
          ) : (
            <div className="h-full w-full bg-[var(--surface-alt)]" />
          )}
        </div>
        <div className="flex flex-col justify-between p-6 md:p-8">
          <div className="space-y-4">
            <span className="inline-flex rounded-full bg-[var(--surface-alt)] px-3 py-1 text-xs font-semibold tracking-wide text-[var(--brand)]">
              精选文章
            </span>
            <Link href={`/posts/${post.slug}`}>
              <h2 className="font-display text-2xl font-extrabold leading-tight text-[var(--foreground)] transition-colors hover:text-[var(--brand)]">
                {post.title}
              </h2>
            </Link>
            {post.excerpt && <p className="text-sm leading-6 text-[var(--muted)]">{post.excerpt}</p>}
          </div>
          <div className="mt-6 flex items-center justify-between text-xs text-[var(--muted)]">
            <span>{post.category?.name ?? "未分类"}</span>
            <span>{new Date(post.createdAt).toLocaleDateString("zh-CN")}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
