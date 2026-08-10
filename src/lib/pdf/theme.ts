import type { DomainId } from "@/lib/types";

/* ==================================================================== *
 * Document design tokens.
 *
 * The documents are always light — warm paper, dark ink — regardless of the
 * app's theme. They're keepsakes: printed, emailed, opened years later. A
 * dark-mode PDF is a cartridge of wasted toner and looks wrong on paper.
 * ==================================================================== */

export const PAPER = {
  /** Warm off-white. Pure #FFF looks clinical and blows out on screen. */
  base: "#FCFBF8",
  /** Panels and callouts, a shade deeper than the page. */
  raised: "#F5F2EB",
  /** Deepest tint, for table headers and footers. */
  sunken: "#EDE9DF",
} as const;

export const INK = {
  /** Body text and headings. Near-black with a hint of blue, never pure #000. */
  base: "#1B1A2E",
  /** Secondary text. */
  muted: "#5A5872",
  /** Captions, axis labels, fine print. */
  faint: "#8B8AA0",
  /** Hairlines and dividers. */
  rule: "#DCD7CB",
} as const;

export const BRAND = {
  violet: "#5646D8",
  gold: "#B07C05",
  /** Used sparingly — a full-bleed cover band. */
  night: "#141433",
} as const;

/**
 * Per-domain colour pair.
 *
 * `fill` is the app's colour, used for shapes, bars and dots where contrast
 * against paper doesn't need to clear the text threshold. `ink` is a darkened
 * variant for any text set in the domain's colour, which does.
 */
export const DOMAIN_PRINT: Record<DomainId, { fill: string; ink: string; wash: string }> = {
  health: { fill: "#2DD4A7", ink: "#0A7256", wash: "#E4F8F1" },
  wealth: { fill: "#F5B301", ink: "#8A6002", wash: "#FDF3DC" },
  connections: { fill: "#FF7A5C", ink: "#B23A1D", wash: "#FFEAE4" },
  purpose: { fill: "#A855F7", ink: "#6B21A8", wash: "#F3E8FE" },
  growth: { fill: "#38BDF8", ink: "#0A5F87", wash: "#E0F4FE" },
  peace: { fill: "#818CF8", ink: "#3730A3", wash: "#E8EAFE" },
  fun: { fill: "#F45FD0", ink: "#9D2482", wash: "#FDE7F7" },
};

export const TYPE = {
  /** @react-pdf ships Helvetica; registering webfonts adds weight and risk. */
  sans: "Helvetica",
  sansBold: "Helvetica-Bold",
  sansOblique: "Helvetica-Oblique",
  serif: "Times-Roman",
  serifItalic: "Times-Italic",
  serifBold: "Times-Bold",
} as const;

export const SIZE = {
  display: 32,
  h1: 22,
  h2: 14,
  h3: 11,
  body: 10,
  small: 8.5,
  tiny: 7,
} as const;

export const SPACE = {
  page: 46,
  section: 22,
  block: 12,
  tight: 6,
} as const;
