"use client";

import { useState, type MouseEvent } from "react";
import { List } from "lucide-react";
import { Drawer } from "vaul";
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
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <button
          aria-label="打开文章目录"
          className="fixed bottom-20 right-4 z-40 inline-flex h-11 items-center gap-1.5 rounded-full border border-[var(--reader-border)] bg-[var(--reader-panel)] px-3 text-xs font-semibold text-[var(--foreground)] shadow-[var(--reader-shadow)] backdrop-blur-sm transition hover:bg-[var(--reader-panel-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] xl:hidden"
          type="button"
        >
          <List aria-hidden="true" className="h-3.5 w-3.5" />
          目录
        </button>
      </Drawer.Trigger>

      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40 xl:hidden" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[80vh] flex-col rounded-t-2xl border-t border-[var(--reader-border)] bg-[var(--reader-panel)] p-5 shadow-[0_-24px_64px_color-mix(in_oklab,black_28%,transparent)] focus:outline-none xl:hidden">
          <div aria-hidden="true" className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--reader-border)]" />
          <Drawer.Title className="font-display text-lg font-semibold text-[var(--foreground)]">
            目录
          </Drawer.Title>
          <Drawer.Description className="sr-only">当前文章的章节目录</Drawer.Description>
          <div className="mt-4 overflow-y-auto pb-2" onClick={closeOnAnchorClick}>
            <ArticleToc headings={headings} />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
