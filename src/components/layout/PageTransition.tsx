"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";

const pageTransitionVariants: Variants = {
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 1,
    y: -3,
    transition: { duration: 0.14, ease: [0.25, 1, 0.5, 1] },
  },
};

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  const shouldAnimate = !reduce && pathname !== "/";
  const content = (
    <motion.div
      key={pathname}
      variants={shouldAnimate ? pageTransitionVariants : undefined}
      initial={false}
      animate={shouldAnimate ? "visible" : undefined}
      exit={shouldAnimate ? "exit" : undefined}
    >
      {children}
    </motion.div>
  );

  if (!shouldAnimate) {
    return content;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {content}
    </AnimatePresence>
  );
}
