import Link from "next/link";

interface TocHeading {
  id: string;
  text: string;
  level: 1 | 2 | 3;
}

interface ArticleTocProps {
  headings: TocHeading[];
}

export function ArticleToc({ headings }: ArticleTocProps) {
  if (headings.length === 0) {
    return <p className="text-sm leading-6 text-[var(--text-muted)]">当前文章暂无章节标题。</p>;
  }

  return (
    <ul className="relative space-y-1.5 before:absolute before:left-1.5 before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-[var(--reader-border)]">
      {headings.map((heading) => (
        <li className="relative" key={heading.id}>
          <Link
            className="reader-link group flex min-w-0 items-start gap-2 rounded-xl py-1.5 pr-2 text-sm leading-6 text-[var(--text-body)] hover:bg-[color-mix(in_oklab,var(--reader-panel-elevated)_72%,transparent)]"
            href={`#${heading.id}`}
            style={{ paddingLeft: `${(heading.level - 1) * 12}px` }}
          >
            <span className="mt-2 h-2 w-2 shrink-0 rounded-full border border-[var(--accent-sky)] bg-[var(--reader-panel-elevated)] transition-colors group-hover:bg-[var(--accent-warm)]" />
            <span className="min-w-0 break-words">{heading.text}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
