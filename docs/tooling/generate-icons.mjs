/**
 * Renders the Lifequest app icons as real PNG files.
 *
 * Written by hand rather than pulled from a dependency: we need exactly four
 * images once, and a 90-line encoder beats adding sharp/canvas (and their
 * native build steps) to the project for it.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

/* ------------------------------------------------------------------ *
 * Minimal PNG encoder (truecolour + alpha, 8-bit)
 * ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  // Each scanline is prefixed with its filter type (0 = none).
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------------ *
 * Drawing helpers
 * ------------------------------------------------------------------ */

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const mix = (a, b, t) => a + (b - a) * t;
const mixRgb = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

/** Smooth 0→1 ramp; used for anti-aliased edges. */
function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

const VOID = [11, 11, 31];
const DEEP = [26, 22, 74];
const VIOLET = [109, 94, 246];
const CYAN = [79, 216, 240];
const PALE = [191, 246, 255];
const GOLD = [245, 179, 1];

/**
 * The icon: a deep-space rounded square with the companion orb glowing in the
 * middle and a few stars. `padding` shrinks the artwork for maskable variants,
 * where Android may crop up to 20% on every side.
 */
function drawIcon(size, { padding = 0, rounded = true } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const art = size * (1 - padding * 2);
  const radius = size * 0.22;

  // Deterministic star placement so every regenerated icon is identical.
  const stars = [];
  let seed = 7;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < 26; i++) {
    stars.push({
      x: rand() * size,
      y: rand() * size,
      r: art * (0.004 + rand() * 0.007),
      a: 0.25 + rand() * 0.5,
    });
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;

      // --- Background: vertical gradient with a violet bloom up top ---
      const vertical = y / size;
      let color = mixRgb(DEEP, VOID, smoothstep(0, 0.85, vertical));

      const bloom = Math.hypot(x - cx, y - size * 0.12) / (size * 0.75);
      color = mixRgb(color, VIOLET, 0.3 * (1 - clamp01(bloom)));

      // --- Stars ---
      for (const star of stars) {
        const d = Math.hypot(x - star.x, y - star.y);
        const s = 1 - smoothstep(star.r * 0.4, star.r * 1.6, d);
        if (s > 0) color = mixRgb(color, [255, 255, 255], s * star.a);
      }

      // --- Orb glow ---
      const dOrb = Math.hypot(x - cx, y - cy);
      const orbR = art * 0.2;
      const glow = 1 - clamp01(dOrb / (orbR * 2.5));
      color = mixRgb(color, CYAN, Math.pow(glow, 2.2) * 0.55);

      // --- Orb body, lit from the upper-left ---
      const inOrb = 1 - smoothstep(orbR - size * 0.006, orbR + size * 0.006, dOrb);
      if (inOrb > 0) {
        const lx = (x - (cx - orbR * 0.38)) / orbR;
        const ly = (y - (cy - orbR * 0.42)) / orbR;
        const lit = clamp01(1 - Math.hypot(lx, ly) * 0.85);
        let body = mixRgb(VIOLET, CYAN, clamp01(lit * 1.4));
        body = mixRgb(body, PALE, Math.pow(lit, 2.4));
        color = mixRgb(color, body, inOrb);
      }

      // --- Gold spark, upper right ---
      const dSpark = Math.hypot(x - (cx + orbR * 0.92), y - (cy - orbR * 0.95));
      const spark = 1 - smoothstep(art * 0.012, art * 0.05, dSpark);
      if (spark > 0) color = mixRgb(color, GOLD, spark);

      // --- Rounded-rect mask ---
      // Signed distance to a rounded box: negative inside, zero on the edge.
      let alpha = 255;
      if (rounded) {
        const px = Math.abs(x + 0.5 - cx);
        const py = Math.abs(y + 0.5 - cy);
        const qx = px - (size / 2 - radius);
        const qy = py - (size / 2 - radius);
        const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
        const inside = Math.min(Math.max(qx, qy), 0);
        const sdf = outside + inside - radius;
        alpha = Math.round(255 * (1 - smoothstep(-1, 1, sdf)));
      }

      rgba[i] = Math.round(clamp01(color[0] / 255) * 255);
      rgba[i + 1] = Math.round(clamp01(color[1] / 255) * 255);
      rgba[i + 2] = Math.round(clamp01(color[2] / 255) * 255);
      rgba[i + 3] = alpha;
    }
  }

  return encodePng(size, size, rgba);
}

/* ------------------------------------------------------------------ *
 * Output
 * ------------------------------------------------------------------ */

const root = process.argv[2];
if (!root) throw new Error("Usage: node generate-icons.mjs <project-root>");

const targets = [
  { path: `${root}/public/icons/icon-192.png`, size: 192, opts: {} },
  { path: `${root}/public/icons/icon-512.png`, size: 512, opts: {} },
  // Maskable icons must survive a 20% crop on all sides, and must be full-bleed.
  {
    path: `${root}/public/icons/icon-maskable-512.png`,
    size: 512,
    opts: { padding: 0.14, rounded: false },
  },
  // iOS applies its own rounding, so ship a square.
  {
    path: `${root}/public/icons/apple-touch-icon.png`,
    size: 180,
    opts: { rounded: false },
  },
  { path: `${root}/src/app/icon.png`, size: 256, opts: {} },
];

for (const target of targets) {
  mkdirSync(dirname(target.path), { recursive: true });
  writeFileSync(target.path, drawIcon(target.size, target.opts));
  console.log(`wrote ${target.path} (${target.size}px)`);
}
