"use client";

import { useEffect, useState } from "react";

interface UseScrollHideOptions {
  threshold?: number;
  /** 同方向累计滚动距离，达到后才切换显隐。 */
  delta?: number;
}

export function useScrollHide({ threshold = 100, delta = 720 }: UseScrollHideOptions = {}) {
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    let lastY = Math.max(0, window.scrollY);
    let distance = 0;

    const onScroll = () => {
      const currentY = Math.max(0, window.scrollY);
      const diff = currentY - lastY;
      lastY = currentY;

      if (currentY <= threshold) {
        distance = 0;
        setIsHidden(false);
        return;
      }

      if (diff === 0) return;

      distance = Math.sign(diff) === Math.sign(distance) ? distance + diff : diff;

      if (Math.abs(distance) >= delta) {
        setIsHidden(distance > 0);
        distance = 0;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [delta, threshold]);

  return isHidden;
}
