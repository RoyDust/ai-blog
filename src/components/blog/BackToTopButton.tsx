"use client";

import { motion, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { useState } from "react";
import { editorialEase } from "@/components/editorial";

function getBackToTopScrollBehavior(): ScrollBehavior {
  const reduceMotionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  return reduceMotionQuery?.matches ? "auto" : "smooth";
}

/**
 * 右下角「回到顶部」：card-bg 实底的描边文字按钮，44px，离底 16px，不带图标（16 号原型 07）。
 * 滚过 400px 才出现，出现 / 消失做 8px 位移淡入淡出。
 */
export function BackToTopButton() {
  const { scrollY } = useScroll();
  const [visible, setVisible] = useState(false);
  const reduce = useReducedMotion();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setVisible(latest > 400);
  });

  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: getBackToTopScrollBehavior() });
  };

  return (
    <motion.button
      aria-hidden={!visible}
      className="ed-btn-outline article-float-btn right-4"
      initial={false}
      animate={{ opacity: visible ? 1 : 0, y: visible || reduce ? 0 : 8, pointerEvents: visible ? "auto" : "none" }}
      transition={{ duration: 0.24, ease: editorialEase }}
      onClick={handleClick}
      tabIndex={visible ? 0 : -1}
      type="button"
    >
      回到顶部
    </motion.button>
  );
}
