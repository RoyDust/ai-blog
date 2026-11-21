import Link from "next/link";

import { Reveal, SectionHeading } from "@/components/editorial";

export interface TagDirectoryItem {
  id: string;
  name: string;
  slug: string;
  count: number;
}

interface TagDirectoryGroupProps {
  title: string;
  tags: TagDirectoryItem[];
  headingId: string;
  /** 区块标题右侧小字 */
  aside?: string;
  delay?: number;
}

/**
 * 标签目录的一组（简报 16.5）：区块标题 + 统一字号的 `#名称 计数` 文字行，
 * 标签之间留一个全角空格宽、自然换行；不用色条、不用 chip、不做大小不一的词云。
 */
export function TagDirectoryGroup({ title, tags, headingId, aside = "按文章数", delay = 0 }: TagDirectoryGroupProps) {
  return (
    <Reveal aria-labelledby={headingId} as="section" className="space-y-2" delay={delay}>
      <SectionHeading aside={<span>{aside}</span>} count={tags.length} id={headingId} title={title} />
      <ul className="flex flex-wrap gap-x-[1em] gap-y-1 pt-1 sm:gap-y-2">
        {tags.map((tag) => (
          <li key={tag.id}>
            <Link
              className="ed-tag inline-flex min-h-[1.875rem] items-baseline whitespace-nowrap py-1 text-[0.9375rem] text-[var(--text-body)] hover:text-[var(--foreground)] pointer-coarse:min-h-11 pointer-coarse:items-center"
              href={`/tags/${tag.slug}`}
            >
              #{tag.name}
              <span className="ed-mono ml-1 text-[0.75rem] text-[var(--text-muted)]">
                {tag.count}
                <span className="ed-visually-hidden"> 篇</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}
