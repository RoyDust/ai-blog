export const dynamic = "force-dynamic";

import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { CommentForm } from "@/components/CommentForm";
import { ArticleToc, BackToTopButton, BookmarkButton, LikeButton, ReadingProgress, ShareButton } from "@/components/blog";
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

function nodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return nodeText((node as { props?: { children?: ReactNode } }).props?.children);
  }
  return "";
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
    <div className="relative space-y-8 overflow-x-clip">
      <ReadingProgress />
      <BackToTopButton />

      <aside
        data-testid="toc-rail"
        className="hidden xl:fixed xl:top-24 xl:block xl:w-64"
        style={{ left: "calc(50% + 490px + 120px)" }}
      >
        <div className="card-base max-h-[calc(100vh-8rem)] overflow-auto p-4">
          <h3 className="mb-3 font-display text-lg font-semibold text-[var(--foreground)]">目录</h3>
          <ArticleToc headings={headings} />https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/Administrator/.cursor/extensions/openai.chatgpt-0.4.79-win32-x64/webview/
        </div>
      </aside>

      <div className="mx-auto w-full max-w-[980px] xl:min-w-[880px]">
        <article className="card-base overflow-hidden">
          {post.coverImage && (
            <div className="relative h-64 w-full md:h-96">
              <Image alt={post.title} className="object-cover" fill priority src={post.coverImage} />
            </div>
          )}

          <div className="space-y-8 p-8">
            <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
              {post.category && (
                <Link className="rounded-full bg-[var(--surface-alt)] px-3 py-1 font-semibold text-[var(--brand)]" href={`/posts?category=${encodeURIComponent(post.category.slug)}`}>
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

            <article className="prose prose-zinc dark:prose-invert prose-headings:font-display prose-a:text-[var(--brand)] prose-a:no-underline hover:prose-a:underline prose-img:rounded-xl prose-pre:rounded-xl prose-pre:border prose-pre:border-[var(--border)] prose-pre:bg-[#0b1220] prose-pre:text-slate-100 prose-code:font-[var(--font-code)] prose-code:before:content-none prose-code:after:content-none prose-table:w-full prose-th:bg-[var(--surface-alt)] max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children, ...props }) => (
                    <h1 id={slugify(nodeText(children))} {...props}>
                      {children}
                    </h1>
                  ),
                  h2: ({ children, ...props }) => (
                    <h2 id={slugify(nodeText(children))} {...props}>
                      {children}
                    </h2>
                  ),
                  h3: ({ children, ...props }) => (
                    <h3 id={slugify(nodeText(children))} {...props}>
                      {children}
                    </h3>
                  ),
                  h4: ({ children, ...props }) => (
                    <h4 id={slugify(nodeText(children))} {...props}>
                      {children}
                    </h4>
                  ),
                  h5: ({ children, ...props }) => (
                    <h5 id={slugify(nodeText(children))} {...props}>
                      {children}
                    </h5>
                  ),
                }}
              >
                {post.content}
              </ReactMarkdown>
            </article>

            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-8">
                {post.tags.map((tag) => (
                  <Link
                    className="rounded-full bg-[var(--surface-alt)] px-3 py-1 text-sm text-[var(--foreground)] transition-colors hover:text-[var(--brand)]"
                    href={`/posts?tag=${encodeURIComponent(tag.slug)}`}
                    key={tag.slug}
                  >
                    #{tag.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </article>
      </div>

      <section className="card-base mx-auto w-full max-w-[980px] p-5 xl:min-w-[880px]">
        <h2 className="mb-4 font-display text-xl font-bold text-[var(--foreground)]">文章互动</h2>
        <div className="flex flex-wrap items-center gap-3">
          <LikeButton initialCount={post._count.likes} initialLiked={false} slug={post.slug} />
          <BookmarkButton initialBookmarked={false} slug={post.slug} />
          <ShareButton slug={post.slug} title={post.title} />
        </div>
      </section>

      <section className="card-base mx-auto w-full max-w-[980px] p-8 xl:min-w-[880px]">
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
