"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LayoutGroup, motion } from "motion/react";

interface TocHeading {
  id: string;
  text: string;
  level: 1 | 2 | 3;
}

interface ArticleTocProps {
  headings: TocHeading[];
}

export function ArticleToc({ headings }: ArticleTocProps) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "0px 0px -70% 0px", threshold: 0 },
    );

    for (const heading of headings) {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) {
    return <p className="text-sm leading-6 text-[var(--text-muted)]">当前文章暂无章节标题。</p>;
  }

  return (
    <LayoutGroup id="article-toc">
      <ul className="relative space-y-1 before:absolute before:left-1 before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-[var(--line-color)]">
        {headings.map((heading, index) => {
          const isActive = activeId === heading.id;
          return (
            <li className="relative" key={`${heading.id}-${index}`}>
              <Link
                className="reader-link group flex min-w-0 items-start gap-2 rounded-lg py-1 pr-2 text-[13px] leading-5 text-[var(--text-body)] hover:bg-[var(--btn-plain-bg-hover)]"
                href={`#${heading.id}`}
              >
                <span className="relative mt-1.5 flex h-2 w-2 shrink-0 items-center justify-center">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-faint)] transition-colors group-hover:bg-[var(--brand)]" />
                  {isActive && (
                    <motion.span
                      layoutId="toc-active-dot"
                      className="absolute inset-0 rounded-full bg-[var(--brand)]"
                      transition={{ type: "spring", visualDuration: 0.25, bounce: 0.15 }}
                    />
                  )}
                </span>
                <span
                  className={`min-w-0 break-words ${isActive ? "font-semibold text-[var(--brand)]" : ""}`}
                  style={{ paddingLeft: `${(heading.level - 1) * 12}px` }}
                >
                  {heading.text}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </LayoutGroup>
  );
}
