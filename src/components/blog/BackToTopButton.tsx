"use client";

import { ArrowUp } from "lucide-react";

export function BackToTopButton() {
  return (
    <button
      aria-label="返回顶部"
      className="ui-btn fixed right-6 bottom-6 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-[0_14px_28px_-18px_rgba(0,0,0,0.5)] hover:bg-[var(--surface-alt)]"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      type="button"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}

