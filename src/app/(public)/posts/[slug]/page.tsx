export const revalidate = 300;

import type { Metadata } from "next";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleContinuation, ArticleHero, ArticleToc, BackToTopButton, BookmarkButton, LikeButton, ReadingProgress, SectionHeader, ShareButton } from "@/components/blog";
import { CommentAuthGate } from "@/components/CommentAuthGate";
import { FallbackImage } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { buildArticleJsonLd, buildArticleMetadata, buildBreadcrumbJsonLd } from "@/lib/seo";

async function getPost(slug: string) {
  return prisma.post.findFirst({
    where: { slug, deletedAt: null, published: true },
    select: {
      id: true,
      title: true,
      slug: true,
      content: true,
      excerpt: true,
      seoDescription: true,
      coverImage: true,
      createdAt: true,
      updatedAt: true,
      publishedAt: true,
      viewCount: true,
      readingTimeMinutes: true,
      author: {
        select: { id: true, name: true, image: true },
      },
      category: { select: { name: true, slug: true } },
      tags: { where: { deletedAt: null }, select: { name: true, slug: true } },
      comments: {
        where: { parentId: null, deletedAt: null },
        select: {
          id: true,
          content: true,
          authorLabel: true,
          createdAt: true,
          author: {
            select: { id: true, name: true, image: true },
          },
          replies: {
            where: { deletedAt: null },
            select: {
              id: true,
              content: true,
              authorLabel: true,
              createdAt: true,
              author: {
                select: { id: true, name: true, image: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: { comments: { where: { deletedAt: null } }, likes: true },
      },
    },
  });
}

type ArticlePost = NonNullable<Awaited<ReturnType<typeof getPost>>>

async function getContinuationData(post: ArticlePost) {
  const [previousPost, nextPost] = await Promise.all([
    prisma.post.findFirst({
      where: { published: true, deletedAt: null, createdAt: { lt: post.createdAt } },
      select: { slug: true, title: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.post.findFirst({
      where: { published: true, deletedAt: null, createdAt: { gt: post.createdAt } },
      select: { slug: true, title: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  return {
    previousPost,
    nextPost,
  }
}

export async function generateStaticParams() {
  try {
    const posts = await prisma.post.findMany({
      where: { published: true, deletedAt: null },
      select: { slug: true },
      take: 100,
    })

    return posts.map((post: { slug: string }) => ({ slug: post.slug }))
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
  const description = post.seoDescription || post.excerpt || `${post.title} - My Blog`

  return buildArticleMetadata({
    title: `${post.title} | My Blog`,
    description,
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

function getUniqueHeadingId(text: string, counters: Map<string, number>) {
  const baseId = slugify(text) || "section"
  const count = (counters.get(baseId) ?? 0) + 1
  counters.set(baseId, count)

  return count === 1 ? baseId : `${baseId}-${count}`
}

function extractHeadings(content: string) {
  const counters = new Map<string, number>()
  const headings: Array<{ id: string; text: string; level: 1 | 2 | 3 }> = []

  content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^#{1,5}\s+/.test(line))
    .forEach((line) => {
      const level = line.match(/^#+/)?.[0].length ?? 1
      const text = line.replace(/^#{1,5}\s+/, "")
      const id = getUniqueHeadingId(text, counters)

      if (level <= 3) {
        headings.push({ id, text, level: level as 1 | 2 | 3 })
      }
    })

  return headings
}

function nodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return nodeText((node as { props?: { children?: ReactNode } }).props?.children);
  }
  return "";
}

function getCommentLabel(comment: { author?: { name?: string | null } | null; authorLabel?: string | null }) {
  return comment.author?.name || comment.authorLabel || '匿名读者'
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    notFound();
  }

  const { previousPost, nextPost } = await getContinuationData(post)

  const headings = extractHeadings(post.content);
  const renderedHeadingCounters = new Map<string, number>()
  const getRenderedHeadingId = (children: ReactNode) => getUniqueHeadingId(nodeText(children), renderedHeadingCounters)
  const description = post.seoDescription || post.excerpt || `${post.title} - My Blog`
  const articleJsonLd = buildArticleJsonLd({
    title: post.title,
    description,
    path: `/posts/${post.slug}`,
    publishedTime: (post.publishedAt || post.createdAt).toISOString(),
    modifiedTime: post.updatedAt?.toISOString(),
    authorName: post.author.name || 'Author',
    image: post.coverImage,
    categoryName: post.category?.name,
    tags: post.tags.map((tag) => tag.name),
  })
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: '首页', path: '/' },
    { name: '文章', path: '/posts' },
    { name: post.title, path: `/posts/${post.slug}` },
  ])

  return (
    <div className="relative overflow-x-clip pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([articleJsonLd, breadcrumbJsonLd]) }}
      />
      <ReadingProgress />
      <BackToTopButton />

      <div className="grid gap-[var(--layout-rail-gap)] xl:grid-cols-[minmax(0,1fr)_minmax(22rem,24rem)] xl:items-start">
        <div className="min-w-0 space-y-8">
          <article className="article-shell reader-card overflow-hidden">
            <ArticleHero
              title={post.title}
              excerpt={post.excerpt}
              coverImage={post.coverImage}
              category={post.category}
              author={post.author}
              createdAt={post.createdAt}
              viewCount={post.viewCount}
              readingTimeMinutes={post.readingTimeMinutes}
            />

            <div className="px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
              <div className="mx-auto max-w-[var(--reading-max-width)]">
                <div className="reader-prose prose prose-zinc max-w-none prose-headings:font-display prose-headings:scroll-mt-28 prose-headings:mt-12 prose-headings:mb-5 prose-headings:text-[var(--foreground)] prose-h1:text-[var(--foreground)] prose-h2:text-[var(--foreground)] prose-h3:text-[var(--foreground)] prose-h4:text-[var(--foreground)] prose-h5:text-[var(--foreground)] prose-h6:text-[var(--foreground)] prose-p:my-5 prose-p:leading-8 prose-p:text-[var(--text-body)] prose-a:text-[var(--accent-sky)] prose-a:no-underline hover:prose-a:text-[var(--foreground)] hover:prose-a:underline prose-strong:text-[var(--foreground)] prose-li:text-[var(--text-body)] prose-li:marker:text-[var(--text-faint)] prose-blockquote:rounded-2xl prose-blockquote:border-[var(--accent-warm)] prose-blockquote:border-l-[3px] prose-blockquote:bg-[color-mix(in_oklab,var(--accent-warm)_10%,transparent)] prose-blockquote:px-5 prose-blockquote:py-1 prose-blockquote:text-[var(--text-body)] prose-blockquote:font-medium prose-hr:border-[var(--reader-border)] prose-img:rounded-2xl prose-pre:rounded-2xl prose-pre:border prose-pre:border-[var(--reader-border)] prose-pre:bg-[color-mix(in_oklab,var(--reader-panel-elevated)_80%,black_20%)] prose-pre:text-[var(--foreground)] prose-code:rounded prose-code:bg-[color-mix(in_oklab,var(--reader-panel-muted)_82%,black_18%)] prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[color-mix(in_oklab,var(--foreground)_92%,white_8%)] prose-code:font-[var(--font-code)] prose-code:before:content-none prose-code:after:content-none prose-table:w-full prose-th:bg-[var(--reader-panel-muted)] prose-th:text-[var(--foreground)] prose-td:border-[var(--reader-border)] prose-th:border-[var(--reader-border)] dark:prose-invert">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                    components={{
                      h1: ({ children, ...props }) => (
                        <h1 id={getRenderedHeadingId(children)} {...props}>
                          {children}
                        </h1>
                      ),
                      h2: ({ children, ...props }) => (
                        <h2 id={getRenderedHeadingId(children)} {...props}>
                          {children}
                        </h2>
                      ),
                      h3: ({ children, ...props }) => (
                        <h3 id={getRenderedHeadingId(children)} {...props}>
                          {children}
                        </h3>
                      ),
                      h4: ({ children, ...props }) => (
                        <h4 id={getRenderedHeadingId(children)} {...props}>
                          {children}
                        </h4>
                      ),
                      h5: ({ children, ...props }) => (
                        <h5 id={getRenderedHeadingId(children)} {...props}>
                          {children}
                        </h5>
                      ),
                      img: ({ src, alt }) => {
                        const imageSrc = typeof src === 'string' ? src : null
                        if (!imageSrc) return null

                        return (
                          <span className="theme-media my-8 block overflow-hidden rounded-2xl border border-[var(--reader-border)]">
                            <FallbackImage
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
                </div>

                {post.tags.length > 0 ? (
                  <div className="mt-10 flex flex-wrap gap-2 border-t border-[var(--reader-border)] pt-8">
                    {post.tags.map((tag: ArticlePost['tags'][number]) => (
                      <Link
                        className="reader-chip"
                        href={`/tags/${tag.slug}`}
                        key={tag.slug}
                      >
                        #{tag.name}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </article>

          <section className="reader-panel w-full space-y-6 p-6 sm:p-8">
            <SectionHeader
              eyebrow="读后"
              title="读后操作"
              description="保存、分享、继续阅读，或直接跳到评论区。"
            />

            <div className="flex flex-wrap items-center gap-3">
              <LikeButton initialCount={post._count.likes} initialLiked={false} slug={post.slug} />
              <BookmarkButton excerpt={post.excerpt} initialBookmarked={false} slug={post.slug} title={post.title} />
              <ShareButton slug={post.slug} title={post.title} />
              <Link
                className="inline-flex h-11 items-center justify-center rounded-full border border-[color:color-mix(in_oklab,var(--accent-warm)_58%,var(--reader-border))] bg-[color-mix(in_oklab,var(--accent-warm)_88%,black_12%)] px-4 text-sm font-semibold text-[color-mix(in_oklab,var(--foreground)_12%,white_88%)] transition hover:bg-[var(--accent-warm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                href="#comments"
              >
                发表评论
              </Link>
            </div>

            <ArticleContinuation nextPost={nextPost} previousPost={previousPost} />
          </section>

          <section className="reader-panel w-full p-6 sm:p-8" id="comments">
            <h2 className="mb-3 font-display text-2xl font-bold text-[var(--foreground)]">评论 ({post._count.comments})</h2>
            <p className="mb-6 text-sm leading-6 text-[var(--text-muted)]">欢迎分享你的观点或补充事实和论据，但请避免人身攻击或侮辱他人。</p>

            <CommentAuthGate postId={post.id} />

            <div className="mt-8 space-y-6">
              {post.comments.map((comment: ArticlePost['comments'][number]) => (
                <div className="border-b border-[var(--reader-border)] pb-6 last:border-b-0 last:pb-0" key={comment.id}>
                  <div className="mb-2 flex items-center gap-3">
                    {comment.author?.image ? (
                      <FallbackImage alt={getCommentLabel(comment)} className="theme-media-image rounded-full object-cover" height={32} src={comment.author.image} width={32} />
                    ) : (
                      <div className="h-8 w-8 rounded-full border border-[var(--reader-border)] bg-[var(--reader-panel-muted)]" />
                    )}
                    <span className="font-medium text-[var(--foreground)]">{getCommentLabel(comment)}</span>
                    <span className="text-xs text-[var(--text-muted)]">{new Date(comment.createdAt).toLocaleDateString("zh-CN")}</span>
                  </div>
                  <p className="ml-11 leading-7 text-[var(--text-body)]">{comment.content}</p>

                  {comment.replies.length > 0 && (
                    <div className="ml-11 mt-4 space-y-4">
                      {comment.replies.map((reply: ArticlePost['comments'][number]['replies'][number]) => (
                        <div className="border-l-2 border-[var(--reader-border)] pl-4" key={reply.id}>
                          <div className="mb-1 flex items-center gap-2">
                            <span className="font-medium text-[var(--foreground)]">{getCommentLabel(reply)}</span>
                            <span className="text-xs text-[var(--text-muted)]">{new Date(reply.createdAt).toLocaleDateString("zh-CN")}</span>
                          </div>
                          <p className="leading-7 text-[var(--text-body)]">{reply.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {post.comments.length === 0 && <p className="rounded-2xl border border-dashed border-[var(--reader-border)] py-8 text-center text-sm text-[var(--text-muted)]">暂无评论</p>}
            </div>
          </section>
        </div>

        <aside
          data-testid="toc-rail"
          className="hidden transition-[top,max-height,transform,box-shadow] duration-300 ease-out will-change-[top,transform] xl:sticky xl:block"
          style={{
            top: "calc(var(--sidebar-sticky-top, 0px) + 0.75rem)",
          }}
        >
          <div className="reader-panel h-[var(--article-toc-card-height)] overflow-auto p-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">On this page</p>
            <h3 className="mb-4 font-display text-lg font-semibold text-[var(--foreground)]">目录</h3>
            <ArticleToc headings={headings} />
          </div>
        </aside>
      </div>
    </div>
  );
}
