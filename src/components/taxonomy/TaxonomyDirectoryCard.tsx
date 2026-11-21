import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { FallbackImage } from "@/components/ui";
import { cn } from "@/lib/cn";

/**
 * 目录项外壳：整项可点（标题链接用 .ed-row__link 的伪元素铺满整项），
 * hover 时 foreground 4% 底 + 标题下划线，底部 1px 细线（同一行两项等高、细线对齐）。
 */
export const directoryItemClassName =
  "group relative isolate h-full border-b border-[var(--border)] py-5 " +
  "before:pointer-events-none before:absolute before:inset-y-0 before:-inset-x-3 before:-z-10 before:rounded-[var(--radius-ctl)] " +
  "before:bg-[var(--ed-hover-bg)] before:opacity-0 before:transition-opacity before:duration-200 " +
  "hover:before:opacity-100 focus-within:before:opacity-100 max-sm:before:-inset-x-2";

const directoryTitleLinkClassName =
  "ed-row__link underline decoration-transparent decoration-1 underline-offset-4 transition-[text-decoration-color] duration-200 group-hover:decoration-[var(--reader-border-strong)]";

/* ── 分类目录项：「名称 …… N 篇」点线行 + 2 行描述 ───────────────────── */

interface TaxonomyDirectoryCardProps {
  href: string;
  name: string;
  description?: string | null;
  count: number;
}

export function TaxonomyDirectoryCard({ href, name, description, count }: TaxonomyDirectoryCardProps) {
  return (
    <article className={directoryItemClassName}>
      <div className="flex min-h-11 items-baseline gap-2 sm:min-h-0">
        <h2 className="ed-serif min-w-0 truncate text-[1.125rem] leading-[1.4] text-[var(--foreground)]">
          <Link className={directoryTitleLinkClassName} href={href}>
            {name}
          </Link>
        </h2>
        <span
          aria-hidden="true"
          className="ed-dotted-row__dots transition-colors duration-200 group-hover:border-[var(--text-muted)]"
        />
        <span className="ed-dotted-row__count">{count} 篇</span>
      </div>
      {description?.trim() ? (
        <p className="mt-1.5 line-clamp-2 text-[0.9375rem] leading-[1.7] text-[var(--text-muted)]">{description}</p>
      ) : null}
    </article>
  );
}

/* ── 系列 / 专题目录项：可选 16:9 封面 + 衬线标题 + 描述 + 等宽 meta ───────── */

interface TaxonomyEntryProps {
  href: string;
  title: string;
  description?: string | null;
  /** 描述最多几行：系列 2 行，专题 3 行 */
  descriptionLines?: 2 | 3;
  meta: ReactNode;
  /** meta 放在标题上方（专题）还是描述下方（系列） */
  metaPosition?: "top" | "bottom";
  /** 无封面时不画色块，只排文字 */
  coverImage?: string | null;
  coverStyle?: CSSProperties;
  titleStyle?: CSSProperties;
}

export function TaxonomyEntry({
  href,
  title,
  description,
  descriptionLines = 2,
  meta,
  metaPosition = "bottom",
  coverImage,
  coverStyle,
  titleStyle,
}: TaxonomyEntryProps) {
  const metaNode = <div className="ed-meta ed-mono text-[0.75rem]">{meta}</div>;

  return (
    <article className={cn(directoryItemClassName, "ed-media-hover flex flex-col")}>
      {coverImage ? (
        <div className="ed-media relative mb-4 aspect-video" style={coverStyle}>
          <FallbackImage
            alt=""
            aria-hidden="true"
            className="object-cover"
            fill
            loading="lazy"
            quality={72}
            sizes="(max-width: 768px) 100vw, 360px"
            src={coverImage}
          />
        </div>
      ) : null}
      {metaPosition === "top" ? <div className="mb-2">{metaNode}</div> : null}
      <h2 className="ed-serif text-[1.125rem] leading-[1.4] text-[var(--foreground)]" style={titleStyle}>
        <Link className={directoryTitleLinkClassName} href={href}>
          {title}
        </Link>
      </h2>
      {description?.trim() ? (
        <p
          className={cn(
            "mt-2 text-[0.9375rem] leading-[1.7] text-[var(--text-muted)]",
            descriptionLines === 3 ? "line-clamp-3" : "line-clamp-2",
          )}
        >
          {description}
        </p>
      ) : null}
      {metaPosition === "bottom" ? <div className="mt-2.5">{metaNode}</div> : null}
    </article>
  );
}
