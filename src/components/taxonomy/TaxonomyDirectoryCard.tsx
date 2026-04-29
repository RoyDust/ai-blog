import Link from "next/link";
import { ArrowRight, BookOpenText, Hash } from "lucide-react";

interface TaxonomyDirectoryCardProps {
  href: string;
  name: string;
  description?: string | null;
  count: number;
  badge?: string;
  accent?: string | null;
}

export function TaxonomyDirectoryCard({ href, name, description, count, badge, accent }: TaxonomyDirectoryCardProps) {
  const isTag = name.trim().startsWith("#");
  const Icon = isTag ? Hash : BookOpenText;

  return (
    <article className="group reader-card overflow-hidden p-5 transition hover:-translate-y-0.5 md:p-6">
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1 opacity-85"
        style={{ background: accent ?? "linear-gradient(90deg, var(--accent-warm), var(--accent-cyan))" }}
      />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {badge ? <span className="reader-chip">{badge}</span> : null}
            <span className="text-50 inline-flex items-center gap-1.5 text-xs">
              <Icon className="h-3.5 w-3.5" />
              阅读路径
            </span>
          </div>

          <div>
            <Link href={href} className="text-90 block text-2xl font-black leading-tight transition group-hover:text-[var(--accent-warm)]">
              {name}
            </Link>
            <p className="text-75 mt-3 max-w-2xl text-sm leading-7">
              {description?.trim() || "围绕这个主题持续阅读、快速回顾相关文章与知识脉络。"}
            </p>
          </div>
        </div>

        <div className="shrink-0 rounded-2xl border border-[var(--reader-border)] bg-[color:color-mix(in_oklab,var(--reader-panel-elevated)_76%,transparent)] px-3 py-2 text-right">
          <div className="text-90 text-lg font-bold">{count}</div>
          <div className="text-50 text-xs">篇文章</div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-dashed border-[var(--reader-border)] pt-4 text-sm">
        <span className="text-50">进入专题页继续浏览</span>
        <Link href={href} className="reader-link inline-flex items-center gap-1 font-semibold">
          查看内容
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </Link>
      </div>
    </article>
  );
}
