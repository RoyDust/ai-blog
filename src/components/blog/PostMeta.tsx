import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/cn";

interface PostMetaProps {
  publishedAt: string | Date;
  updatedAt?: string | Date;
  category?: { name: string; slug: string } | null;
  tags?: Array<{ name: string; slug: string }>;
  hideTagsForMobile?: boolean;
  hideUpdateDate?: boolean;
  variant?: "default" | "reader" | "compact";
  className?: string;
}

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function PostMeta({
  publishedAt,
  updatedAt,
  category,
  tags = [],
  hideTagsForMobile = false,
  hideUpdateDate = true,
  variant = "default",
  className = "",
}: PostMetaProps) {
  const isReaderVariant = variant === "reader" || variant === "compact";
  const chipClassName = variant === "default" ? "ui-chip" : "reader-chip";
  const tagClassName = cn(
    hideTagsForMobile ? "hidden md:inline-flex" : "inline-flex",
    chipClassName,
    variant === "compact" && "px-2 py-1 text-[0.68rem]",
  );

  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-2",
        variant === "default" && "text-50 text-xs",
        variant === "reader" && "text-xs text-[var(--text-muted)]",
        variant === "compact" && "text-[0.7rem] text-[var(--text-faint)]",
        className,
      )}
    >
      {category ? (
        <Link
          className={cn(chipClassName, variant === "compact" && "px-2 py-1 text-[0.68rem]")}
          href={`/categories/${category.slug}`}
        >
          {category.name}
        </Link>
      ) : null}
      <span className={cn("inline-flex items-center gap-1.5", isReaderVariant && "text-[var(--text-faint)]")}>
        {isReaderVariant ? <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" /> : null}
        {dateFormatter.format(new Date(publishedAt))}
      </span>
      {!hideUpdateDate && updatedAt ? (
        <span className="text-[var(--text-faint)]">更新于 {dateFormatter.format(new Date(updatedAt))}</span>
      ) : null}
      {tags.map((tag) => (
        <Link
          key={tag.slug}
          className={tagClassName}
          href={`/tags/${tag.slug}`}
        >
          #{tag.name}
        </Link>
      ))}
    </div>
  );
}
