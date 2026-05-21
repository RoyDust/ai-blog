"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion, type HTMLMotionProps, type Variants } from "motion/react";

const reducedVariants: Variants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1 },
  exit: { opacity: 1 },
};

const articleListContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: 0.08,
      staggerChildren: 0.11,
    },
  },
};

const articleRevealVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.72, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    y: -5,
    transition: { duration: 0.42, ease: [0.25, 1, 0.5, 1] },
  },
};

export function ArticleSectionsReveal({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className="min-w-0 space-y-8"
      variants={reduce ? reducedVariants : articleListContainerVariants}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

type ArticleSectionProps = HTMLMotionProps<"section">;

export function ArticleSection({ children, className, ...props }: ArticleSectionProps) {
  const reduce = useReducedMotion();

  return (
    <motion.section className={className} variants={reduce ? reducedVariants : articleRevealVariants} {...props}>
      {children}
    </motion.section>
  );
}
