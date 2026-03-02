"use client";

import { createContext, useContext, useEffect, useState } from "react";

const MotionContext = createContext({ reducedMotion: false });

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return <MotionContext.Provider value={{ reducedMotion }}>{children}</MotionContext.Provider>;
}

export function useMotionPreference() {
  return useContext(MotionContext);
}
