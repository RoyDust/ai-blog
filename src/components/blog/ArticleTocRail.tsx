"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { SkeletonBar, editorialEase } from "@/components/editorial";
import { ArticleToc, type TocHeading } from "./ArticleToc";

interface ArticleTocRailProps {
  headings: TocHeading[];
}

const tocFadeTransition = {
  duration: 0.42,
  ease: editorialEase,
};

const skeletonRows = ["w-11/12", "w-4/5", "w-3/4", "w-2/3"];

/**
 * 纸面第三栏：sticky 目录栏（简报 16.4）。组标题衬线「目录」1rem，不再要英文 kicker 和面板底。
 * 切换文章时先显示同尺寸细条骨架，再原地淡入新目录，不做横向滑动。
 */
export function ArticleTocRail({ headings }: ArticleTocRailProps) {
  const reduce = useReducedMotion();
  const contentKey = headings.map((heading) => `${heading.level}:${heading.id}:${heading.text}`).join("|") || "empty";
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const showContent = reduce || readyKey === contentKey;

  useEffect(() => {
    if (reduce) return;

    const frame = window.requestAnimationFrame(() => setReadyKey(contentKey));

    return () => window.cancelAnimationFrame(frame);
  }, [contentKey, reduce]);

  return (
    <aside
      aria-label="文章目录"
      className="article-toc-rail hidden self-start pt-2 transition-[top] duration-700 ease-out will-change-[top] xl:sticky xl:block"
      data-testid="toc-rail"
      style={{ top: "calc(var(--sidebar-sticky-top, 0px) + 1.5rem)" }}
    >
      <nav
        aria-label="本文目录"
        className="max-h-[var(--article-toc-card-max-height)] overflow-y-auto overscroll-contain pb-2"
        data-state={showContent ? "content" : "skeleton"}
      >
        <h2 className="ed-serif mb-1.5 pl-3 text-[1rem] leading-[1.6] text-[var(--foreground)]">目录</h2>
        <AnimatePresence initial={false} mode="wait">
          {showContent ? (
            <motion.div
              key={`toc-content-${contentKey}`}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={tocFadeTransition}
            >
              <ArticleToc headings={headings} variant="rail" />
            </motion.div>
          ) : (
            <motion.div
              key={`toc-skeleton-${contentKey}`}
              aria-hidden="true"
              className="space-y-3 border-l border-[var(--border)] py-1.5 pl-3"
              data-testid="toc-reload-skeleton"
              exit={{ opacity: 0 }}
              transition={tocFadeTransition}
            >
              {skeletonRows.map((width, index) => (
                <SkeletonBar className={`h-3 ${width}`} key={`${width}-${index}`} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </aside>
  );
}
