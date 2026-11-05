/**
 * 方向 A「编辑排版」基础组件（服务端可用，不含交互状态）。
 *
 * 样式全部来自 src/styles/editorial.css 的 .ed-* 类；这里只负责结构与无障碍语义，
 * 页面不要再自己拼区块标题、文字链接、印章和空态。
 */
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type LinkHref = ComponentProps<typeof Link>["href"];

/* ── 文字链接「… →」 ───────────────────────────────────────────── */

interface TextLinkProps extends Omit<ComponentProps<typeof Link>, "children"> {
  children: ReactNode;
  /** 箭头方向；none 不画箭头 */
  arrow?: "right" | "left" | "none" | "external";
  tone?: "default" | "danger";
  /** 置灰、不可点（如第 1 页的「← 上一页」） */
  disabled?: boolean;
}

export function TextLink({ children, arrow = "right", tone = "default", disabled = false, className, ...props }: TextLinkProps) {
  const content = (
    <>
      {arrow === "left" ? <ArrowGlyph direction="left" /> : null}
      <span>{children}</span>
      {arrow === "right" ? <ArrowGlyph direction="right" /> : null}
      {arrow === "external" ? <ArrowGlyph direction="external" /> : null}
    </>
  );

  if (disabled) {
    return (
      <span aria-disabled="true" className={cn("ed-link ed-link--muted", className)}>
        {content}
      </span>
    );
  }

  return (
    <Link className={cn("ed-link", tone === "danger" && "ed-link--danger", className)} {...props}>
      {content}
    </Link>
  );
}

/** 外链 / 非路由链接版本 */
export function TextAnchor({
  children,
  arrow = "right",
  className,
  ...props
}: ComponentProps<"a"> & { arrow?: "right" | "left" | "none" | "external" }) {
  return (
    <a className={cn("ed-link", className)} {...props}>
      {arrow === "left" ? <ArrowGlyph direction="left" /> : null}
      <span>{children}</span>
      {arrow === "right" ? <ArrowGlyph direction="right" /> : null}
      {arrow === "external" ? <ArrowGlyph direction="external" /> : null}
    </a>
  );
}

export function ArrowGlyph({ direction }: { direction: "right" | "left" | "external" }) {
  const glyph = direction === "right" ? "→" : direction === "left" ? "←" : "↗";
  return (
    <span
      aria-hidden="true"
      className={cn("ed-link__arrow", direction === "left" ? "ed-link__arrow--left" : "ed-link__arrow--right")}
    >
      {glyph}
    </span>
  );
}

/* ── 印章 ───────────────────────────────────────────────────────── */

export function Seal({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("ed-seal", className)}>{children}</span>;
}

/* ── 区块标题：衬线标题 + 横贯细线 + 右侧次级内容 ───────────────────── */

interface SectionHeadingProps {
  title: ReactNode;
  /** 标题后的等宽计数，如「文章 111」「评论 (2)」 */
  count?: ReactNode;
  /** 右侧：文字链接或小字 */
  aside?: ReactNode;
  as?: "h2" | "h3";
  id?: string;
  size?: "default" | "admin";
  className?: string;
}

export function SectionHeading({ title, count, aside, as: Tag = "h2", id, size = "default", className }: SectionHeadingProps) {
  return (
    <div className={cn("ed-section-head", size === "admin" && "ed-section-head--admin", className)}>
      <Tag id={id} className="ed-section-head__title">
        {title}
        {count !== undefined && count !== null ? (
          <span className="ed-mono ml-2 align-baseline text-[0.875rem] font-normal text-[var(--text-muted)]">{count}</span>
        ) : null}
      </Tag>
      <span aria-hidden="true" className="ed-section-head__line" />
      {aside ? <div className="flex shrink-0 items-center gap-4 text-[0.8125rem] text-[var(--text-muted)]">{aside}</div> : null}
    </div>
  );
}

