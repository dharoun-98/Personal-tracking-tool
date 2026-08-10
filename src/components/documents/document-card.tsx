"use client";

import { useState } from "react";
import { Check, Download, FileText, Heart, Loader2 } from "lucide-react";
import { useSnapshot } from "@/lib/selectors";
import { useGame } from "@/lib/store";
import { downloadDocument, type DocumentKind, type DocumentData } from "@/lib/pdf/generate";
import { cn } from "@/lib/cn";
import { Panel } from "@/components/ui/panel";

/** Assembles the document payload from live store state. */
export function useDocumentData(): DocumentData | null {
  const profile = useGame((s) => s.profile);
  const quests = useGame((s) => s.quests);
  const goals = useGame((s) => s.goals);
  const { domains } = useSnapshot();

  if (!profile) return null;
  return {
    profile,
    quests,
    goals,
    domains,
    startedAt: profile.createdAt,
    generatedAt: new Date().toISOString(),
  };
}

const ICONS = { report: FileText, promise: Heart } as const;

const COPY: Record<DocumentKind, { title: string; body: (data: DocumentData) => string; accent: string }> = {
  report: {
    title: "Your starting report",
    body: () =>
      "Where you stood across all seven domains on day one, in your own words. Four pages, fixed in time.",
    accent: "var(--color-cyan)",
  },
  promise: {
    title: "Promise to your future self",
    body: (data) =>
      data.profile.promise
        ? `Your own words, sealed for ${data.profile.promiseHorizonMonths} months.`
        : "You skipped the promise during setup — the letter still prints, with space to write it by hand.",
    accent: "var(--color-gold)",
  },
};

export function DocumentCard({ kind }: { kind: DocumentKind }) {
  const data = useDocumentData();
  const markReportsGenerated = useGame((s) => s.markReportsGenerated);
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");

  const Icon = ICONS[kind];
  const copy = COPY[kind];

  const handleDownload = async () => {
    if (!data) return;
    setState("working");
    try {
      // Regenerated on every download so the document always reflects the
      // current profile rather than a stale cached copy.
      await downloadDocument(kind, data);
      markReportsGenerated();
      setState("done");
      setTimeout(() => setState("idle"), 3000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 5000);
    }
  };

  if (!data) return null;

  return (
    <Panel className="p-4">
      <div className="flex items-start gap-3">
        <span
          className="grid size-9 shrink-0 place-items-center rounded-xl"
          style={{
            background: `color-mix(in oklab, ${copy.accent} 16%, transparent)`,
            color: copy.accent,
          }}
        >
          <Icon className="size-4.5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{copy.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-mute">{copy.body(data)}</p>

          <button
            type="button"
            onClick={handleDownload}
            disabled={state === "working"}
            className={cn(
              "tappable mt-3 inline-flex items-center gap-1.5 rounded-xl px-3 py-2",
              "text-xs font-semibold transition-colors disabled:opacity-60",
              state === "done"
                ? "bg-success/15 text-success"
                : state === "error"
                  ? "bg-danger/15 text-danger"
                  : "bg-surface-2 text-ink-dim hover:bg-surface-3 hover:text-ink",
            )}
          >
            {state === "working" && <Loader2 className="size-3.5 animate-spin" />}
            {state === "done" && <Check className="size-3.5" />}
            {(state === "idle" || state === "error") && <Download className="size-3.5" />}
            {state === "working"
              ? "Preparing…"
              : state === "done"
                ? "Saved"
                : state === "error"
                  ? "Didn't work — try again"
                  : "Download PDF"}
          </button>
        </div>
      </div>
    </Panel>
  );
}
