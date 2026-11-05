import Link from "next/link";

import { MetaLine, Seal, TextLink } from "@/components/editorial";
import { FallbackImage } from "@/components/ui";
import { formatIsoDate } from "@/lib/editorial-format";
import { shimmerBlurDataURL } from "@/lib/image-placeholder";
import { getPostViewTransitionName } from "@/lib/view-transition";
import type { PostCardPost } from "./PostCard";

const READER_CARD_FALLBACK_SRC = "/images/fuwari-post-cover-fallback.svg";

/**
 * `/posts` 置顶精选（简报 16.3）：结构同首页精选。
 * 印章「精选」+ 分类名、衬线标题（列表置顶精选尺度）、2 行摘要、meta、「阅读全文 →」，右侧 16rem 4:3 封面；下方 1px 细线。
 */
export function PostCardFeatured({ post }: { post: PostCardPost }) {
  const href = `/posts/${post.slug}`;

  return (
    <article className="ed-media-hover grid gap-5 border-b border-[var(--border)] py-6 md:grid-cols-[minmax(0,1fr)_16rem] md:gap-8" data-testid="post-featured">
      <div className="flex min-w-0 flex-col">
        <p className="flex items-center gap-2.5">
          <Seal>精选</Seal>
          {post.category ? (
            <Link className="ed-tag text-[0.8125rem]" href={`/categories/${post.category.slug}`}>
              {post.category.name}
            </Link>
          ) : null}
        </p>
        <h2
          className="ed-serif mt-3 line-clamp-2 text-balance text-[clamp(1.375rem,2.4vw,1.75rem)] leading-[1.25] text-[var(--foreground)]"
          style={{ viewTransitionName: getPostViewTransitionName("title", post.slug) }}
        >
          <Link className="underline decoration-transparent decoration-1 underline-offset-[6px] transition-[text-decoration-color] duration-200 hover:decoration-[var(--reader-border-strong)]" href={href}>
            {post.title}
          </Link>
        </h2>
        {post.excerpt ? <p className="mt-3 line-clamp-2 text-[0.9375rem] leading-[1.7] text-[var(--text-body)]">{post.excerpt}</p> : null}
        <MetaLine
          className="mt-3"
          items={[
            <span key="date" className="ed-mono">{formatIsoDate(post.createdAt)}</span>,
            post.readingTimeMinutes ? <span key="minutes" className="ed-mono">{post.readingTimeMinutes} 分钟</span> : null,
          ]}
        />
        <div className="mt-auto pt-5">
          <TextLink href={href} aria-label={`阅读全文：${post.title}`}>
            阅读全文
          </TextLink>
        </div>
      </div>

      {post.coverImage ? (
        <Link
          aria-hidden="true"
          tabIndex={-1}
          href={href}
          className="ed-media block h-48 md:aspect-[4/3] md:h-auto md:self-start"
          style={{ viewTransitionName: getPostViewTransitionName("cover", post.slug) }}
        >
          <FallbackImage
            alt=""
            blurDataURL={shimmerBlurDataURL}
            className="object-cover"
            fallbackSrc={READER_CARD_FALLBACK_SRC}
            fill
            placeholder="blur"
            quality={75}
            sizes="(max-width: 767px) 100vw, 16rem"
            src={post.coverImage}
          />
        </Link>
      ) : null}
    </article>
  );
}
