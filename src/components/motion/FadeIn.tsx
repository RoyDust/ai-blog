"use client";

import { motion } from "framer-motion";
import { useMotionPreference } from "./MotionProvider";

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  reducedMotion?: boolean;
  className?: string;
}

export function FadeIn({ children, delay = 0, reducedMotion, className }: FadeInProps) {
  const context = useMotionPreference();
  const shouldReduce = reducedMotion ?? context.reducedMotion;

  if (shouldReduce) {
    return (
      <div className={className} data-motion="reduced">
        {children}
      </div>
    );
  }

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={className}
      data-motion="enabled"
      initial={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.22, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  );
}
