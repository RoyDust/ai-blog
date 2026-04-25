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
import { buildArticleJsonLd, buildArticleMetadata } from "@/lib/seo";

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
    title: `Article Title` === post.title ? `${post.title} | My Blog` : `${post.title} | My Blog`,
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
  const description = post.seoDescription || post.excerpt || `${post.title} - My Blog`
  const articleJsonLd = buildArticleJsonLd({
    title: post.title,
    description,
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
        className="hidden transition-[top,max-height,transform,box-shadow] duration-300 ease-out will-change-[top,transform] xl:fixed xl:block xl:w-64"
        style={{
          left: "calc(50% + 490px + 120px)",
          top: "calc(var(--sidebar-sticky-top, 0px) + 1rem)",
        }}
      >
        <div
          className="card-base overflow-auto p-4"
          style={{
            maxHeight: "calc(100vh - var(--sidebar-sticky-top, 0px) - 2rem)",
          }}
        >
          <h3 className="mb-3 font-display text-lg font-semibold text-[var(--foreground)]">目录</h3>
          <ArticleToc headings={headings} />
        </div>
      </aside>

      <div className="mx-auto w-full max-w-[980px] xl:min-w-[880px]">
        <article className="card-base overflow-hidden">
          {post.coverImage ? (
            <div className="theme-media relative h-64 w-full md:h-[28rem]">
              <FallbackImage alt={post.title} className="theme-media-image object-cover" fill priority src={post.coverImage} />
            </div>
          ) : null}

          <div className="space-y-8 p-8">
            <ArticleHero
              title={post.title}
              excerpt={post.excerpt}
              category={post.category}
              author={post.author}
              createdAt={post.createdAt}
              viewCount={post.viewCount}
              readingTimeMinutes={post.readingTimeMinutes}
            />

            <div className="max-w-[var(--reading-max-width)]">
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
              </article>
            </div>

            {post.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-8">
                {post.tags.map((tag: ArticlePost['tags'][number]) => (
                  <Link
                    className="ui-chip"
                    href={`/tags/${tag.slug}`}
                    key={tag.slug}
                  >
                    #{tag.name}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </article>
      </div>

      <section className="card-base mx-auto w-full max-w-[980px] space-y-6 p-6 xl:min-w-[880px]">
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
            className="ui-btn rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white"
            href="#comments"
          >
            发表评论
          </Link>
        </div>

        <ArticleContinuation nextPost={nextPost} previousPost={previousPost} />
      </section>

      <section className="card-base mx-auto w-full max-w-[980px] p-8 xl:min-w-[880px]" id="comments">
        <h2 className="mb-6 font-display text-2xl font-bold text-[var(--foreground)]">评论 ({post._count.comments})</h2>
        <p className="mb-6 text-sm text-[var(--muted)]">欢迎分享你的观点或补充事实和论据，但请避免人身攻击或侮辱他人。</p>

        <CommentAuthGate postId={post.id} />

        <div className="space-y-6">
          {post.comments.map((comment: ArticlePost['comments'][number]) => (
            <div className="border-b border-[var(--border)] pb-6" key={comment.id}>
              <div className="mb-2 flex items-center gap-3">
                {comment.author?.image ? (
                  <FallbackImage alt={getCommentLabel(comment)} className="theme-media-image rounded-full object-cover" height={32} src={comment.author.image} width={32} />
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
