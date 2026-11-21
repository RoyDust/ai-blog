"use client";

import { useEffect, useState } from "react";
import { MotionPanel } from "@/components/motion/MotionPanel";

interface HuePickerProps {
  isOpen: boolean;
}

export function HuePicker({ isOpen }: HuePickerProps) {
  const [hue, setHue] = useState(() => {
    if (typeof window === "undefined") {
      return "215";
    }
    return localStorage.getItem("theme-hue") ?? "215";
  });

  useEffect(() => {
    document.documentElement.style.setProperty("--hue", hue);
  }, [hue]);

  const handleChange = (value: string) => {
    setHue(value);
    document.documentElement.style.setProperty("--hue", value);
    localStorage.setItem("theme-hue", value);
  };

  return (
    <MotionPanel
      open={isOpen}
      className="float-panel absolute top-[calc(var(--reader-nav-height)+0.65rem)] right-3 z-50 w-56 p-3.5"
    >
      <div className="mb-2.5 flex items-center justify-between text-xs">
        <label className="font-semibold text-[var(--foreground)]" htmlFor="hue-slider">
          主题色相
        </label>
        <span className="rounded-md bg-[var(--btn-regular-bg)] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--brand)] tabular-nums">
          {hue}
        </span>
      </div>
      <input
        id="hue-slider"
        aria-label="主题色相"
        type="range"
        min="0"
        max="360"
        value={hue}
        onChange={(event) => handleChange(event.target.value)}
        className="h-2 w-full cursor-pointer appearance-none rounded-full"
        style={{
          background:
            "linear-gradient(90deg, oklch(0.7 0.12 0), oklch(0.7 0.12 90), oklch(0.7 0.12 180), oklch(0.7 0.12 270), oklch(0.7 0.12 360))",
        }}
      />
    </MotionPanel>
  );
}
