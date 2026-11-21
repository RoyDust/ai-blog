"use client";

import type { MouseEvent } from "react";
import { useReducedMotion } from "motion/react";
import { ArrowGlyph } from "@/components/editorial";
import { COMMENT_INPUT_ID } from "@/components/CommentForm";

/**
 * 文末操作行右侧的「写评论 →」：平滑滚到评论区并聚焦评论输入框（不再是跳转锚点后让读者自己找输入框）。
 * 没有 JS 时退化为普通的 #comments 锚点。
 */
export function CommentJumpLink() {
  const reduce = useReducedMotion();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const section = document.getElementById("comments");
    if (!section) return;

    event.preventDefault();
    const prefersReduced = reduce || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    section.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
    window.history.replaceState(null, "", "#comments");

    const input = document.getElementById(COMMENT_INPUT_ID);
    if (input instanceof HTMLTextAreaElement) {
      input.focus({ preventScroll: true });
    }
  };

  return (
    <a className="ed-link" href="#comments" onClick={handleClick}>
      <span>写评论</span>
      <ArrowGlyph direction="right" />
    </a>
  );
}
