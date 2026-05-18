"use client";

import { AnimatePresence, motion } from "motion/react";
import { panelVariants } from "./variants";
import { panelTransition } from "./transitions";

interface MotionPanelProps {
  open: boolean;
  children: React.ReactNode;
  className?: string;
}

export function MotionPanel({ open, children, className }: MotionPanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={className}
          variants={panelVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={panelTransition}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
