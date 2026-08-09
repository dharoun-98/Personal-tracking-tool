"use client";

import { useMemo } from "react";
import { motion } from "motion/react";

const COLORS = [
  "#F5B301",
  "#22D3EE",
  "#6D5EF6",
  "#2DD4A7",
  "#F45FD0",
  "#FF7A5C",
];

/**
 * Particle burst for level-ups and completed days.
 *
 * Fires from the bottom-right so it reads as coming *from* the companion.
 * Purely decorative and pointer-transparent — it must never intercept a tap.
 */
export function Celebration({
  intensity = "normal",
  duration = 1500,
}: {
  intensity?: "normal" | "big";
  /** Total burst lifetime in ms; the caller unmounts us after this. */
  duration?: number;
}) {
  const count = intensity === "big" ? 34 : 16;

  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        // Deterministic spread so the burst looks designed rather than random.
        const angle = (-160 + (i / count) * 130) * (Math.PI / 180);
        const distance = 90 + ((i * 37) % 130);
        return {
          id: i,
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
          color: COLORS[i % COLORS.length],
          size: 5 + ((i * 7) % 6),
          delay: (i % 6) * 0.045,
          rotate: ((i * 53) % 360) + 180,
        };
      }),
    [count],
  );

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed right-6 bottom-24 z-50 md:bottom-10"
    >
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute rounded-[2px]"
          style={{ width: p.size, height: p.size, background: p.color }}
          initial={{ opacity: 0, x: 0, y: 0, scale: 0, rotate: 0 }}
          animate={{
            opacity: [0, 1, 1, 0],
            x: p.x,
            y: [0, p.y, p.y + 70],
            scale: [0, 1, 0.9, 0.4],
            rotate: p.rotate,
          }}
          transition={{
            duration: (duration / 1000) * (intensity === "big" ? 0.85 : 0.65),
            delay: p.delay,
            ease: [0.16, 1, 0.3, 1],
          }}
        />
      ))}
    </div>
  );
}