/* ── 报头式页头：eyebrow + 衬线 h1 + 描述 + 等宽 meta + 右侧链接，2px 粗线收尾 ── */

interface MastheadProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  aside?: ReactNode;
  /** 粗线下方紧跟的内容（如已选筛选条件） */
  children?: ReactNode;
  className?: string;
  titleId?: string;
}

export function Masthead({ eyebrow, title, description, meta, aside, children, className, titleId }: MastheadProps) {
  return (
    <header className={cn("ed-masthead", className)}>
      <div className="flex flex-col gap-x-6 gap-y-4 pb-5 md:flex-row md:flex-wrap md:items-end md:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          {eyebrow ? <p className="ed-eyebrow">{eyebrow}</p> : null}
          <h1
            id={titleId}
            className="ed-serif text-balance text-[clamp(1.5rem,2.6vw,2rem)] leading-[1.15] text-[var(--foreground)]"
          >
            {title}
          </h1>
          {description ? (
            <p className="line-clamp-2 max-w-[42rem] text-[0.9375rem] leading-[1.7] text-[var(--text-body)]">{description}</p>
          ) : null}
          {meta ? <p className="ed-mono text-[0.8125rem] text-[var(--text-muted)]">{meta}</p> : null}
        </div>
        {aside ? <div className="flex flex-wrap items-center gap-x-5 gap-y-2 md:justify-end">{aside}</div> : null}
      </div>
      <hr className="ed-rule-strong" />
      {children}
    </header>
  );
}

/* ── 「名称 …… 篇数」点线目录行 ─────────────────────────────────── */

export function DottedRow({
  href,
  name,
  count,
  className,
  nameClassName,
}: {
  href: LinkHref;
  name: ReactNode;
  count: ReactNode;
  className?: string;
  nameClassName?: string;
}) {
  return (
    <Link href={href} className={cn("ed-dotted-row", className)}>
      <span className={cn("ed-dotted-row__name", nameClassName)}>{name}</span>
      <span aria-hidden="true" className="ed-dotted-row__dots" />
      <span className="ed-dotted-row__count">{count}</span>
    </Link>
  );
}

/* ── #标签 纯文字行 ─────────────────────────────────────────────── */

