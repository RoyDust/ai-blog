import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface TaxonomyDirectoryCardProps {
  href: string;
  name: string;
  description?: string | null;
  count: number;
  badge?: string;
  accent?: string | null;
}

export function TaxonomyDirectoryCard({ href, name, description, count, badge, accent }: TaxonomyDirectoryCardProps) {
  void accent;

  return (
    <article className="group reader-card flex h-full flex-col justify-between gap-3.5 p-5 transition-colors">
      <div className="space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            {badge ? <span className="text-xs font-medium text-[var(--text-muted)]">{badge}</span> : null}
            <Link
              href={href}
              className="text-90 block truncate text-lg font-bold leading-snug transition-colors group-hover:text-[var(--brand)]"
            >
              {name}
            </Link>
          </div>
          <span className="shrink-0 rounded-md bg-[var(--btn-regular-bg)] px-2.5 py-1 font-mono text-xs font-bold tabular-nums text-[var(--btn-content)]">
            {count} 篇
          </span>
        </div>

        <p className="text-75 line-clamp-2 text-sm leading-6">
          {description?.trim() || "围绕这个主题持续阅读，快速回顾相关文章与知识脉络。"}
        </p>
      </div>

      <div className="flex items-center justify-end pt-1">
        <Link href={href} className="reader-link inline-flex items-center gap-0.5 text-xs font-semibold">
          查看内容
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
