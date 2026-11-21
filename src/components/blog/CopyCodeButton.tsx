"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { springSnappy } from "@/components/motion/transitions";

interface CopyCodeButtonProps {
  code: string;
}

export function CopyCodeButton({ code }: CopyCodeButtonProps) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;

    const timeout = window.setTimeout(() => setState("idle"), 2000);
    return () => window.clearTimeout(timeout);
  }, [state]);

  async function handleCopy() {
    try {
      if (!navigator.clipboard?.writeText) {
        setState("failed");
        return;
      }

      await navigator.clipboard.writeText(code);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  const copied = state === "copied";

  return (
    <motion.button
      aria-label={copied ? "代码已复制" : "复制代码"}
      className="absolute right-3 top-3 z-10 inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--reader-border)] bg-[color-mix(in_oklab,var(--reader-panel-elevated)_92%,black_8%)] px-2.5 text-xs font-medium text-[var(--text-muted)] opacity-100 shadow-sm transition hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
      onClick={handleCopy}
      type="button"
      whileTap={{ scale: 0.92 }}
      whileFocus={{ scale: 0.96 }}
      transition={springSnappy}
    >
      <AnimatePresence initial={false}>
        <motion.span
          key={state}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.12 }}
          className="flex items-center gap-1.5"
        >
          {copied ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : <Copy aria-hidden="true" className="h-3.5 w-3.5" />}
          <span>{copied ? "已复制" : state === "failed" ? "失败" : "复制"}</span>
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
