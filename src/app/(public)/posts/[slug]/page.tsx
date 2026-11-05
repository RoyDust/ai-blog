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
import { Suspense, isValidElement, use, type ComponentProps, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { notFound } from "next/navigation";
import { ArticleContinuation, ArticleHero, ArticleReadTracker, ArticleRelatedPosts, ArticleSection, ArticleTocDrawer, ArticleTocRail, BackToTopButton, BookmarkButton, CommentJumpLink, CopyCodeButton, LikeButton, NewsletterForm, ReadingProgress, SeriesNav, ShareButton } from "@/components/blog";
import { Reveal, Seal, SectionHeading, SkeletonBar, StaggerItem, StaggerList, TagLine } from "@/components/editorial";
import { CommentAuthGate } from "@/components/CommentAuthGate";
import { CommentReply } from "@/components/CommentReply";
import { FallbackImage } from "@/components/ui";
import { getBlogSettings } from "@/lib/blog-settings";
import { prisma } from "@/lib/prisma";
import { getRecommendedPostsForPost } from "@/lib/recommendations";
import { stripLeadingTitleHeading } from "@/lib/article-content";
import { formatIsoDate } from "@/lib/editorial-format";
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

const CODE_LANGUAGE_LABELS: Record<string, string> = {
  bash: 'Shell',
  c: 'C',
  cpp: 'C++',
  css: 'CSS',
  diff: 'Diff',
  dockerfile: 'Dockerfile',
  go: 'Go',
  graphql: 'GraphQL',
  html: 'HTML',
  java: 'Java',
  javascript: 'JavaScript',
  js: 'JavaScript',
  json: 'JSON',
  jsx: 'JSX',
  kotlin: 'Kotlin',
  markdown: 'Markdown',
  md: 'Markdown',
  prisma: 'Prisma',
  py: 'Python',
  python: 'Python',
  rs: 'Rust',
  rust: 'Rust',
  scss: 'SCSS',
  sh: 'Shell',
  shell: 'Shell',
  sql: 'SQL',
  swift: 'Swift',
  ts: 'TypeScript',
  tsx: 'TSX',
  typescript: 'TypeScript',
  xml: 'XML',
  yaml: 'YAML',
  yml: 'YAML',
  zsh: 'Shell',
}

/** 从 <pre><code class="language-xx"> 里取出代码块左上角显示的语言名 */
function getCodeLanguage(children: ReactNode) {
  const child = Array.isArray(children) ? children[0] : children
  const className = isValidElement<{ className?: string }>(child) ? child.props.className ?? '' : ''
  const language = /(?:^|\s)language-([\w+#-]+)/.exec(className)?.[1]?.toLowerCase()
  if (!language || language === 'text' || language === 'plaintext') return null

  return CODE_LANGUAGE_LABELS[language] ?? language
}

function CommentAvatar({ name, image }: { name: string; image?: string | null }) {
  return (
    <span aria-hidden="true" className="article-comment__avatar">
      {image ? (
        <FallbackImage alt="" className="h-full w-full object-cover" height={32} src={image} width={32} />
      ) : (
        name.slice(0, 1)
      )}
    </span>
  )
}

function CommentItem({
  comment,
  postId,
  postAuthorId,
  replyParentId,
}: {
  comment: ArticleComment | ArticleReply
  postId: string
  postAuthorId: string
  replyParentId: string
}) {
  const label = getCommentLabel(comment)
  const isPostAuthor = Boolean(comment.author?.id && comment.author.id === postAuthorId)

  return (
    <article className="article-comment__item">
      <CommentAvatar image={comment.author?.image} name={label} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <header className="article-comment__head">
          <span className="article-comment__name">{label}</span>
          {isPostAuthor ? <Seal>作者</Seal> : null}
          <time className="article-comment__date" dateTime={new Date(comment.createdAt).toISOString()}>
            {formatIsoDate(comment.createdAt)}
          </time>
        </header>
        <p className="article-comment__body">{comment.content}</p>
        <CommentReply authorLabel={label} parentId={replyParentId} postId={postId} />
      </div>
    </article>
  )
}

function CommentListSkeleton() {
  return (
    <div aria-busy="true">
      <span className="ed-visually-hidden" role="status">评论加载中</span>
      <ol aria-hidden="true" className="article-comments__list">
        {['w-[86%]', 'w-[78%]', 'w-[90%]'].map((width, item) => (
          <li className="article-comment" key={item}>
            <div className="article-comment__item">
              <SkeletonBar className="h-8 w-8 rounded-full" />
              <div className="space-y-2.5">
                <div className="flex min-h-8 items-center gap-2">
                  <SkeletonBar className="h-3.5 w-14" />
                  <SkeletonBar className="h-3 w-20" />
                </div>
                <SkeletonBar className={`h-3.5 ${width}`} />
                <SkeletonBar className="h-3.5 w-1/2" />
                <div className="flex min-h-11 items-center">
                  <SkeletonBar className="h-3 w-8" />
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

type CommentsPromise = Promise<Awaited<ReturnType<typeof getPostComments>>>

function CommentsHeading({ count }: { count: ReactNode }) {
  return (
    <SectionHeading
      aside={<span className="hidden sm:inline">友善讨论，审核后公开</span>}
      count={count}
      id="comments-heading"
      title="评论"
    />
  )
}

function ResolvedCommentsHeading({ commentsPromise, count }: { commentsPromise: CommentsPromise; count: number }) {
  use(commentsPromise)

  return <CommentsHeading count={`(${count})`} />
}

function CommentList({
  commentsPromise,
  postId,
  postAuthorId,
}: {
  commentsPromise: CommentsPromise
  postId: string
  postAuthorId: string
}) {
  const comments = use(commentsPromise)

  if (comments.length === 0) {
    return (
      <div className="border-t border-[var(--border)] pt-5">
        <p className="ed-empty__title">还没有评论，来说第一句。</p>
      </div>
    )
  }

  return (
    <StaggerList as="ol" className="article-comments__list" inView>
      {comments.map((comment: ArticleComment) => (
        <StaggerItem as="li" className="article-comment" key={comment.id}>
          <CommentItem comment={comment} postAuthorId={postAuthorId} postId={postId} replyParentId={comment.id} />
          {comment.replies.length > 0 ? (
            <ol className="article-comment__replies">
              {comment.replies.map((reply: ArticleReply) => (
                <li key={reply.id}>
                  <CommentItem comment={reply} postAuthorId={postAuthorId} postId={postId} replyParentId={comment.id} />
                </li>
              ))}
            </ol>
          ) : null}
        </StaggerItem>
      ))}
    </StaggerList>
  )
}

/** 连载条与文末「上一篇 / 下一篇」用的系列邻居；已软删除的系列不显示 */
function getSeriesNeighbors(post: ArticlePost) {
  const series = post.series && !post.series.deletedAt ? post.series : null
  const index = series ? series.posts.findIndex((item) => item.slug === post.slug) : -1

  return {
    series,
    previousInSeries: series && index > 0 ? series.posts[index - 1] : null,
    nextInSeries: series && index >= 0 && index < series.posts.length - 1 ? series.posts[index + 1] : null,
  }
}

/** react-markdown 会把 hast 节点作为 node 传给自定义组件，透传到 DOM 前去掉 */
function withoutNode<T extends { node?: unknown }>(props: T): Omit<T, 'node'> {
  const rest = { ...props }
  delete rest.node
  return rest
}

type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5'

/**
 * 正文 Markdown 渲染：标题带锚点 id 与 hover「#」；图片带图注；代码块左上语言名、右上复制按钮、块内横向滚动；
 * 表格包一层横向滚动容器。
 */
function buildMarkdownComponents(getHeadingId: (children: ReactNode) => string): Components {
  const heading = (Tag: HeadingTag) => {
    function MarkdownHeading({ children, ...props }: ComponentProps<'h2'> & { node?: unknown }) {
      const id = getHeadingId(children)
      return (
        <Tag id={id} {...withoutNode(props)}>
          <a aria-hidden="true" className="article-heading-anchor" href={`#${id}`} tabIndex={-1}>
            #
          </a>
          {children}
        </Tag>
      )
    }

    return MarkdownHeading
  }

  return {
    h1: heading('h1'),
    h2: heading('h2'),
    h3: heading('h3'),
    h4: heading('h4'),
    h5: heading('h5'),
    img: ({ src, alt, title }) => {
      const imageSrc = typeof src === 'string' ? src : null
      if (!imageSrc) return null

      return (
        <span className="article-figure-wrap block">
          <span className="article-figure">
            <FallbackImage alt={alt ?? ''} height={900} src={imageSrc} unoptimized width={1600} />
          </span>
          {title ? <span className="article-figure__caption">{title}</span> : null}
        </span>
      )
    },
    pre: ({ children, ...props }) => {
      const code = nodeText(children).replace(/\n$/, '')
      const language = getCodeLanguage(children)

      return (
        <div className="article-code">
          <div className="article-code__bar">
            <span className="article-code__lang">{language ?? ''}</span>
            <CopyCodeButton code={code} />
          </div>
          <pre {...withoutNode(props)} tabIndex={0}>
            {children}
          </pre>
        </div>
      )
    },
    table: ({ children, ...props }) => (
      <div className="article-table">
        <table {...withoutNode(props)}>{children}</table>
      </div>
    ),
  }
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
  const settings = await getBlogSettings()

  return renderArticleView({ post, isDraftPreview, relatedPosts, commentsPromise, settings })
}

type ArticleViewData = {
  post: ArticlePost
  isDraftPreview: boolean
  relatedPosts: Awaited<ReturnType<typeof getRecommendedPostsForPost>>
  commentsPromise: CommentsPromise | null
  settings: Awaited<ReturnType<typeof getBlogSettings>>
}

/** 纯渲染：拿到已装配好的数据后拼出整页（便于单独预览与测试） */
export function renderArticleView({ post, isDraftPreview, relatedPosts, commentsPromise, settings }: ArticleViewData) {
  const articleContent = stripLeadingTitleHeading(post.content, post.title)
  const headings = extractHeadings(articleContent);
  const renderedHeadingCounters = new Map<string, number>()
  const getRenderedHeadingId = (children: ReactNode) => getUniqueHeadingId(nodeText(children), renderedHeadingCounters)
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

  const { series, previousInSeries, nextInSeries } = getSeriesNeighbors(post)

  const markdownComponents = buildMarkdownComponents(getRenderedHeadingId)

  return (
    <div className="article-detail-page relative overflow-x-clip pb-4">
      {isDraftPreview ? null : <JsonLd data={[articleJsonLd, breadcrumbJsonLd]} />}
      {isDraftPreview ? null : <ArticleReadTracker postId={post.id} />}
      <ReadingProgress />
      <BackToTopButton />
      <ArticleTocDrawer headings={headings} />

      {isDraftPreview ? (
        <div className="ed-banner ed-banner--warning mb-6" role="status">
          草稿预览仅后台管理员可见，公开阅读、点赞、收藏、评论和阅读统计已停用。
        </div>
      ) : null}

      <div className="article-layout" data-testid="article-layout">
        <div className="article-column space-y-9">
          <ArticleSection animate="visible" initial="hidden" aria-label="文章">
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

            {series ? (
              <div className="mt-5">
                <SeriesNav
                  currentSlug={post.slug}
                  posts={series.posts}
                  series={{ title: series.title, slug: series.slug }}
                />
              </div>
            ) : null}

            <article className="article-prose reader-prose mt-8">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={markdownComponents}
              >
                {articleContent}
              </ReactMarkdown>
            </article>

            {post.tags.length > 0 ? (
              <div className="mt-8 border-t border-[var(--border)] pt-6">
                <TagLine className="[&_a]:min-h-11 sm:[&_a]:min-h-[1.875rem]" tags={post.tags} />
              </div>
            ) : null}
          </ArticleSection>

          {previousInSeries || nextInSeries ? (
            <Reveal>
              <ArticleContinuation nextPost={nextInSeries} previousPost={previousInSeries} />
            </Reveal>
          ) : null}

          {!isDraftPreview && relatedPosts.length > 0 ? (
            <Reveal>
              <ArticleRelatedPosts posts={relatedPosts} />
            </Reveal>
          ) : null}

          {isDraftPreview ? null : (
            <Reveal>
              <section aria-label="文末操作" className="article-actions">
                <LikeButton initialCount={post._count.likes} initialLiked={false} slug={post.slug} />
                <BookmarkButton excerpt={post.excerpt} initialBookmarked={false} slug={post.slug} title={post.title} />
                <ShareButton
                  authorName={post.author.name || settings.siteName}
                  slug={post.slug}
                  sourceName={settings.siteName}
                  title={post.title}
                />
                <span className="flex-1" />
                <CommentJumpLink />
              </section>
            </Reveal>
          )}

          {!isDraftPreview && settings.newsletter.enabled ? (
            <Reveal>
              <NewsletterForm buttonVariant="outline" />
            </Reveal>
          ) : null}

          {commentsPromise ? (
            <section aria-labelledby="comments-heading" className="scroll-mt-24 space-y-4" id="comments">
              <Suspense fallback={<CommentsHeading count="(…)" />}>
                <ResolvedCommentsHeading commentsPromise={commentsPromise} count={post._count.comments} />
              </Suspense>

              <CommentAuthGate postId={post.id} />

              <Suspense fallback={<CommentListSkeleton />}>
                <CommentList commentsPromise={commentsPromise} postAuthorId={post.author.id} postId={post.id} />
              </Suspense>
            </section>
          ) : null}
        </div>

        <span aria-hidden="true" className="article-layout__rule" />

        <ArticleTocRail headings={headings} />
      </div>
    </div>
  );
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return renderArticlePage({ slug });
}
