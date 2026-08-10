"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Mail } from "lucide-react";
import { renderDocument, DOCUMENT_META } from "@/lib/pdf/generate";
import { useGame } from "@/lib/store";
import { cn } from "@/lib/cn";
import { Panel } from "@/components/ui/panel";
import { useDocumentData } from "./document-card";

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "error"; message: string };

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  // Chunked so a multi-megabyte PDF can't blow the argument limit on spread.
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Sends both documents by email.
 *
 * The PDFs are built here, on the device, and uploaded — the server has no
 * copy of the player's history to build them from. If no mail provider is
 * configured the whole card hides itself rather than offering a button that
 * can only fail.
 */
export function EmailDocuments() {
  const data = useDocumentData();
  const account = useGame((s) => s.account);
  const setAccount = useGame((s) => s.setAccount);

  const [available, setAvailable] = useState<boolean | null>(null);
  const [email, setEmail] = useState(account.email ?? "");
  const [state, setState] = useState<State>({ kind: "idle" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/documents/send")
      .then((r) => r.json())
      .then((r) => {
        if (!cancelled) setAvailable(!!r.configured);
      })
      .catch(() => {
        if (!cancelled) setAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data || available === false) return null;

  const send = async () => {
    setState({ kind: "sending" });
    try {
      const [report, promise] = await Promise.all([
        renderDocument("report", data),
        renderDocument("promise", data),
      ]);
      const name = data.profile.displayName;

      const response = await fetch("/api/documents/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name,
          horizonMonths: data.profile.promiseHorizonMonths,
          hasPromise: !!data.profile.promise,
          attachments: [
            {
              filename: DOCUMENT_META.report.filename(name),
              content: await blobToBase64(report),
            },
            {
              filename: DOCUMENT_META.promise.filename(name),
              content: await blobToBase64(promise),
            },
          ],
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        setState({
          kind: "error",
          message: result.message ?? "That didn't go through. Try downloading instead.",
        });
        return;
      }

      // Remembered so Stage 3 has an address to attach to a real account.
      setAccount({ email: email.trim() });
      setState({ kind: "sent" });
    } catch {
      setState({
        kind: "error",
        message: "Something went wrong building them. Try the download buttons above.",
      });
    }
  };

  const valid = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email.trim());

  return (
    <Panel className="p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet/15 text-violet-soft">
          <Mail className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Email them to yourself</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-mute">
            Both PDFs, attached. Handy for finding the promise letter again in a
            year when you&apos;ve forgotten where you put it.
          </p>

          {state.kind === "sent" ? (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-success/15 px-3 py-2 text-xs font-semibold text-success">
              <Check className="size-3.5" />
              Sent to {email.trim()}
            </p>
          ) : (
            <>
              <div className="mt-3 flex gap-2">
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (state.kind === "error") setState({ kind: "idle" });
                  }}
                  placeholder="you@example.com"
                  className="min-w-0 flex-1 rounded-xl border border-edge bg-sunken px-3 py-2.5 text-sm outline-none placeholder:text-ink-faint focus:border-violet"
                />
                <button
                  type="button"
                  onClick={send}
                  disabled={!valid || state.kind === "sending" || available === null}
                  className={cn(
                    "tappable shrink-0 rounded-xl bg-violet px-3.5 py-2.5 text-xs font-semibold text-white",
                    "transition-colors hover:bg-violet-soft disabled:opacity-45",
                  )}
                >
                  {state.kind === "sending" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Send"
                  )}
                </button>
              </div>
              {state.kind === "error" && (
                <p className="mt-2 text-2xs text-danger">{state.message}</p>
              )}
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}
