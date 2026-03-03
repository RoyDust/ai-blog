"use client";

import { Share2 } from "lucide-react";

interface ShareButtonProps {
  title: string;
  slug: string;
}

export function ShareButton({ title, slug }: ShareButtonProps) {
  const handleShare = async () => {
    const url = `${window.location.origin}/posts/${slug}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // no-op
    }
  };

  return (
    <button
      aria-label="分享文章"
      className="ui-btn flex items-center gap-2 border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
      onClick={handleShare}
      type="button"
    >
      <Share2 className="h-4 w-4" />
      <span>分享</span>
    </button>
  );
}

