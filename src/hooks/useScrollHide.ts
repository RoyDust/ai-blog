"use client";

import { useEffect, useState } from "react";

interface UseScrollHideOptions {
  threshold?: number;
  delta?: number;
}

export function useScrollHide({ threshold = 100, delta = 5 }: UseScrollHideOptions = {}) {
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;

    const onScroll = () => {
      const currentY = window.scrollY;
      const diff = currentY - lastY;

      if (Math.abs(diff) >= delta) {
        setIsHidden(diff > 0 && currentY > threshold);
        lastY = currentY;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [delta, threshold]);

  return isHidden;
}
