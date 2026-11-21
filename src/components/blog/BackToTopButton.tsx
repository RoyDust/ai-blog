"use client";

import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { ArrowUp } from "lucide-react";
import { useState } from "react";
import { springSnappy } from "@/components/motion/transitions";

function getBackToTopScrollBehavior(): ScrollBehavior {
  const reduceMotionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  return reduceMotionQuery?.matches ? "auto" : "smooth";
}

export function BackToTopButton() {
  const { scrollY } = useScroll();
  const [visible, setVisible] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setVisible(latest > 400);
  });

  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: getBackToTopScrollBehavior() });
  };

  return (
    <motion.button
      aria-label="返回顶部"
      className="reader-icon-btn fixed bottom-6 right-6 z-40 bg-[color-mix(in_oklab,var(--reader-panel)_88%,transparent)] text-[var(--foreground)] shadow-[var(--reader-shadow)] backdrop-blur"
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 8, pointerEvents: visible ? "auto" : "none" }}
      whileHover={{ y: visible ? -2 : 8 }}
      whileTap={{ scale: 0.92 }}
      transition={springSnappy}
      onClick={handleClick}
      type="button"
    >
      <ArrowUp className="h-5 w-5" />
    </motion.button>
  );
}
