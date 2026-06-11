"use client";

import { motion, useReducedMotion, type HTMLMotionProps, type Variants } from "motion/react";

const reducedVariants: Variants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1 },
  exit: { opacity: 1 },
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

type ArticleSectionProps = HTMLMotionProps<"section">;

/**
 * 文章首屏主体的加载入场。视口外的区块不要用它——
 * 那些用 InViewReveal，滚动到视口时才播放。
 */
export function ArticleSection({ children, className, ...props }: ArticleSectionProps) {
  const reduce = useReducedMotion();

  return (
    <motion.section className={className} variants={reduce ? reducedVariants : articleRevealVariants} {...props}>
      {children}
    </motion.section>
  );
}
