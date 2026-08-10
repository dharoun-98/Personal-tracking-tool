"use client";

import type { PlayerProfile, Quest, Goal, DomainState, DomainId } from "@/lib/types";

/* ==================================================================== *
 * PDF generation entry points.
 *
 * Everything here is dynamically imported. @react-pdf/renderer is ~1MB of
 * JavaScript — far too much to sit in the main bundle for a feature most
 * players use once. Nothing in this module pulls it in until a document is
 * actually requested.
 *
 * Generation happens on the device. The player's history never leaves it,
 * which is the whole reason the app is local-first.
 * ==================================================================== */

export interface DocumentData {
  profile: PlayerProfile;
  quests: Quest[];
  goals: Goal[];
  domains: Record<DomainId, DomainState>;
  /** ISO date the player started, for the report's dateline. */
  startedAt: string;
  generatedAt: string;
}

export type DocumentKind = "report" | "promise";

export const DOCUMENT_META: Record<
  DocumentKind,
  { title: string; filename: (name: string) => string }
> = {
  report: {
    title: "Your Starting Report",
    filename: (name) => `Lifequest — Starting Report — ${safeName(name)}.pdf`,
  },
  promise: {
    title: "A Promise to Your Future Self",
    filename: (name) => `Lifequest — Promise to Future Self — ${safeName(name)}.pdf`,
  },
};

function safeName(name: string): string {
  // Windows, macOS and most mail clients all choke on a different subset of
  // these; strip the union rather than guess which one the player is on.
  return (
    name
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40) || "Player"
  );
}

/** Renders a document to a Blob, loading the PDF engine on first use. */
export async function renderDocument(
  kind: DocumentKind,
  data: DocumentData,
): Promise<Blob> {
  const [{ pdf }, { StartingReport }, { PromiseLetter }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./starting-report"),
    import("./promise-letter"),
  ]);

  // Invoked directly rather than via createElement: `pdf()` wants the
  // <Document> element itself, and going through a component wrapper types the
  // element by the wrapper's props instead. Both documents are pure functions
  // with no hooks or state, so calling them is equivalent to rendering them.
  const element =
    kind === "report" ? StartingReport({ data }) : PromiseLetter({ data });
  return pdf(element).toBlob();
}

/** Renders and saves a document to the player's downloads. */
export async function downloadDocument(
  kind: DocumentKind,
  data: DocumentData,
): Promise<void> {
  const blob = await renderDocument(kind, data);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = DOCUMENT_META[kind].filename(data.profile.displayName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the download in Safari; a beat is enough.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Opens a document in a new tab for preview rather than saving it. */
export async function previewDocument(
  kind: DocumentKind,
  data: DocumentData,
): Promise<string> {
  const blob = await renderDocument(kind, data);
  return URL.createObjectURL(blob);
}
