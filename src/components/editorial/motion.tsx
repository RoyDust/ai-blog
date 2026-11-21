"use client";

/**
 * 方向 A 的动效积木。
 *
 * 原则：编辑排版不靠上浮、光晕和弹跳吸引注意，动效只服务于「内容出现」「状态切换」两件事：
 * - 入场：8px 位移 + 淡入，ease-out-expo，列表逐行错开 50ms；
 * - 切换：下划线、指示条用 layoutId 平移，展开收起用高度过渡；
 * - prefers-reduced-motion 时全部退化为直接显示。
 */
import { motion, useReducedMotion, type HTMLMotionProps, type Variants } from "motion/react";
import type { ReactNode } from "react";
import { motionEase } from "@/components/motion/transitions";

export const editorialEase = motionEase.outExpo;

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.46, ease: editorialEase } },
};

const staticVariants: Variants = {
  hidden: { opacity: 1, y: 0 },
  visible: { opacity: 1, y: 0 },
};

/** 滚动进入视口时淡入（只播一次） */
export function Reveal({
  children,
  delay = 0,
  as = "div",
  ...props
}: HTMLMotionProps<"div"> & { children: ReactNode; delay?: number; as?: "div" | "section" | "aside" | "header" }) {
  const reduce = useReducedMotion();
  const Component = as === "section" ? motion.section : as === "aside" ? motion.aside : as === "header" ? motion.header : motion.div;

  return (
    <Component
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.12, margin: "0px 0px -6% 0px" }}
      variants={
        reduce
          ? staticVariants
          : {
              hidden: itemVariants.hidden,
              visible: { opacity: 1, y: 0, transition: { duration: 0.46, ease: editorialEase, delay } },
            }
      }
      {...props}
    >
      {children}
    </Component>
  );
}

/** 列表容器：子项（StaggerItem）逐行错开淡入 */
export function StaggerList({
  children,
  stagger = 0.05,
  as = "div",
  inView = false,
  ...props
}: HTMLMotionProps<"div"> & { children: ReactNode; stagger?: number; as?: "div" | "ol" | "ul"; inView?: boolean }) {
  const reduce = useReducedMotion();
  const Component = as === "ol" ? motion.ol : as === "ul" ? motion.ul : motion.div;
  const variants: Variants = {
    hidden: {},
    visible: { transition: reduce ? {} : { staggerChildren: stagger, delayChildren: 0.04 } },
  };

  return (
    <Component
      initial="hidden"
      {...(inView
        ? { whileInView: "visible", viewport: { once: true, amount: 0.05 } }
        : { animate: "visible" })}
      variants={variants}
      {...(props as object)}
    >
      {children}
    </Component>
  );
}

export function StaggerItem({
  children,
  as = "div",
  ...props
}: HTMLMotionProps<"div"> & { children: ReactNode; as?: "div" | "li" | "article" }) {
  const reduce = useReducedMotion();
  const Component = as === "li" ? motion.li : as === "article" ? motion.article : motion.div;
  return (
    <Component variants={reduce ? staticVariants : itemVariants} {...(props as object)}>
      {children}
    </Component>
  );
}

/** 当前项下划线：同一 layoutId 的下划线会在兄弟项之间平移 */
export function ActiveUnderline({ layoutId, className }: { layoutId: string; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      aria-hidden="true"
      layoutId={reduce ? undefined : layoutId}
      className={className ?? "ed-underline"}
      transition={{ type: "spring", stiffness: 520, damping: 42, mass: 0.7 }}
    />
  );
}

/** 高度展开 / 收起的过渡参数（配合 AnimatePresence 使用） */
export const collapseMotion = {
  initial: { height: 0, opacity: 0 },
  animate: { height: "auto", opacity: 1, transition: { height: { duration: 0.36, ease: editorialEase }, opacity: { duration: 0.24, delay: 0.06 } } },
  exit: { height: 0, opacity: 0, transition: { height: { duration: 0.28, ease: editorialEase }, opacity: { duration: 0.14 } } },
} as const;
