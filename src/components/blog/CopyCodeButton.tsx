"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { springSnappy } from "@/components/motion/transitions";

interface CopyCodeButtonProps {
  code: string;
}

export function CopyCodeButton({ code }: CopyCodeButtonProps) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const reduce = useReducedMotion();

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
      className="ed-icon-btn text-[var(--text-muted)]"
      onClick={handleCopy}
      type="button"
      whileTap={reduce ? undefined : { scale: 0.92 }}
      transition={springSnappy}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={state}
          initial={reduce ? false : { opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduce ? undefined : { opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.14 }}
          className="flex items-center gap-1.5"
        >
          {copied ? <Check aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} /> : <Copy aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />}
          {state === "idle" ? null : <span className="text-[0.75rem] font-medium">{copied ? "已复制" : "失败"}</span>}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
