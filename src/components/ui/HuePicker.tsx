"use client";

import { useEffect, useState } from "react";

interface HuePickerProps {
  isOpen: boolean;
}

export function HuePicker({ isOpen }: HuePickerProps) {
  const [hue, setHue] = useState(() => {
    if (typeof window === "undefined") {
      return "250";
    }
    return localStorage.getItem("theme-hue") ?? "250";
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
    <div
      className={`float-panel absolute top-[5.25rem] right-4 p-3 transition-all ${
        isOpen ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <label className="mb-2 block text-xs text-[var(--muted)]" htmlFor="hue-slider">
        主题色相
      </label>
      <input
        id="hue-slider"
        aria-label="主题色相"
        type="range"
        min="0"
        max="360"
        value={hue}
        onChange={(event) => handleChange(event.target.value)}
        className="w-44"
      />
    </div>
  );
}
