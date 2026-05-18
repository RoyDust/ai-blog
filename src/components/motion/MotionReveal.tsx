"use client";

import { motion } from "motion/react";
import { revealVariants } from "./variants";

interface MotionRevealProps {
  children: React.ReactNode;
  delayIndex?: number;
  className?: string;
}

export function MotionReveal({ children, delayIndex = 0, className }: MotionRevealProps) {
  return (
    <motion.div
      className={className}
      variants={revealVariants}
      initial="hidden"
      animate="visible"
      transition={{ delay: delayIndex * 0.06 }}
    >
      {children}
    </motion.div>
  );
}
