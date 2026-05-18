"use client";

import { MotionConfig } from "motion/react";
import { blogMotionTransition } from "./transitions";

export function BlogMotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={blogMotionTransition}>
      {children}
    </MotionConfig>
  );
}
