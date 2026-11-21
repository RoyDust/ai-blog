"use client";

import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { collapseMotion } from "@/components/editorial";
import { cn } from "@/lib/cn";

export interface TocHeading {
  id: string;
  text: string;
  level: 1 | 2 | 3;
}

interface ArticleTocProps {
  headings: TocHeading[];
  /** rail：桌面右侧目录栏；drawer：手机底部抽屉（条目 44px、字号放大） */
  variant?: "rail" | "drawer";
  /** 点击条目后（滚动之前）调用，抽屉用它收起 */
  onNavigate?: (id: string) => void;
  /** 自己接管滚动（抽屉要等收起动画结束再滚） */
  deferScroll?: boolean;
}

interface TocGroup {
  head: TocHeading;
  children: TocHeading[];
}

/** 标题进入视口上方这条线（px）即视为「当前章节」 */
const ACTIVE_OFFSET = 120;

/**
 * 读滚动位置得到当前章节 id：最后一个顶部越过 ACTIVE_OFFSET 的标题。
 * setState 只发生在 rAF / scroll 回调里，不在 effect 体内同步调用。
 */
export function useActiveHeading(headings: TocHeading[]) {
  const [activeId, setActiveId] = useState<string>("");
  const ids = useMemo(() => headings.map((heading) => heading.id), [headings]);

  useEffect(() => {
    if (ids.length === 0) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      let current = "";
      for (const id of ids) {
        const element = document.getElementById(id);
        if (!element) continue;
        if (element.getBoundingClientRect().top - ACTIVE_OFFSET <= 0) {
          current = id;
        } else {
          break;
        }
      }
      setActiveId(current || ids[0]);
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("hashchange", schedule);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("hashchange", schedule);
    };
  }, [ids]);

  return activeId;
}

/** h3 挂在前一个更高层级的标题下；文章里只有 h3 时全部当作顶层 */
function groupHeadings(headings: TocHeading[]): TocGroup[] {
  const hasParent = headings.some((heading) => heading.level < 3);
  const groups: TocGroup[] = [];

  for (const heading of headings) {
    if (!hasParent || heading.level < 3 || groups.length === 0) {
      groups.push({ head: heading, children: [] });
    } else {
      groups[groups.length - 1].children.push(heading);
    }
  }

  return groups;
}

export function scrollToHeading(id: string, reduce: boolean | null) {
  const target = document.getElementById(id);
  if (!target) return;

  const prefersReduced = reduce || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  target.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
  window.history.replaceState(null, "", `#${encodeURIComponent(id)}`);
}

/**
 * 文章目录（简报 16.4）：左侧一条贯通 1px 竖线，当前条目处变 2px sky（layoutId 在条目间平移），
 * 文字 foreground 700；h3 只在所属 h2 激活时展开（高度过渡）。层级缩进 10px。
 */
export function ArticleToc({ headings, variant = "rail", onNavigate, deferScroll = false }: ArticleTocProps) {
  const activeId = useActiveHeading(headings);
  const reduce = useReducedMotion();
  const groups = useMemo(() => groupHeadings(headings), [headings]);
  const minLevel = useMemo(() => Math.min(...headings.map((heading) => heading.level)), [headings]);

  if (headings.length === 0) {
    return <p className="text-[0.8125rem] leading-6 text-[var(--text-muted)]">当前文章暂无章节标题。</p>;
  }

  const handleClick = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    event.preventDefault();
    onNavigate?.(id);
    if (!deferScroll) {
      scrollToHeading(id, reduce);
    }
  };

  const renderLink = (heading: TocHeading) => {
    const isActive = activeId === heading.id;
    const indent = 0.75 + (heading.level - minLevel) * 0.625;

    return (
      <a
        aria-current={isActive ? "location" : undefined}
        className="article-toc__link"
        href={`#${heading.id}`}
        onClick={(event) => handleClick(event, heading.id)}
        style={{ "--toc-indent": `${indent}rem` } as CSSProperties}
      >
        {isActive ? (
          <motion.span
            aria-hidden="true"
            className="article-toc__indicator"
            layoutId={reduce ? undefined : `article-toc-indicator-${variant}`}
            transition={{ type: "spring", stiffness: 520, damping: 42, mass: 0.7 }}
          />
        ) : null}
        <span className="min-w-0 break-words">{heading.text}</span>
      </a>
    );
  };

  return (
    <LayoutGroup id={`article-toc-${variant}`}>
      <ul className={cn("article-toc__list", variant === "drawer" && "article-toc--drawer")}>
        {groups.map((group, groupIndex) => {
          const groupActive = activeId === group.head.id || group.children.some((child) => child.id === activeId);

          return (
            <li key={`${group.head.id}-${groupIndex}`}>
              {renderLink(group.head)}
              <AnimatePresence initial={false}>
                {groupActive && group.children.length > 0 ? (
                  <motion.ul
                    key="children"
                    className="article-toc__sublist"
                    {...(reduce
                      ? { initial: false, animate: { height: "auto", opacity: 1 }, exit: { height: 0, opacity: 0, transition: { duration: 0 } } }
                      : collapseMotion)}
                  >
                    {group.children.map((child, childIndex) => (
                      <li key={`${child.id}-${childIndex}`}>{renderLink(child)}</li>
                    ))}
                  </motion.ul>
                ) : null}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
    </LayoutGroup>
  );
}
