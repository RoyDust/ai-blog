"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { springSnappy } from "@/components/motion/transitions";

interface ShareButtonProps {
  title: string;
  slug: string;
  authorName: string;
  sourceName: string;
}

export function buildArticleShareText({
  title,
  authorName,
  url,
  sourceName,
}: {
  title: string;
  authorName: string;
  url: string;
  sourceName: string;
}) {
  return [
    `文章：${title}`,
    `作者：${authorName}`,
    `链接：${url}`,
    `来源：${sourceName}`,
    "著作权归作者所有。商业转载请联系作者获得授权，非商业转载请注明出处。",
  ].join("\n");
}

export function ShareButton({ title, slug, authorName, sourceName }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = `${window.location.origin}/posts/${slug}`;
    const text = buildArticleShareText({ title, authorName, url, sourceName });

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // no-op
    }
  };

  return (
    <motion.button
      aria-label="分享文章"
      className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--reader-border)] bg-[color-mix(in_oklab,var(--reader-panel-elevated)_82%,transparent)] px-4 text-sm font-semibold text-[var(--text-body)] transition-colors hover:border-[var(--reader-border-strong)] hover:bg-[var(--reader-panel-elevated)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      onClick={handleShare}
      type="button"
      whileTap={{ scale: 0.92 }}
      whileFocus={{ scale: 0.96 }}
      transition={springSnappy}
    >
      <Share2 className="h-4 w-4" />
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={copied ? "copied" : "idle"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.14 }}
        >
          {copied ? "已复制" : "分享"}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
