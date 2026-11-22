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

  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-2",
        variant === "default" && "text-50 text-xs",
        variant === "reader" && "text-xs text-[var(--text-muted)]",
        variant === "compact" && "text-xs text-[var(--text-muted)]",
        className,
      )}
    >
      <span className={cn("inline-flex items-center gap-1.5 font-mono tabular-nums", isReaderVariant && "text-[var(--text-muted)]")}>
        {variant === "reader" ? <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" /> : null}
        {dateFormatter.format(new Date(publishedAt))}
      </span>
      {category ? (
        <Link
          className={cn(chipClassName, variant === "compact" && "rounded-md px-2 py-0.5 text-[0.7rem]")}
          href={`/categories/${category.slug}`}
        >
          {category.name}
        </Link>
      ) : null}
      {!hideUpdateDate && updatedAt ? (
        <span className="font-mono tabular-nums text-[var(--text-faint)]">更新于 {dateFormatter.format(new Date(updatedAt))}</span>
      ) : null}
      {tags.length > 0 ? (
        <span
          className={cn(
            hideTagsForMobile ? "hidden md:inline-flex" : "inline-flex",
            "flex-wrap items-center gap-1 text-[0.72rem] text-[var(--text-muted)]",
          )}
        >
          {tags.map((tag, index) => (
            <span key={tag.slug} className="inline-flex items-center gap-1">
              {index > 0 ? (
                <span aria-hidden="true" className="text-[var(--text-faint)]">
                  /
                </span>
              ) : null}
              <Link
                className="rounded px-1 py-0.5 transition-colors hover:bg-[var(--btn-regular-bg)] hover:text-[var(--btn-content)]"
                href={`/tags/${tag.slug}`}
              >
                #{tag.name}
              </Link>
            </span>
          ))}
        </span>
      ) : null}
    </div>
  );
}
