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
    return <p className="text-75 text-sm">当前文章暂无章节标题。</p>;
  }

  return (
    <ul className="space-y-2">
      {headings.map((heading) => (
        <li key={heading.id}>
          <Link
            className="text-75 block text-sm transition-colors hover:text-[var(--primary)]"
            href={`#${heading.id}`}
            style={{ paddingLeft: `${(heading.level - 1) * 12}px` }}
          >
            {heading.text}
          </Link>
        </li>
      ))}
    </ul>
  );
}