export function TagLine({
  tags,
  className,
  showCount = false,
}: {
  tags: Array<{ name: string; slug: string; count?: number }>;
  className?: string;
  showCount?: boolean;
}) {
  if (tags.length === 0) {
    return null;
  }

  return (
    <ul className={cn("flex flex-wrap gap-x-[1em] gap-y-1", className)}>
      {tags.map((tag) => (
        <li key={tag.slug}>
          <Link className="ed-tag inline-flex min-h-[1.875rem] items-center whitespace-nowrap" href={`/tags/${tag.slug}`}>
            #{tag.name}
            {showCount && typeof tag.count === "number" ? (
              <span className="ed-mono ml-1 text-[0.75rem] text-[var(--text-muted)]">{tag.count}</span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ── meta 行：用 · 连接，空项自动跳过 ──────────────────────────── */

/** 可带 className 的 meta 项：className 作用在「分隔符 + 内容」整体上（如 hidden sm:inline-flex） */
export type MetaItem = ReactNode | { node: ReactNode; className?: string; key?: string };

function isMetaObject(item: MetaItem): item is { node: ReactNode; className?: string; key?: string } {
  return typeof item === "object" && item !== null && !Array.isArray(item) && "node" in (item as object) && !("$$typeof" in (item as object));
}

export function MetaLine({
  items,
  className,
  prefix,
}: {
  items: MetaItem[];
  className?: string;
  /** 行首附加内容（自带分隔符），如手机上并入 meta 的日期 */
  prefix?: ReactNode;
}) {
  const visible = items.filter((item) => item !== null && item !== undefined && item !== false && item !== "");
  if (visible.length === 0 && !prefix) {
    return null;
  }

  return (
    <p className={cn("ed-meta flex flex-wrap items-baseline", className)}>
      {prefix}
      {visible.map((item, index) => {
        const entry = isMetaObject(item) ? item : { node: item };
        return (
          <span key={entry.key ?? index} className={cn("inline-flex items-baseline", entry.className)}>
            {index > 0 ? (
              <span aria-hidden="true" className="ed-meta-sep">
                ·
              </span>
            ) : null}
            {entry.node}
          </span>
        );
      })}
    </p>
  );
}

/* ── 空态 / 错误态：一句衬线文案 + 文字链接或描边按钮，左对齐无容器 ─── */

export function EmptyState({
  title,
  description,
  actions,
  tone = "default",
  className,
  role,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  tone?: "default" | "danger";
  className?: string;
  role?: "status" | "alert";
}) {
  return (
    <div className={cn("space-y-3 py-6", className)} role={role}>
      <p className={cn("ed-empty__title", tone === "danger" && "ed-empty__title--danger")}>{title}</p>
      {description ? <p className="text-[0.875rem] leading-6 text-[var(--text-muted)]">{description}</p> : null}
      {actions ? <div className="flex flex-wrap items-center gap-x-5 gap-y-2">{actions}</div> : null}
    </div>
  );
}

/* ── 页码：「← 上一页 · 第 2 / 6 页 · 下一页 →」 ────────────────────── */

export function EditorialPagination({
  page,
  totalPages,
  hrefForPage,
  className,
}: {
  page: number;
  totalPages: number;
  hrefForPage: (page: number) => LinkHref;
  className?: string;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav aria-label="分页" className={cn("ed-pagination", className)}>
      <TextLink arrow="left" disabled={!hasPrev} href={hasPrev ? hrefForPage(page - 1) : "#"} rel="prev">
        上一页
      </TextLink>
      <span aria-hidden="true" className="text-[var(--text-muted)]">
        ·
      </span>
      <span aria-current="page" className="text-[0.875rem] text-[var(--text-body)]">
        第 <span className="ed-mono text-[var(--foreground)]">{page}</span> /{" "}
        <span className="ed-mono">{totalPages}</span> 页
      </span>
      <span aria-hidden="true" className="text-[var(--text-muted)]">
        ·
      </span>
      <TextLink disabled={!hasNext} href={hasNext ? hrefForPage(page + 1) : "#"} rel="next">
        下一页
      </TextLink>
    </nav>
  );
}

/* ── 骨架 ───────────────────────────────────────────────────────── */

export function SkeletonBar({ className, strong = false }: { className?: string; strong?: boolean }) {
  return <span aria-hidden="true" className={cn("ed-skel", strong && "ed-skel--strong", className)} />;
}

/** 列表行骨架：与真实行同尺寸，行间照画 1px 细线 */
export function ListRowSkeleton({ count = 4, withDate = true, label = "正在加载文章" }: { count?: number; withDate?: boolean; label?: string }) {
  return (
    <div aria-busy="true">
      <span className="ed-visually-hidden" role="status">
        {label}
      </span>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} aria-hidden="true" className={cn("ed-row", !withDate && "ed-row--no-date")}>
          {withDate ? (
            <div className="ed-row__date--desktop space-y-1.5 pt-1">
              <SkeletonBar className="h-3 w-10" />
              <SkeletonBar className="h-3 w-12" />
            </div>
          ) : null}
          <div className="space-y-2.5 pt-0.5">
            <SkeletonBar strong className="h-[1.1rem] w-[min(72%,26rem)]" />
            <SkeletonBar className="h-3.5 w-full" />
            <SkeletonBar className="h-3.5 w-[86%]" />
            <SkeletonBar className="mt-1 h-3 w-40" />
          </div>
          <SkeletonBar className="aspect-[4/3] w-full rounded-[var(--radius-ctl)]" />
        </div>
      ))}
    </div>
  );
}
