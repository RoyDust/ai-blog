import type { Variants } from "motion/react";
import { motionEase, motionDuration } from "./transitions";

export const revealVariants: Variants = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: motionDuration.entrance, ease: motionEase.outQuint } },
  exit:    { opacity: 0, y: -4, transition: { duration: motionDuration.fast,     ease: motionEase.outQuart } },
};

export const listContainerVariants: Variants = {
  hidden:  {},
  visible: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0,
    },
  },
};

export const postListContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.05,
    },
  },
};

export const postCardRevealVariants: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.52, ease: motionEase.outQuint },
  },
  exit: {
    opacity: 0,
    y: -4,
    scale: 0.992,
    transition: { duration: motionDuration.fast, ease: motionEase.outQuart },
  },
};

export const featuredPostRevealVariants: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.58, ease: motionEase.outQuint },
  },
  exit: {
    opacity: 0,
    y: -4,
    scale: 0.99,
    transition: { duration: motionDuration.fast, ease: motionEase.outQuart },
  },
};

export const panelVariants: Variants = {
  hidden:  { opacity: 0, scale: 0.97, y: -6 },
  visible: { opacity: 1, scale: 1,    y: 0  },
  exit:    { opacity: 0, scale: 0.97, y: -6 },
};

export const sheetVariants: Variants = {
  hidden:  { opacity: 0, y: "100%" },
  visible: { opacity: 1, y: 0      },
  exit:    { opacity: 0, y: "100%" },
};

export const crossFadeVariants: Variants = {
  hidden:  { opacity: 0, scale: 0.99  },
  visible: { opacity: 1, scale: 1     },
  exit:    { opacity: 0, scale: 1.01  },
};

export const iconPopVariants: Variants = {
  hidden:  { scale: 0.8, opacity: 0 },
  visible: { scale: 1,   opacity: 1, transition: { type: "spring", visualDuration: 0.2, bounce: 0.35 } },
};
