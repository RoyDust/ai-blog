"use client";

import { type HTMLMotionProps, motion } from "motion/react";
import { springSnappy } from "./transitions";

type MotionIconButtonProps = HTMLMotionProps<"button">;

export function MotionIconButton({ children, ...props }: MotionIconButtonProps) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.92 }}
      whileFocus={{ scale: 0.96 }}
      transition={springSnappy}
      {...props}
    >
      {children}
    </motion.button>
  );
}
