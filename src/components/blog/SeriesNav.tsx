"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { TextLink, collapseMotion, editorialEase } from "@/components/editorial";
import { formatIndex } from "@/lib/editorial-format";

interface SeriesNavPost {
  title: string;
  slug: string;
  seriesOrder: number;
}

interface SeriesNavProps {
  series: {
    title: string;
    slug: string;
  };
  currentSlug: string;
  posts: SeriesNavPost[];
}

/**
 * 连载条（简报 16.4）：Hero 与正文之间，上下各一条 1px 细线。
 * 第一行「系列」小标题 + 衬线系列名 + 等宽「第 N / M 篇」，右侧「← 上一篇 · 下一篇 →」；
 * 下面 2px 进度线（已读 foreground、未读 border），再下一行「展开全部 M 篇 →」，展开后列出 01–M。
 * 手机上三行：系列名与篇数 / 进度线 / 展开链接与上一篇 · 下一篇。
 */
export function SeriesNav({ series, currentSlug, posts }: SeriesNavProps) {
  const [expanded, setExpanded] = useState(false);
  const reduce = useReducedMotion();
  const listId = useId();

  if (posts.length === 0) {
    return null;
  }

  const currentIndex = posts.findIndex((post) => post.slug === currentSlug);
  const previous = currentIndex > 0 ? posts[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < posts.length - 1 ? posts[currentIndex + 1] : null;
  const position = Math.max(currentIndex + 1, 1);
  const progressPercent = Math.round((position / posts.length) * 100);

  return (
    <nav aria-label={`${series.title} 系列导航`} className="series-strip">
      <div className="series-strip__grid">
        <div className="series-strip__head">
          <span className="ed-eyebrow">系列</span>
          <Link className="series-strip__name" href={`/series/${series.slug}`}>
            {series.title}
          </Link>
          <span className="ed-mono text-[0.8125rem] text-[var(--text-muted)]">
            第 {position} / {posts.length} 篇
          </span>
        </div>

        {previous || next ? (
          <div className="series-strip__nav">
            {previous ? (
              <TextLink aria-label={`上一篇：${previous.title}`} arrow="left" href={`/posts/${previous.slug}`}>
                上一篇
              </TextLink>
            ) : null}
            {previous && next ? (
              <span aria-hidden="true" className="text-[var(--text-muted)]">
                ·
              </span>
            ) : null}
            {next ? (
              <TextLink aria-label={`下一篇：${next.title}`} href={`/posts/${next.slug}`}>
                下一篇
              </TextLink>
            ) : null}
          </div>
        ) : null}

        <div
          aria-label="系列进度"
          aria-valuemax={posts.length}
          aria-valuemin={1}
          aria-valuenow={position}
          className="series-strip__bar"
          role="progressbar"
        >
          <span className="series-strip__bar-fill" data-testid="series-progress-bar" style={{ width: `${progressPercent}%` }} />
        </div>

        <button
          aria-controls={expanded ? listId : undefined}
          aria-expanded={expanded}
          className="series-strip__toggle"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          <AnimatePresence initial={false} mode="wait">
            <motion.span
              key={expanded ? "collapse" : "expand"}
              className="inline-flex items-baseline gap-[0.3em]"
              initial={reduce ? false : { opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -3 }}
              transition={{ duration: 0.16, ease: editorialEase }}
            >
              {expanded ? (
                "收起列表"
              ) : (
                <>
                  展开全部 <span className="ed-mono">{posts.length}</span> 篇<span aria-hidden="true">→</span>
                </>
              )}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="series-list"
            className="overflow-hidden"
            id={listId}
            {...(reduce ? { initial: false, animate: { height: "auto", opacity: 1 }, exit: { height: 0, opacity: 0, transition: { duration: 0 } } } : collapseMotion)}
          >
            <ol className="series-strip__list">
              {posts.map((post, index) => {
                const isCurrent = post.slug === currentSlug;
                return (
                  <li key={post.slug}>
                    <Link
                      aria-current={isCurrent ? "page" : undefined}
                      className="series-strip__row"
                      href={`/posts/${post.slug}`}
                    >
                      <span className="series-strip__index">{formatIndex(post.seriesOrder || index + 1)}</span>
                      <span className="truncate">{post.title}</span>
                      {isCurrent ? <span className="series-strip__current">正在阅读</span> : <span />}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </nav>
  );
}
