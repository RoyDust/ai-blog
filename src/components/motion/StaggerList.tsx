"use client";

import { motion } from "framer-motion";
import { useMotionPreference } from "./MotionProvider";

export function StaggerList({ children, className }: { children: React.ReactNode; className?: string }) {
  const { reducedMotion } = useMotionPreference();

  if (reducedMotion) {
    return (
      <div className={className} data-motion="reduced">
        {children}
      </div>
    );
  }

  return (
    <motion.div
      animate="show"
      className={className}
      data-motion="enabled"
      initial="hidden"
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: 0.08,
          },
        },
      }}
    >
      {Array.isArray(children)
        ? children.map((child, index) => (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 12 }}
              key={index}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              {child}
            </motion.div>
          ))
        : children}
    </motion.div>
  );
}
