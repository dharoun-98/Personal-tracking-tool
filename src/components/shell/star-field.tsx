/**
 * Decorative deep-space backdrop.
 *
 * Positions come from a seeded PRNG rather than Math.random so the server and
 * client render byte-identical markup — otherwise every page load would throw
 * a hydration mismatch. It's a server component: zero JS shipped.
 */

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  delay: number;
  duration: number;
}

const STARS: Star[] = (() => {
  const rand = mulberry32(20260809);
  return Array.from({ length: 90 }, () => ({
    x: Math.round(rand() * 10000) / 100,
    y: Math.round(rand() * 10000) / 100,
    size: Math.round((rand() * 1.8 + 0.6) * 100) / 100,
    opacity: Math.round((rand() * 0.5 + 0.15) * 100) / 100,
    delay: Math.round(rand() * 600) / 100,
    duration: Math.round((rand() * 4 + 3) * 100) / 100,
  }));
})();

export function StarField() {
  return (
    <div
      aria-hidden
      // Stars are a night-time device: --c-star-opacity is 0 in Day, which
      // takes the whole layer out without needing a second component.
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden transition-opacity duration-500"
      style={{ opacity: "var(--c-star-opacity)" }}
    >
      {/* Nebulae — big, cheap, blurred gradients that give the void depth. */}
      <div className="absolute -top-32 left-1/2 h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-violet/12 blur-[120px]" />
      <div className="absolute top-1/3 -right-24 h-[26rem] w-[26rem] rounded-full bg-cyan/8 blur-[110px]" />
      <div className="absolute bottom-0 -left-24 h-[30rem] w-[30rem] rounded-full bg-purpose/10 blur-[120px]" />

      {STARS.map((star, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white animate-twinkle"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.opacity,
            animationDelay: `${star.delay}s`,
            animationDuration: `${star.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
