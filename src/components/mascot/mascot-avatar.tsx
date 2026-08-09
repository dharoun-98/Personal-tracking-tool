"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import type { CompanionMood } from "@/lib/companion";

export type MascotMood = CompanionMood;

/**
 * Lumen — the companion.
 *
 * Drawn inline as SVG rather than shipped as an image so it can react to mood,
 * inherit theme colours, and stay crisp at any size. Personality comes almost
 * entirely from the eyes; the body barely changes.
 */
export function MascotAvatar({
  mood = "idle",
  size = 44,
  className,
}: {
  mood?: MascotMood;
  size?: number;
  className?: string;
}) {
  const eye = EYES[mood];

  return (
    <motion.span
      className={cn("relative grid place-items-center", className)}
      style={{ width: size, height: size }}
      animate={{ y: [0, -3, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* Aura */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-full blur-md"
        style={{
          background:
            "radial-gradient(circle, var(--color-cyan) 0%, var(--color-violet) 45%, transparent 72%)",
          opacity: mood === "sleepy" ? 0.35 : 0.7,
        }}
      />

      <svg
        viewBox="0 0 48 48"
        width={size}
        height={size}
        className="relative"
        role="img"
        aria-label="Lumen, your companion"
      >
        <defs>
          <radialGradient id="lumen-body" cx="36%" cy="30%" r="72%">
            <stop offset="0%" stopColor="#BFF6FF" />
            <stop offset="45%" stopColor="#4FD8F0" />
            <stop offset="100%" stopColor="#6D5EF6" />
          </radialGradient>
          <radialGradient id="lumen-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Body — a soft droplet, wider than tall so it reads as friendly. */}
        <ellipse cx="24" cy="25" rx="17" ry="16" fill="url(#lumen-body)" />
        <ellipse cx="19" cy="17" rx="7" ry="5.5" fill="url(#lumen-core)" />

        {/* Eyes */}
        <motion.g
          animate={{ scaleY: mood === "sleepy" ? 0.15 : [1, 1, 0.12, 1] }}
          transition={
            mood === "sleepy"
              ? { duration: 0.3 }
              : { duration: 4.5, repeat: Infinity, times: [0, 0.92, 0.96, 1] }
          }
          style={{ transformOrigin: "24px 26px" }}
        >
          <ellipse cx={eye.lx} cy="26" rx={eye.rx} ry={eye.ry} fill="#0B0B1F" />
          <ellipse cx={eye.rxc} cy="26" rx={eye.rx} ry={eye.ry} fill="#0B0B1F" />
          {/* Catchlights — the difference between "cute" and "unsettling". */}
          <circle cx={eye.lx + 1} cy="24.6" r="0.9" fill="#FFFFFF" opacity="0.95" />
          <circle cx={eye.rxc + 1} cy="24.6" r="0.9" fill="#FFFFFF" opacity="0.95" />
        </motion.g>

        {/* Mouth */}
        {mood === "happy" && (
          <path
            d="M20.5 31.5 Q24 34.6 27.5 31.5"
            stroke="#0B0B1F"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
          />
        )}
        {mood === "proud" && (
          <path
            d="M20 31 Q24 35.4 28 31"
            stroke="#0B0B1F"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
          />
        )}
        {mood === "curious" && (
          <ellipse cx="24" cy="32" rx="1.6" ry="1.9" fill="#0B0B1F" />
        )}
      </svg>

      {/* Celebration sparks */}
      {mood === "proud" && (
        <>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              aria-hidden
              className="absolute size-1.5 rounded-full bg-gold"
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0, 1, 0.4],
                x: [0, (i - 1) * 20],
                y: [0, -22 - i * 5],
              }}
              transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.25 }}
            />
          ))}
        </>
      )}
    </motion.span>
  );
}

const EYES: Record<MascotMood, { lx: number; rxc: number; rx: number; ry: number }> = {
  idle: { lx: 19.5, rxc: 28.5, rx: 2.1, ry: 2.6 },
  happy: { lx: 19.5, rxc: 28.5, rx: 2.3, ry: 2.8 },
  curious: { lx: 19, rxc: 28, rx: 2.5, ry: 3.1 },
  proud: { lx: 19.5, rxc: 28.5, rx: 2.4, ry: 3 },
  sleepy: { lx: 19.5, rxc: 28.5, rx: 2.4, ry: 2.4 },
};
