"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
  const reduce = useReducedMotion();

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
      className="ed-icon-btn article-action-btn"
      onClick={handleShare}
      type="button"
      whileTap={reduce ? undefined : { scale: 0.92 }}
      transition={springSnappy}
    >
      <Share2 aria-hidden="true" strokeWidth={1.75} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={copied ? "copied" : "idle"}
          className="article-action-btn__label"
          initial={reduce ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -4 }}
          transition={{ duration: 0.14 }}
        >
          {copied ? "已复制" : "分享"}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
