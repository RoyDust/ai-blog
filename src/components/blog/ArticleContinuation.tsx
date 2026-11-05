import Link from 'next/link'

interface AdjacentPost {
  slug: string
  title: string
  createdAt?: string | Date
}

interface ArticleContinuationProps {
  previousPost: AdjacentPost | null
  nextPost: AdjacentPost | null
}

/**
 * 正文之后的「上一篇 / 下一篇」（简报 16.4）：两栏 + 中间 1px 竖线，上下各一条细线，不做卡片。
 * 手机上改为上下两行，都左对齐，行间 1px 细线。
 */
export function ArticleContinuation({ previousPost, nextPost }: ArticleContinuationProps) {
  if (!previousPost && !nextPost) return null

  return (
    <nav aria-label="上一篇与下一篇" className="article-adjacent">
      {previousPost ? (
        <Link className="article-adjacent__link" href={`/posts/${previousPost.slug}`} rel="prev">
          <span className="article-adjacent__label">
            <span aria-hidden="true">← </span>上一篇
          </span>
          <span className="article-adjacent__title">{previousPost.title}</span>
        </Link>
      ) : (
        <span aria-hidden="true" className="hidden sm:block" />
      )}
      <span aria-hidden="true" className={previousPost && nextPost ? 'article-adjacent__rule' : 'article-adjacent__rule hidden sm:block'} />
      {nextPost ? (
        <Link className="article-adjacent__link article-adjacent__link--next" href={`/posts/${nextPost.slug}`} rel="next">
          <span className="article-adjacent__label">
            下一篇<span aria-hidden="true"> →</span>
          </span>
          <span className="article-adjacent__title">{nextPost.title}</span>
        </Link>
      ) : (
        <span aria-hidden="true" className="hidden sm:block" />
      )}
    </nav>
  )
}
