"use client";

import { cn } from "@/lib/cn";

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  color?: string;
  className?: string;
  "aria-label"?: string;
}

/**
 * Range input with a coloured fill.
 *
 * Built on a native <input type="range"> rather than a custom drag handler:
 * it gets touch, keyboard and screen-reader support for free, which a div with
 * pointer events never quite manages.
 */
export function Slider({
  value,
  onChange,
  min = 1,
  max = 10,
  step = 1,
  color = "var(--accent, var(--color-violet))",
  className,
  ...rest
}: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn(
        "h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-3 outline-none",
        "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-6",
        "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2",
        "[&::-webkit-slider-thumb]:border-white/70 [&::-webkit-slider-thumb]:transition-transform",
        "[&::-webkit-slider-thumb]:bg-[var(--thumb)] [&::-webkit-slider-thumb]:shadow-[0_0_16px_-2px_var(--thumb)]",
        "[&::-webkit-slider-thumb]:active:scale-115",
        "[&::-moz-range-thumb]:size-6 [&::-moz-range-thumb]:rounded-full",
        "[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white/70",
        "[&::-moz-range-thumb]:bg-[var(--thumb)] [&::-moz-range-thumb]:border-none",
        "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-soft",
        className,
      )}
      style={
        {
          background: `linear-gradient(90deg, ${color} ${pct}%, var(--color-surface-3) ${pct}%)`,
          ["--thumb" as string]: color,
        } as React.CSSProperties
      }
      {...rest}
    />
  );
}
