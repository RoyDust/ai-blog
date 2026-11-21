"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArticleToc } from "./ArticleToc";

interface ArticleTocRailProps {
  headings: Array<{ id: string; text: string; level: 1 | 2 | 3 }>;
}

const tocReloadTransition = {
  duration: 0.9,
  ease: [0.16, 1, 0.3, 1] as const,
};

const skeletonRows = ["w-11/12", "w-full", "w-4/5", "w-10/12", "w-2/3"];

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
    <motion.aside
      data-testid="toc-rail"
      aria-label="文章目录"
      className="article-toc-rail hidden transition-[top,box-shadow] duration-700 ease-out will-change-[top] xl:sticky xl:block"
      style={{ top: "calc(var(--sidebar-sticky-top, 0px) + 0.75rem)" }}
      initial={false}
      layout="position"
      transition={tocReloadTransition}
    >
      <motion.nav
        aria-label="本文目录"
        className="reader-panel max-h-[var(--article-toc-card-max-height)] overflow-auto p-5"
        data-state={showContent ? "content" : "skeleton"}
        layout
        transition={tocReloadTransition}
      >
        <p aria-hidden="true" className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
          On this page
        </p>
        <h2 className="mb-4 font-display text-lg font-semibold text-[var(--foreground)]">目录</h2>
        <AnimatePresence initial={false} mode="popLayout">
          {showContent ? (
            <motion.div
              key={`toc-content-${contentKey}`}
              layout
              initial={reduce ? false : { opacity: 0 }}
              animate={reduce ? undefined : { opacity: 1 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={tocReloadTransition}
            >
              <ArticleToc headings={headings} />
            </motion.div>
          ) : (
            <motion.div
              key={`toc-skeleton-${contentKey}`}
              aria-hidden="true"
              className="space-y-2.5"
              data-testid="toc-reload-skeleton"
              exit={{ opacity: 0 }}
              layout
              transition={tocReloadTransition}
            >
              {skeletonRows.map((width, index) => (
                <div
                  className={`reader-skeleton h-3 rounded-full ${width}`}
                  key={`${width}-${index}`}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>
    </motion.aside>
  );
}
