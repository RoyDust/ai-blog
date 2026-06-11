"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion, type HTMLMotionProps, type Variants } from "motion/react";
import { motionEase, motionDuration } from "./transitions";

const reducedVariants: Variants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1 },
};

/**
 * 视口触发的入场容器：滚动到哪、内容在哪显现。
 *
 * 与"加载即播"的区别：首屏之外的区块在用户滚到时才播放，避免动画在
 * 视口外提前放完导致滚动全程静止。motion 会把 hidden 初始态内联进
 * SSR HTML，内容从首字节起就是隐藏态，不存在"可见内容回退到透明"
 * 的缓存切换闪烁（见 43df139 的 Directive）。
 */
export function InViewReveal({
  children,
  delay = 0,
  ...props
}: HTMLMotionProps<"section"> & { children: ReactNode; delay?: number }) {
  const reduce = useReducedMotion();

  const variants: Variants = reduce
    ? reducedVariants
    : {
        hidden: { opacity: 0, y: 10 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: motionDuration.entrance, ease: motionEase.outQuint, delay },
        },
      };

  return (
    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15, margin: "0px 0px -8% 0px" }}
      variants={variants}
      {...props}
    >
      {children}
    </motion.section>
  );
}
