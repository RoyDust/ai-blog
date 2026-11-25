"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { List } from "lucide-react";
import {
  Drawer,
  DrawerDescription,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/coss/ui/drawer";
import { ArticleToc } from "./ArticleToc";

interface TocHeading {
  id: string;
  text: string;
  level: 1 | 2 | 3;
}

interface ArticleTocDrawerProps {
  headings: TocHeading[];
}

export function ArticleTocDrawer({ headings }: ArticleTocDrawerProps) {
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (headings.length === 0) return;

    const updateProgress = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) {
        setProgress(0);
        return;
      }
      const next = Math.min(100, Math.max(0, Math.round((window.scrollY / scrollable) * 100)));
      setProgress(next);
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, [headings.length]);

  if (headings.length === 0) {
    return null;
  }

  const closeOnAnchorClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.closest('a[href^="#"]')) {
      setOpen(false);
    }
  };

  return (
    <Drawer position="bottom" open={open} onOpenChange={(nextOpen) => setOpen(nextOpen)}>
      <DrawerTrigger
        render={
          <button
            aria-label="打开文章目录"
            className="fixed bottom-20 right-4 z-40 inline-flex h-10 items-center gap-1.5 rounded-xl border border-[var(--reader-border)] bg-[var(--reader-panel)] px-3 text-xs font-semibold text-[var(--foreground)] shadow-[var(--reader-shadow)] backdrop-blur-md transition hover:bg-[var(--btn-regular-bg)] hover:text-[var(--btn-content)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] xl:hidden"
            type="button"
          />
        }
      >
        <List aria-hidden="true" className="h-3.5 w-3.5" />
        <span className="font-mono tabular-nums">{progress > 0 ? `${progress}% · 目录` : "目录"}</span>
      </DrawerTrigger>

      <DrawerPopup
        className="flex max-h-[80vh] flex-col rounded-t-2xl border-t border-[var(--reader-border)] bg-[var(--reader-panel)] p-5 shadow-[0_-24px_64px_color-mix(in_oklab,black_28%,transparent)] focus:outline-none before:hidden after:hidden xl:hidden"
        showBar={false}
        showCloseButton={false}
      >
        <div aria-hidden="true" className="mx-auto mb-3.5 h-1 w-10 rounded-full bg-[var(--line-color)]" />
        <DrawerTitle className="reader-section-heading text-base">
          目录
        </DrawerTitle>
        <DrawerDescription className="sr-only">当前文章的章节目录</DrawerDescription>
        <div className="mt-3.5 overflow-y-auto pb-2" onClick={closeOnAnchorClick}>
          <ArticleToc headings={headings} />
        </div>
      </DrawerPopup>
    </Drawer>
  );
}
