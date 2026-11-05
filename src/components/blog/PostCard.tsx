import Link from "next/link";
import { MetaLine } from "@/components/editorial";
import { FallbackImage } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatIndex, formatIsoDate, formatMonthDay, formatYear } from "@/lib/editorial-format";
import { shimmerBlurDataURL } from "@/lib/image-placeholder";
import { getPostViewTransitionName } from "@/lib/view-transition";

const READER_CARD_FALLBACK_SRC = "/images/fuwari-post-cover-fallback.svg";

export interface PostCardPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  coverImage?: string | null;
  featured?: boolean;
  createdAt: string | Date;
  readingTimeMinutes?: number | null;
  author?: {
    id: string;
    name: string | null;
    image: string | null;
  };
  category?: {
    name: string;
    slug: string;
  } | null;
  tags: Array<{
    name: string;
    slug: string;
  }>;
  _count?: {
    comments: number;
    likes: number;
  };
  viewCount?: number;
}

interface PostCardProps {
  post: PostCardPost;
  /**
   * 左列写法：
   * - stacked：两行「2026 / 10-18」（首页以外的默认）
   * - short：单行「10-18」（首页最新文章）
   * - index：两位等宽序号（系列详情、专题导读），日期并入 meta
   */
  dateStyle?: "stacked" | "short" | "index";
  /** dateStyle="index" 时的序号（从 1 开始） */
  index?: number;
  /** meta 里省略分类（分类详情页）或标签（标签详情页） */
  hideCategory?: boolean;
  hideTag?: boolean;
  /** 精选文章在 meta 开头写「精选」二字 */
  showFeaturedLabel?: boolean;
  /** 标题层级，列表区块里默认 h3 */
  headingLevel?: "h2" | "h3";
  className?: string;
}

/**
 * 方向 A 列表行：全站唯一的文章列表组件（简报 16.1）。
 *
 * 左列等宽日期（或序号）、中列衬线标题 + 摘要 + meta、右列 7.5rem 4:3 缩略图；
 * 无封面时右列留空、不画占位块。整行可点（标题链接用伪元素铺满整行），
 * meta 里的分类 / 标签仍可单独点击。
 */
export function PostCard({
  post,
  dateStyle = "stacked",
  index,
  hideCategory = false,
  hideTag = false,
  showFeaturedLabel = true,
  headingLevel = "h3",
  className,
}: PostCardProps) {
  const hasCover = Boolean(post.coverImage);
  const href = `/posts/${post.slug}`;
  const Heading = headingLevel;
  const firstTag = post.tags[0];
  const minutes = post.readingTimeMinutes;
  const isIndexed = dateStyle === "index";

  const metaItems = [
    showFeaturedLabel && post.featured ? (
      <span key="featured" className="font-bold text-[var(--text-muted)]">
        精选
      </span>
    ) : null,
    isIndexed ? <span className="ed-mono">{formatIsoDate(post.createdAt)}</span> : null,
    !isIndexed ? <span className="ed-mono sm:hidden">{dateStyle === "short" ? formatMonthDay(post.createdAt) : formatIsoDate(post.createdAt)}</span> : null,
    !hideCategory && post.category ? (
      <Link className="ed-tag text-[0.75rem]" href={`/categories/${post.category.slug}`}>
        {post.category.name}
      </Link>
    ) : null,
    !hideTag && firstTag ? (
      <Link className="ed-tag hidden text-[0.75rem] sm:inline" href={`/tags/${firstTag.slug}`}>
        #{firstTag.name}
      </Link>
    ) : null,
    typeof minutes === "number" && minutes > 0 ? <span className="ed-mono">{minutes} 分钟</span> : null,
  ];

  return (
    <article className={cn("ed-row group", className)} data-testid="post-list-row">
      <div className={cn(isIndexed ? "ed-row__index" : "ed-row__date ed-row__date--desktop", isIndexed && "max-sm:hidden")}>
        {isIndexed ? (
          formatIndex(index ?? 1)
        ) : dateStyle === "short" ? (
          <time dateTime={formatIsoDate(post.createdAt)}>{formatMonthDay(post.createdAt)}</time>
        ) : (
          <time className="flex flex-col" dateTime={formatIsoDate(post.createdAt)}>
            <span>{formatYear(post.createdAt)}</span>
            <span>{formatMonthDay(post.createdAt)}</span>
          </time>
        )}
      </div>

      <div className="min-w-0">
        <Heading className="ed-row__title line-clamp-2" style={{ viewTransitionName: getPostViewTransitionName("title", post.slug) }}>
          <Link className="ed-row__link" href={href}>
            {post.title}
          </Link>
        </Heading>
        {post.excerpt ? <p className="ed-row__excerpt ed-row__excerpt--desktop line-clamp-2">{post.excerpt}</p> : null}
        <MetaLine className="ed-row__meta" items={metaItems} />
      </div>

      {hasCover ? (
        <div
          className="ed-row__thumb"
          style={{ viewTransitionName: getPostViewTransitionName("cover", post.slug) }}
        >
          <FallbackImage
            alt=""
            aria-hidden="true"
            className="object-cover"
            fill
            loading="lazy"
            placeholder="blur"
            blurDataURL={shimmerBlurDataURL}
            quality={70}
            sizes="(max-width: 640px) 6.5rem, 7.5rem"
            src={post.coverImage!}
            fallbackSrc={READER_CARD_FALLBACK_SRC}
          />
        </div>
      ) : (
        <div aria-hidden="true" />
      )}
    </article>
  );
}
