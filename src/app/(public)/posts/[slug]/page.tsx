import { CommentAuthGate } from "@/components/CommentAuthGate";
export const revalidate = 300;

import type { Metadata } from "next";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleToc, BackToTopButton, BookmarkButton, LikeButton, ReadingProgress, ShareButton } from "@/components/blog";
import { prisma } from "@/lib/prisma";
import { buildArticleJsonLd, buildArticleMetadata } from "@/lib/seo";

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

type ArticlePost = NonNullable<Awaited<ReturnType<typeof getPost>>>

function getCommentLabel(comment: ArticlePost['comments'][number] | ArticlePost['comments'][number]['replies'][number]) {
  return comment.authorLabel || comment.author?.name || '匿名访客'
}

export async function generateStaticParams() {
  try {
    const posts = await prisma.post.findMany({
      where: { published: true },
      select: { slug: true },
      take: 100,
    })

    return posts.map((post) => ({ slug: post.slug }))
  } catch (error) {
    console.error("Generate post static params error:", error)
    return []
  }
}

/**
 * 为文章详情页生成 SEO metadata。
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) {
    return {
      title: '文章不存在 | My Blog',
      description: '未找到对应文章。',
    }
  }

  return buildArticleMetadata({
    title: `Article Title` === post.title ? `${post.title} | My Blog` : `${post.title} | My Blog`,
    description: post.excerpt || `${post.title} - My Blog`,
    path: `/posts/${post.slug}`,
    image: post.coverImage,
    publishedTime: (post.publishedAt || post.createdAt).toISOString(),
    modifiedTime: post.updatedAt?.toISOString(),
  })
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

  if (!post) {
    notFound();
  }

  const headings = extractHeadings(post.content);
  const articleJsonLd = buildArticleJsonLd({
    title: post.title,
    description: post.excerpt || `${post.title} - My Blog`,
    path: `/posts/${post.slug}`,
    publishedTime: (post.publishedAt || post.createdAt).toISOString(),
    modifiedTime: post.updatedAt?.toISOString(),
    authorName: post.author.name || 'Author',
    image: post.coverImage,
  })

  return (
    <div className="relative space-y-8 overflow-x-clip">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <ReadingProgress />
      <BackToTopButton />

      <aside
        data-testid="toc-rail"
        className="hidden xl:fixed xl:top-24 xl:block xl:w-64"
        style={{ left: "calc(50% + 490px + 120px)" }}
      >
        <div className="card-base max-h-[calc(100vh-8rem)] overflow-auto p-4">
          <h3 className="mb-3 font-display text-lg font-semibold text-[var(--foreground)]">目录</h3>
          <ArticleToc headings={headings} />
        </div>
      </aside>

      <div className="mx-auto w-full max-w-[980px] xl:min-w-[880px]">
        <article className="card-base overflow-hidden">
          {post.coverImage && (
            <div className="theme-media relative h-64 w-full md:h-96">
              <Image alt={post.title} className="theme-media-image object-cover" fill priority src={post.coverImage} />
            </div>
          )}

          <div className="space-y-8 p-8">
            <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
              {post.category && (
                <Link className="rounded-full bg-[var(--surface-alt)] px-3 py-1 font-semibold text-[var(--primary)]" href={`/posts?category=${encodeURIComponent(post.category.slug)}`}>
                  {post.category.name}
                </Link>
              )}
              <span>{new Date(post.createdAt).toLocaleDateString("zh-CN")}</span>
              <span>{post.viewCount} 阅读</span>
            </div>

            <h1 className="font-display text-4xl font-extrabold leading-tight text-[var(--foreground)]">{post.title}</h1>

            <div className="flex items-center gap-3 border-b border-[var(--border)] pb-8">
              {post.author.image ? (
                <Image alt={post.author.name || "Author"} className="theme-media-image rounded-full object-cover" height={40} src={post.author.image} width={40} />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-alt)]">
                  <span className="text-sm text-[var(--muted)]">{post.author.name?.charAt(0) || "A"}</span>
                </div>
              )}
              <p className="font-medium text-[var(--foreground)]">{post.author.name}</p>
            </div>

            <div className="max-w-[76ch]">
              <article className="prose prose-zinc max-w-none prose-headings:font-display prose-headings:scroll-mt-28 prose-headings:mt-10 prose-headings:mb-4 prose-headings:text-[var(--foreground)] prose-h1:text-[var(--foreground)] prose-h2:text-[var(--foreground)] prose-h3:text-[var(--foreground)] prose-h4:text-[var(--foreground)] prose-h5:text-[var(--foreground)] prose-h6:text-[var(--foreground)] prose-p:my-5 prose-p:leading-8 prose-p:text-[var(--text-body)] prose-a:text-[var(--brand)] prose-a:no-underline hover:prose-a:underline prose-strong:text-[var(--foreground)] prose-li:text-[var(--text-body)] prose-li:marker:text-[var(--text-faint)] prose-blockquote:border-[var(--border-strong)] prose-blockquote:border-l-[3px] prose-blockquote:text-[var(--text-body)] prose-blockquote:font-medium prose-hr:border-[var(--border)] prose-img:rounded-xl prose-pre:rounded-xl prose-pre:border prose-pre:border-[var(--border)] prose-pre:bg-[var(--surface-elevated)] prose-pre:text-[var(--foreground)] prose-code:rounded prose-code:bg-[color-mix(in_oklab,var(--surface-contrast)_82%,black_18%)] prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[color-mix(in_oklab,var(--foreground)_92%,white_8%)] prose-code:font-[var(--font-code)] prose-code:before:content-none prose-code:after:content-none prose-table:w-full prose-th:bg-[var(--surface-contrast)] prose-th:text-[var(--foreground)] prose-td:border-[var(--border)] prose-th:border-[var(--border)] dark:prose-invert">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
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
                    img: ({ src, alt }) => {
                      const imageSrc = typeof src === 'string' ? src : null
                      if (!imageSrc) return null

                      return (
                        <span className="my-8 block overflow-hidden rounded-xl">
                          <Image
                            alt={alt ?? ''}
                            className="theme-media-image h-auto w-full"
                            height={900}
                            src={imageSrc}
                            unoptimized
                            width={1600}
                          />
                        </span>
                      )
                    },
                  }}
                >
                  {post.content}
                </ReactMarkdown>
              </article>
            </div>

            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-8">
                {post.tags.map((tag: ArticlePost['tags'][number]) => (
                  <Link
                    className="rounded-full bg-[var(--surface-alt)] px-3 py-1 text-sm text-[var(--foreground)] transition-colors hover:text-[var(--primary)]"
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
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-[var(--foreground)]">文章互动</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">读到这里，来说说你的看法</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <LikeButton initialCount={post._count.likes} initialLiked={false} slug={post.slug} />
          <BookmarkButton excerpt={post.excerpt} initialBookmarked={false} slug={post.slug} title={post.title} />
          <ShareButton slug={post.slug} title={post.title} />
          <Link
            className="ui-btn rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            href="#comments"
          >
            参与讨论
          </Link>
        </div>
      </section>

      <section className="card-base mx-auto w-full max-w-[980px] p-8 xl:min-w-[880px]" id="comments">
        <h2 className="mb-6 font-display text-2xl font-bold text-[var(--foreground)]">评论 ({post._count.comments})</h2>
        <p className="mb-6 text-sm text-[var(--muted)]">欢迎分享你的观点或补充实践经验，优质讨论能帮助更多读者。</p>

        <CommentAuthGate postId={post.id} />

        <div className="space-y-6">
          {post.comments.map((comment: ArticlePost['comments'][number]) => (
            <div className="border-b border-[var(--border)] pb-6" key={comment.id}>
              <div className="mb-2 flex items-center gap-3">
                {comment.author?.image ? (
                  <Image alt={getCommentLabel(comment)} className="theme-media-image rounded-full object-cover" height={32} src={comment.author.image} width={32} />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-[var(--surface-alt)]" />
                )}
                <span className="font-medium text-[var(--foreground)]">{getCommentLabel(comment)}</span>
                <span className="text-xs text-[var(--muted)]">{new Date(comment.createdAt).toLocaleDateString("zh-CN")}</span>
              </div>
              <p className="ml-11 text-[var(--foreground)]/90">{comment.content}</p>

              {comment.replies.length > 0 && (
                <div className="ml-11 mt-4 space-y-4">
                  {comment.replies.map((reply: ArticlePost['comments'][number]['replies'][number]) => (
                    <div className="border-l-2 border-[var(--border)] pl-4" key={reply.id}>
                      <div className="mb-1 flex items-center gap-2">
                        <span className="font-medium text-[var(--foreground)]">{getCommentLabel(reply)}</span>
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

