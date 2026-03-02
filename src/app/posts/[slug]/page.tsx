import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { CommentForm } from "@/components/CommentForm";
import { ArticleToc, BookmarkButton, LikeButton, ReadingProgress } from "@/components/blog";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getPost(slug: string) {
  return prisma.post.findUnique({
    where: { slug },
    include: {
      author: {
        select: { id: true, name: true, image: true },
      },
      category: true,
      tags: true,
      comments: {
        where: { parentId: null },
        include: {
          author: {
            select: { id: true, name: true, image: true },
          },
          replies: {
            include: {
              author: {
                select: { id: true, name: true, image: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: { comments: true, likes: true },
      },
    },
  });
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, "")
    .replace(/\s+/g, "-");
}

function extractHeadings(content: string) {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^#{1,3}\s+/.test(line))
    .map((line) => {
      const level = Math.min(3, line.match(/^#+/)?.[0].length ?? 1) as 1 | 2 | 3;
      const text = line.replace(/^#{1,3}\s+/, "");
      return { id: slugify(text), text, level };
    });
}

function renderContent(content: string) {
  return content.split("\n").map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return <div className="h-4" key={`space-${index}`} />;
    }

    if (/^###\s+/.test(trimmed)) {
      const text = trimmed.replace(/^###\s+/, "");
      return (
        <h3 className="mt-6 font-display text-xl font-bold text-[var(--foreground)]" id={slugify(text)} key={`h3-${index}`}>
          {text}
        </h3>
      );
    }

    if (/^##\s+/.test(trimmed)) {
      const text = trimmed.replace(/^##\s+/, "");
      return (
        <h2 className="mt-8 font-display text-2xl font-bold text-[var(--foreground)]" id={slugify(text)} key={`h2-${index}`}>
          {text}
        </h2>
      );
    }

    if (/^#\s+/.test(trimmed)) {
      const text = trimmed.replace(/^#\s+/, "");
      return (
        <h2 className="mt-8 font-display text-2xl font-bold text-[var(--foreground)]" id={slugify(text)} key={`h1-${index}`}>
          {text}
        </h2>
      );
    }

    return (
      <p className="leading-8 text-[var(--foreground)]/90" key={`p-${index}`}>
        {trimmed}
      </p>
    );
  });
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  const session = await getServerSession(authOptions);

  if (!post) {
    notFound();
  }

  const headings = extractHeadings(post.content);

  return (
    <div className="space-y-8">
      <ReadingProgress />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
        <article className="ui-surface overflow-hidden rounded-3xl shadow-sm">
          {post.coverImage && (
            <div className="relative h-64 w-full md:h-96">
              <Image alt={post.title} className="object-cover" fill priority src={post.coverImage} />
            </div>
          )}

          <div className="space-y-8 p-8">
            <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
              {post.category && (
                <Link className="rounded-full bg-[var(--surface-alt)] px-3 py-1 font-semibold text-[var(--brand)]" href={`/categories/${post.category.slug}`}>
                  {post.category.name}
                </Link>
              )}
              <span>{new Date(post.createdAt).toLocaleDateString("zh-CN")}</span>
              <span>{post.viewCount} 阅读</span>
            </div>

            <h1 className="font-display text-4xl font-extrabold leading-tight text-[var(--foreground)]">{post.title}</h1>

            <div className="flex items-center gap-3 border-b border-[var(--border)] pb-8">
              {post.author.image ? (
                <Image alt={post.author.name || "Author"} className="rounded-full" height={40} src={post.author.image} width={40} />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-alt)]">
                  <span className="text-sm text-[var(--muted)]">{post.author.name?.charAt(0) || "A"}</span>
                </div>
              )}
              <p className="font-medium text-[var(--foreground)]">{post.author.name}</p>
            </div>

            <div className="space-y-2">{renderContent(post.content)}</div>

            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-8">
                {post.tags.map((tag) => (
                  <Link
                    className="rounded-full bg-[var(--surface-alt)] px-3 py-1 text-sm text-[var(--foreground)] transition-colors hover:text-[var(--brand)]"
                    href={`/tags/${tag.slug}`}
                    key={tag.slug}
                  >
                    #{tag.name}
                  </Link>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-8 lg:hidden">
              <LikeButton initialCount={post._count.likes} initialLiked={false} slug={post.slug} />
              <BookmarkButton initialBookmarked={false} slug={post.slug} />
            </div>
          </div>
        </article>

        <aside className="hidden space-y-4 lg:block">
          <div className="ui-surface sticky top-24 rounded-2xl p-4">
            <h3 className="mb-3 font-display text-lg font-semibold text-[var(--foreground)]">目录</h3>
            <ArticleToc headings={headings} />
          </div>
          <div className="ui-surface rounded-2xl p-4">
            <h3 className="mb-3 font-display text-sm font-semibold text-[var(--foreground)]">互动</h3>
            <div className="flex flex-col gap-2">
              <LikeButton initialCount={post._count.likes} initialLiked={false} slug={post.slug} />
              <BookmarkButton initialBookmarked={false} slug={post.slug} />
            </div>
          </div>
        </aside>
      </div>

      <section className="ui-surface rounded-3xl p-8">
        <h2 className="mb-6 font-display text-2xl font-bold text-[var(--foreground)]">评论 ({post._count.comments})</h2>

        {session ? (
          <CommentForm postId={post.id} />
        ) : (
          <p className="mb-8 text-[var(--muted)]">
            <Link className="text-[var(--brand)] hover:underline" href="/login">
              登录
            </Link>{" "}
            后发表评论
          </p>
        )}

        <div className="space-y-6">
          {post.comments.map((comment) => (
            <div className="border-b border-[var(--border)] pb-6" key={comment.id}>
              <div className="mb-2 flex items-center gap-3">
                {comment.author.image ? (
                  <Image alt={comment.author.name || ""} className="rounded-full" height={32} src={comment.author.image} width={32} />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-[var(--surface-alt)]" />
                )}
                <span className="font-medium text-[var(--foreground)]">{comment.author.name}</span>
                <span className="text-xs text-[var(--muted)]">{new Date(comment.createdAt).toLocaleDateString("zh-CN")}</span>
              </div>
              <p className="ml-11 text-[var(--foreground)]/90">{comment.content}</p>

              {comment.replies.length > 0 && (
                <div className="ml-11 mt-4 space-y-4">
                  {comment.replies.map((reply) => (
                    <div className="border-l-2 border-[var(--border)] pl-4" key={reply.id}>
                      <div className="mb-1 flex items-center gap-2">
                        <span className="font-medium text-[var(--foreground)]">{reply.author.name}</span>
                        <span className="text-xs text-[var(--muted)]">{new Date(reply.createdAt).toLocaleDateString("zh-CN")}</span>
                      </div>
                      <p className="text-[var(--foreground)]/90">{reply.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {post.comments.length === 0 && <p className="py-4 text-center text-[var(--muted)]">暂无评论</p>}
        </div>
      </section>
    </div>
  );
}
