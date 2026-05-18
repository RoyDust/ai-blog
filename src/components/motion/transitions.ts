// ── Easing curves ────────────────────────────────────────────────────────────
export const motionEase = {
  outQuart: [0.25, 1, 0.5, 1] as const,
  outQuint: [0.22, 1, 0.36, 1] as const,
  outExpo:  [0.16, 1, 0.3, 1] as const,
};

// ── Duration tokens (tween) ──────────────────────────────────────────────────
export const motionDuration = {
  tap:      0.12,
  fast:     0.18,
  base:     0.24,
  panel:    0.28,
  entrance: 0.42,
};

// ── Spring tokens ─────────────────────────────────────────────────────────────
export const springSnappy = {
  type: "spring",
  visualDuration: 0.2,
  bounce: 0.2,
} as const;

export const springGentle = {
  type: "spring",
  visualDuration: 0.35,
  bounce: 0.1,
} as const;

// 用于 useSpring：适合 ReadingProgress 和拖拽类场景
export const springScroll = {
  stiffness: 200,
  damping: 40,
  mass: 0.8,
} as const;

// ── Global default transition ────────────────────────────────────────────────
export const blogMotionTransition = {
  duration: motionDuration.base,
  ease: motionEase.outQuint,
};

// ── Preset transitions ────────────────────────────────────────────────────────
export const revealTransition = {
  duration: motionDuration.entrance,
  ease: motionEase.outQuint,
};

export const panelTransition = {
  duration: motionDuration.panel,
  ease: motionEase.outQuint,
};
