"use client";

import { AnimatePresence, motion } from "motion/react";
import { listContainerVariants, revealVariants } from "./variants";

interface MotionListProps<T> {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  className?: string;
}

export function MotionList<T>({ items, getKey, renderItem, className }: MotionListProps<T>) {
  return (
    <motion.ul
      className={className}
      variants={listContainerVariants}
      initial="hidden"
      animate="visible"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {items.map((item) => (
          <motion.li
            key={getKey(item)}
            layout
            variants={revealVariants}
          >
            {renderItem(item)}
          </motion.li>
        ))}
      </AnimatePresence>
    </motion.ul>
  );
}
