"use client";

import { useEffect, useState } from "react";

export function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      const current = window.scrollY;
      const percent = total > 0 ? Math.min(100, Math.max(0, (current / total) * 100)) : 0;
      setProgress(percent);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      aria-label="阅读进度"
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(progress)}
      className="fixed left-0 top-0 z-50 h-1 w-full bg-transparent"
      role="progressbar"
    >
      <div
        className="h-full bg-[var(--primary)] transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
