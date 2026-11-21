"use client";

import { motion, useReducedMotion, useScroll, useSpring } from "motion/react";
import { springScroll } from "@/components/motion/transitions";

/**
 * 顶部阅读进度：3px foreground 细条（与连载条进度线一致，不用 sky），压在目录抽屉遮罩之上。
 */
export function ReadingProgress() {
  const { scrollYProgress } = useScroll();
  const smoothed = useSpring(scrollYProgress, springScroll);
  const reduce = useReducedMotion();

  return (
    <div
      aria-label="阅读进度"
      aria-valuemax={100}
      aria-valuemin={0}
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] bg-transparent"
      role="progressbar"
    >
      <motion.div className="h-full origin-left bg-[var(--foreground)]" style={{ scaleX: reduce ? scrollYProgress : smoothed }} />
    </div>
  );
}
