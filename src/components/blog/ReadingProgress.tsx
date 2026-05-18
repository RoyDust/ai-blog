"use client";

import { motion, useScroll, useSpring } from "motion/react";
import { springScroll } from "@/components/motion/transitions";

export function ReadingProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, springScroll);

  return (
    <div
      aria-label="阅读进度"
      aria-valuemax={100}
      aria-valuemin={0}
      className="fixed left-0 top-0 z-50 h-0.5 w-full bg-transparent"
      role="progressbar"
    >
      <motion.div
        className="h-full origin-left bg-(--accent-warm) shadow-[0_0_12px_color-mix(in_oklab,var(--accent-warm)_50%,transparent)]"
        style={{ scaleX }}
      />
    </div>
  );
}
