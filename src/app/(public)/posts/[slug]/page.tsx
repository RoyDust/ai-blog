export const revalidate = 300;
export const dynamicParams = true;

/**
 * 前台文章详情页。
 *
 * 职责：
 * - 加载已发布文章的完整阅读数据
 * - 生成文章页 SEO metadata、JSON-LD 与目录结构
 * - 组合正文、互动组件、延伸阅读和评论区
 *
 * 阅读建议：
 * - 先看 getPost / getContinuationData 的数据装配
 * - 再看 generateMetadata 与 JSON-LD 生成
 * - 最后看 PostPage 内部的页面结构拼装
 */

import type { Metadata } from "next";
import { Suspense, use, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeHighlightCodeLines from "rehype-highlight-code-lines";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleHero, ArticleReadTracker, ArticleRelatedPosts, ArticleSection, ArticleTocDrawer, ArticleTocRail, BackToTopButton, BookmarkButton, CopyCodeButton, LikeButton, NewsletterForm, ReadingProgress, SeriesNav, ShareButton } from "@/components/blog";
import { InViewReveal } from "@/components/motion";
import { CommentAuthGate } from "@/components/CommentAuthGate";
import { FallbackImage } from "@/components/ui";
import { getBlogSettings } from "@/lib/blog-settings";
import { prisma } from "@/lib/prisma";
import { getRecommendedPostsForPost } from "@/lib/recommendations";
import { stripLeadingTitleHeading } from "@/lib/article-content";
import { buildArticleJsonLd, buildArticleMetadata, buildBreadcrumbJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";

/**
 * 读取单篇已发布文章详情。
 * 返回正文、作者、分类、标签、评论与互动统计，供文章页一次性渲染。
 */
async function getPost(slug: string, options: { includeDraft?: boolean } = {}) {
  return prisma.post.findFirst({
    where: { slug, deletedAt: null, ...(options.includeDraft ? {} : { published: true }) },
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
      published: true,
      viewCount: true,
      readingTimeMinutes: true,
      author: {
        select: { id: true, name: true, image: true },
      },
      category: { select: { name: true, slug: true } },
      series: {
        select: {
          title: true,
          slug: true,
          deletedAt: true,
          posts: {
            where: { deletedAt: null, published: true },
            select: { title: true, slug: true, seriesOrder: true },
            orderBy: [{ seriesOrder: "asc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
          },
        },
      },
      tags: { where: { deletedAt: null }, select: { name: true, slug: true } },
      _count: {
        select: { comments: { where: { deletedAt: null, status: "APPROVED" } }, likes: true },
      },
    },
  });
}

type ArticlePost = NonNullable<Awaited<ReturnType<typeof getPost>>>

export async function generateStaticParams() {
  try {
    const posts = await prisma.post.findMany({
      where: { published: true, deletedAt: null },
      select: { slug: true },
      orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    });

    return posts.map((post) => ({ slug: post.slug }));
  } catch (error) {
    console.error("Generate article static params error:", error);
    return [];
  }
}

async function getPostComments(postId: string) {
  return prisma.comment.findMany({
    where: { postId, parentId: null, deletedAt: null, status: "APPROVED" },
    select: {
      id: true,
      content: true,
      authorLabel: true,
      createdAt: true,
      author: {
        select: { id: true, name: true, image: true },
      },
      replies: {
        where: { postId, deletedAt: null, status: "APPROVED" },
        select: {
          id: true,
          content: true,
          authorLabel: true,
          createdAt: true,
          author: {
            select: { id: true, name: true, image: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  })
}

type ArticleComment = Awaited<ReturnType<typeof getPostComments>>[number]
type ArticleReply = ArticleComment['replies'][number]


/**
 * 为文章详情页生成 SEO metadata。
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const [post, settings] = await Promise.all([getPost(slug), getBlogSettings()])
  if (!post) {
    return {
      title: `文章不存在 | ${settings.siteName}`,
      description: '未找到对应文章。',
    }
  }
  const description = post.seoDescription || post.excerpt || `${post.title} - ${settings.siteName}`

  const metadata = buildArticleMetadata({
    title: `${post.title} | ${settings.siteName}`,
    description,
    path: `/posts/${post.slug}`,
    image: post.coverImage,
    publishedTime: (post.publishedAt || post.createdAt).toISOString(),
    modifiedTime: post.updatedAt?.toISOString(),
    authorName: post.author.name,
    siteUrl: settings.siteUrl,
  })

  return metadata;
}

/**
 * 把标题文本转为目录锚点可用的基础 id。
 */
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

/**
 * 从 Markdown 正文中提取 1-3 级标题，供侧边目录组件使用。
 */
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

function getCommentInitial(label: string) {
  const first = Array.from(label.trim())[0]
  return first ? first.toLocaleUpperCase("zh-CN") : "读"
}

function CommentListSkeleton() {
  return (
    <div className="mt-5 space-y-4" aria-label="评论加载中">
      {[0, 1, 2].map((item) => (
        <div className="border-t border-[var(--line-color)] pt-4 first:border-t-0 first:pt-0" key={item}>
          <div className="mb-2.5 flex items-center gap-2.5">
            <div className="reader-skeleton h-8 w-8 rounded-lg" />
            <div className="reader-skeleton h-3.5 w-20 rounded-full" />
            <div className="reader-skeleton h-3 w-14 rounded-full" />
          </div>
          <div className="ml-10 space-y-2">
            <div className="reader-skeleton h-3.5 w-full rounded-full" />
            <div className="reader-skeleton h-3.5 w-2/3 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

function CommentList({ commentsPromise }: { commentsPromise: Promise<Awaited<ReturnType<typeof getPostComments>>> }) {
  const comments = use(commentsPromise)

  if (comments.length === 0) {
    return (
      <p className="mt-4 border-t border-dashed border-[var(--line-color)] pt-5 text-center text-sm text-[var(--text-muted)]">
        暂无评论
      </p>
    )
  }

  return (
    <div className="mt-5">
      {comments.map((comment: ArticleComment) => {
        const label = getCommentLabel(comment)
        return (
          <div
            className="grid grid-cols-[2.125rem_minmax(0,1fr)] gap-3 border-t border-[var(--line-color)] pt-4 mt-4 first:mt-0"
            key={comment.id}
          >
            {comment.author?.image ? (
              <FallbackImage alt={label} className="theme-media-image h-[34px] w-[34px] rounded-lg object-cover" height={34} src={comment.author.image} width={34} />
            ) : (
              <div className="flex h-[34px] w-[34px] items-center justify-center rounded-lg bg-[var(--btn-regular-bg)] text-xs font-bold text-[var(--btn-content)]">
                {getCommentInitial(label)}
              </div>
            )}

            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-2 text-xs">
                <span className="font-semibold text-[var(--foreground)]">{label}</span>
                <span className="font-mono tabular-nums text-[var(--text-muted)]">
                  {new Date(comment.createdAt).toLocaleDateString("zh-CN")}
                </span>
              </div>
              <p className="mt-1 text-sm leading-6 text-[var(--text-body)]">{comment.content}</p>

              {comment.replies.length > 0 && (
                <div className="mt-3 space-y-3 border-l-2 border-[var(--line-color)] pl-3.5">
                  {comment.replies.map((reply: ArticleReply) => (
                    <div key={reply.id}>
                      <div className="flex flex-wrap items-baseline gap-2 text-xs">
                        <span className="font-semibold text-[var(--foreground)]">{getCommentLabel(reply)}</span>
                        <span className="font-mono tabular-nums text-[var(--text-muted)]">
                          {new Date(reply.createdAt).toLocaleDateString("zh-CN")}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm leading-6 text-[var(--text-body)]">{reply.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * 文章详情页入口。
 * 负责把正文、目录、互动按钮、上一篇/下一篇与评论区组合成完整阅读体验。
 */
export async function renderArticlePage({ slug, includeDraft = false }: { slug: string; includeDraft?: boolean }) {
  const post = await getPost(slug, { includeDraft });

  if (!post) {
    notFound();
  }

  const isDraftPreview = includeDraft && !post.published;

  const relatedPosts = isDraftPreview ? [] : await getRecommendedPostsForPost({ postId: post.id, limit: 3 })
  const commentsPromise = isDraftPreview ? null : getPostComments(post.id)

  const articleContent = stripLeadingTitleHeading(post.content, post.title)
  const headings = extractHeadings(articleContent);
  const renderedHeadingCounters = new Map<string, number>()
  const getRenderedHeadingId = (children: ReactNode) => getUniqueHeadingId(nodeText(children), renderedHeadingCounters)
  const settings = await getBlogSettings()
  const description = post.seoDescription || post.excerpt || `${post.title} - ${settings.siteName}`
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
    siteName: settings.siteName,
    siteUrl: settings.siteUrl,
  })
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: '首页', path: '/' },
    { name: '文章', path: '/posts' },
    { name: post.title, path: `/posts/${post.slug}` },
  ], { siteUrl: settings.siteUrl })

  return (
    <div className="article-detail-page relative overflow-x-clip pb-16">
      {isDraftPreview ? null : <JsonLd data={[articleJsonLd, breadcrumbJsonLd]} />}
      {isDraftPreview ? null : <ArticleReadTracker postId={post.id} />}
      <ReadingProgress />
      <BackToTopButton />
      <ArticleTocDrawer headings={headings} />

      {isDraftPreview ? (
        <div className="ui-status-warning mb-5 rounded-xl px-4 py-3 text-sm font-medium">
          草稿预览仅后台管理员可见，公开阅读、点赞、收藏、评论和阅读统计已停用。
        </div>
      ) : null}

      <div className="grid gap-[var(--layout-rail-gap)] xl:grid-cols-[minmax(0,1fr)_var(--article-toc-width)] xl:items-start">
        <div className="min-w-0 space-y-4">
          <ArticleSection animate="visible" initial="hidden">
          <article className="article-shell reader-card overflow-hidden">
            <ArticleHero
              slug={post.slug}
              title={post.title}
              excerpt={post.excerpt}
              coverImage={post.coverImage}
              category={post.category}
              author={post.author}
              createdAt={post.createdAt}
              viewCount={post.viewCount}
              readingTimeMinutes={post.readingTimeMinutes}
            />

            <div className="px-5 pt-3 pb-6 sm:px-7 lg:px-9 lg:pb-8">
              <div className="mx-auto max-w-[var(--article-reading-max-width)]">
                <div className="reader-prose prose prose-zinc max-w-none prose-headings:font-display prose-headings:scroll-mt-28 prose-headings:mt-9 prose-headings:mb-3.5 prose-headings:text-[var(--foreground)] prose-h1:text-[var(--foreground)] prose-h2:text-[var(--foreground)] [&_h2]:before:mr-2 [&_h2]:before:font-mono [&_h2]:before:font-semibold [&_h2]:before:text-[var(--brand)] [&_h2]:before:content-['#'] prose-h3:text-[var(--foreground)] prose-h4:text-[var(--foreground)] prose-h5:text-[var(--foreground)] prose-h6:text-[var(--foreground)] prose-p:my-4 prose-p:leading-[1.82] prose-p:text-[var(--text-body)] prose-a:text-[var(--brand)] prose-a:no-underline hover:prose-a:text-[var(--brand-strong)] hover:prose-a:underline prose-strong:text-[var(--foreground)] prose-li:text-[var(--text-body)] prose-li:marker:text-[var(--text-faint)] prose-blockquote:rounded-xl prose-blockquote:border-[var(--accent-warm)] prose-blockquote:border-l-[3px] prose-blockquote:bg-[color-mix(in_oklab,var(--accent-warm)_8%,transparent)] prose-blockquote:px-4 prose-blockquote:py-1 prose-blockquote:text-[var(--text-body)] prose-blockquote:font-medium prose-hr:border-[var(--reader-border)] prose-img:rounded-2xl prose-pre:rounded-2xl prose-pre:border prose-pre:border-[var(--reader-border)] prose-pre:bg-[var(--surface-elevated)] prose-pre:text-[var(--foreground)] prose-code:rounded prose-code:bg-[color-mix(in_oklab,var(--reader-panel-muted)_82%,black_18%)] prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[color-mix(in_oklab,var(--foreground)_92%,white_8%)] prose-code:font-[var(--font-code)] prose-code:before:content-none prose-code:after:content-none prose-table:w-full prose-th:bg-[var(--reader-panel-muted)] prose-th:text-[var(--foreground)] prose-td:border-[var(--reader-border)] prose-th:border-[var(--reader-border)] dark:prose-invert">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight, [rehypeHighlightCodeLines, { showLineNumbers: true }]]}
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
                      pre: ({ children, ...props }) => {
                        const code = nodeText(children).replace(/\n$/, "")

                        return (
                          <div className="group relative my-6">
                            <CopyCodeButton code={code} />
                            <pre {...props}>{children}</pre>
                          </div>
                        )
                      },
                    }}
                  >
                    {articleContent}
                  </ReactMarkdown>
                </div>

                {(!isDraftPreview || post.tags.length > 0) ? (
                  <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-dashed border-[var(--line-color)] pt-5">
                    {!isDraftPreview ? (
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h2 className="sr-only">读后操作</h2>
                        <LikeButton initialCount={post._count.likes} initialLiked={false} slug={post.slug} />
                        <BookmarkButton excerpt={post.excerpt} initialBookmarked={false} slug={post.slug} title={post.title} />
                        <ShareButton
                          authorName={post.author.name || settings.siteName}
                          slug={post.slug}
                          sourceName={settings.siteName}
                          title={post.title}
                        />
                        <Link
                          className="home-primary-cta h-11 rounded-full px-4 text-sm"
                          href="#comments"
                        >
                          发表评论
                        </Link>
                      </div>
                    ) : null}

                    {post.tags.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1.5">
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
                ) : null}
              </div>
            </div>
          </article>
          </ArticleSection>

          {post.series && !post.series.deletedAt ? (
            <InViewReveal>
              <SeriesNav
                currentSlug={post.slug}
                posts={post.series.posts}
                series={{ title: post.series.title, slug: post.series.slug }}
              />
            </InViewReveal>
          ) : null}

          {!isDraftPreview && relatedPosts.length > 0 ? (
            <InViewReveal>
              <ArticleRelatedPosts posts={relatedPosts} />
            </InViewReveal>
          ) : null}

          {!isDraftPreview && settings.newsletter.enabled ? (
            <InViewReveal className="reader-panel w-full space-y-3 p-5 sm:p-6">
              <div className="space-y-1">
                <h2 className="reader-section-heading text-base">订阅后续文章</h2>
                <p className="text-xs leading-5 text-[var(--text-muted)]">
                  新内容发布后发送确认邮件，不会把未验证或已退订地址加入发送列表。
                </p>
              </div>
              <NewsletterForm />
            </InViewReveal>
          ) : null}

          {commentsPromise ? (
          <InViewReveal aria-labelledby="comments-heading" className="reader-panel w-full p-5 sm:p-7" id="comments">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="comments-heading" className="reader-section-heading text-base sm:text-lg">
                评论 ({post._count.comments})
              </h2>
              <p className="text-xs text-[var(--text-muted)]">欢迎理性讨论与补充勘误</p>
            </div>

            <CommentAuthGate postId={post.id} />

            <Suspense fallback={<CommentListSkeleton />}>
              <CommentList commentsPromise={commentsPromise} />
            </Suspense>
          </InViewReveal>
          ) : null}
        </div>

        <ArticleTocRail headings={headings} />
      </div>
    </div>
  );
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return renderArticlePage({ slug });
}
