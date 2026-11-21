"use client";

import { useRef, useState } from "react";
import { useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { Drawer } from "vaul";
import { ArticleToc, scrollToHeading, type TocHeading } from "./ArticleToc";

interface ArticleTocDrawerProps {
  headings: TocHeading[];
}

/**
 * xl 以下的目录：左下角浮动「目录」描边文字按钮（44px、离底 16px），点开底部抽屉（简报 8.4 / 16 号原型 08）。
 * 抽屉 card-bg 实底、上方 6px 圆角、无阴影；标题旁「已读 N%」；条目 44px，当前条目 2px sky 竖条。
 * 不加关闭按钮：点遮罩、下滑或 Esc 关闭；点条目后先收起，收起动画结束再滚到对应章节。
 */
export function ArticleTocDrawer({ headings }: ArticleTocDrawerProps) {
  const [open, setOpen] = useState(false);
  const [readPercent, setReadPercent] = useState(0);
  const pendingTarget = useRef<string | null>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const next = Math.min(100, Math.max(0, Math.round(latest * 100)));
    setReadPercent((current) => (current === next ? current : next));
  });

  if (headings.length === 0) {
    return null;
  }

  const flushPendingScroll = () => {
    const id = pendingTarget.current;
    if (!id) return;
    pendingTarget.current = null;
    scrollToHeading(id, reduce);
  };

  const handleNavigate = (id: string) => {
    pendingTarget.current = id;
    setOpen(false);
    // 兜底：收起动画回调没有触发时（如减少动态效果），稍后仍然滚到目标章节
    window.setTimeout(flushPendingScroll, 520);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setReadPercent(Math.min(100, Math.max(0, Math.round(scrollYProgress.get() * 100))));
    }
    setOpen(nextOpen);
  };

  const handleAnimationEnd = (isOpen: boolean) => {
    if (!isOpen) flushPendingScroll();
  };

  return (
    <Drawer.Root open={open} onOpenChange={handleOpenChange} onAnimationEnd={handleAnimationEnd}>
      <Drawer.Trigger asChild>
        <button
          aria-label="打开文章目录"
          className="ed-btn-outline article-float-btn left-4 xl:hidden"
          type="button"
        >
          目录
        </button>
      </Drawer.Trigger>

      <Drawer.Portal>
        <Drawer.Overlay className="ed-overlay fixed inset-0 z-40 xl:hidden" />
        <Drawer.Content className="article-toc-drawer fixed bottom-0 left-0 right-0 z-50 flex max-h-[80vh] flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2.5 focus:outline-none xl:hidden">
          <div aria-hidden="true" className="mx-auto mb-3 h-1 w-9 shrink-0 rounded-full bg-[var(--reader-border-strong)]" />
          <div className="flex items-baseline justify-between gap-4 border-b border-[var(--border)] pb-3">
            <Drawer.Title className="ed-serif text-[1.0625rem] text-[var(--foreground)]">目录</Drawer.Title>
            <span className="ed-meta text-[0.8125rem]">
              已读 <span className="ed-mono">{readPercent}%</span>
            </span>
          </div>
          <Drawer.Description className="ed-visually-hidden">当前文章的章节目录</Drawer.Description>
          <div className="mt-3 overflow-y-auto overscroll-contain pb-2">
            <ArticleToc deferScroll headings={headings} onNavigate={handleNavigate} variant="drawer" />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
