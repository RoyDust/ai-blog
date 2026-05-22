"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";

const pageTransitionVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.72, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    y: -5,
    transition: { duration: 0.52, ease: [0.25, 1, 0.5, 1] },
  },
};

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));

    return () => cancelAnimationFrame(frame);
  }, []);

  const shouldAnimate = mounted && !reduce && pathname !== "/";
  const content = (
    <motion.div
      key={pathname}
      variants={shouldAnimate ? pageTransitionVariants : undefined}
      initial={shouldAnimate ? "hidden" : false}
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
