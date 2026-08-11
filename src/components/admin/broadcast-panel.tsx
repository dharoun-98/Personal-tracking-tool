"use client";

import { useState } from "react";
import { Megaphone, Send, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";

type Segment = "all" | "trialing" | "active" | "lapsed" | "quiet";

const SEGMENTS: Array<{ id: Segment; label: string; hint: string }> = [
  { id: "all", label: "Everyone", hint: "All accounts with notifications on" },
  { id: "trialing", label: "On trial", hint: "Still inside their 16 days" },
  { id: "active", label: "Subscribed", hint: "Paying or comped" },
  { id: "lapsed", label: "Lapsed", hint: "Past due or expired" },
  { id: "quiet", label: "Gone quiet", hint: "No check-in for 7 days" },
];

const MAX_TITLE = 60;
const MAX_BODY = 140;

/**
 * Broadcast composer.
 *
 * Deliberately has a preview count and a confirm step. Sending a push to every
 * user is not undoable and lands on their lock screen — a single mis-click
 * should not be able to do that.
 */
export function BroadcastPanel() {
  const [segment, setSegment] = useState<Segment>("all");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [url, setUrl] = useState("/dashboard");
  const [busy, setBusy] = useState<"count" | "send" | null>(null);
  const [recipients, setRecipients] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const valid = title.trim().length > 0 && message.trim().length > 0;

  const post = async (dryRun: boolean) => {
    const response = await fetch("/api/admin/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, message, url, segment, dryRun }),
    });
    return { response, payload: await response.json().catch(() => ({})) };
  };

  const count = async () => {
    setBusy("count");
    setError(null);
    setResult(null);
    const { response, payload } = await post(true);
    setBusy(null);
    if (!response.ok || !payload.ok) {
      setError(payload.message ?? "Couldn't work out who that reaches.");
      return;
    }
    setRecipients(payload.recipients ?? 0);
    setConfirming(true);
  };

  const send = async () => {
    setBusy("send");
    setError(null);
    const { response, payload } = await post(false);
    setBusy(null);
    setConfirming(false);
    if (!response.ok || !payload.ok) {
      setError(payload.message ?? "Send failed.");
      return;
    }
    setResult(`Sent to ${payload.sent} of ${payload.recipients}.`);
    setTitle("");
    setMessage("");
    setRecipients(null);
  };

  return (
    <Panel className="p-4">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-xl bg-violet/15 text-violet-soft">
          <Megaphone className="size-4.5" />
        </span>
        <div>
          <p className="text-sm font-semibold">Send a notification</p>
          <p className="text-2xs text-ink-faint">
            Only reaches people who turned notifications on.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-2xs tracking-wide text-ink-mute uppercase">
            Who
          </label>
          <div className="flex flex-wrap gap-1.5">
            {SEGMENTS.map((option) => (
              <button
                key={option.id}
                type="button"
                title={option.hint}
                onClick={() => {
                  setSegment(option.id);
                  setConfirming(false);
                  setRecipients(null);
                }}
                className={cn(
                  "tappable rounded-lg border px-2.5 py-1.5 text-2xs font-semibold transition-colors",
                  segment === option.id
                    ? "border-violet bg-violet/15 text-ink"
                    : "border-edge bg-surface text-ink-mute hover:text-ink",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 flex items-baseline justify-between text-2xs tracking-wide text-ink-mute uppercase">
            Title
            <span className="text-ink-faint tabular-nums">
              {title.length}/{MAX_TITLE}
            </span>
          </label>
          <input
            value={title}
            maxLength={MAX_TITLE}
            onChange={(e) => {
              setTitle(e.target.value);
              setConfirming(false);
            }}
            placeholder="Something worth interrupting for"
            className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2.5 text-sm outline-none placeholder:text-ink-faint focus:border-violet"
          />
        </div>

        <div>
          <label className="mb-1.5 flex items-baseline justify-between text-2xs tracking-wide text-ink-mute uppercase">
            Message
            <span className="text-ink-faint tabular-nums">
              {message.length}/{MAX_BODY}
            </span>
          </label>
          <textarea
            value={message}
            maxLength={MAX_BODY}
            rows={2}
            onChange={(e) => {
              setMessage(e.target.value);
              setConfirming(false);
            }}
            placeholder="Keep it short — phones truncate."
            className="w-full resize-none rounded-xl border border-edge bg-surface px-3.5 py-2.5 text-sm outline-none placeholder:text-ink-faint focus:border-violet"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-2xs tracking-wide text-ink-mute uppercase">
            Opens
          </label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="/dashboard"
            className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2.5 text-sm outline-none placeholder:text-ink-faint focus:border-violet"
          />
        </div>

        {/* Live preview of what actually lands on a lock screen. */}
        {(title || message) && (
          <div className="rounded-xl border border-edge bg-surface-2 p-3">
            <p className="mb-1.5 text-2xs tracking-wide text-ink-faint uppercase">Preview</p>
            <p className="truncate text-sm font-semibold">{title || "Title"}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-ink-dim">
              {message || "Message"}
            </p>
          </div>
        )}

        {error && (
          <p className="rounded-xl bg-danger/12 px-3 py-2 text-2xs text-danger">{error}</p>
        )}
        {result && (
          <p className="rounded-xl bg-success/12 px-3 py-2 text-2xs text-success">{result}</p>
        )}

        {confirming ? (
          <div className="rounded-xl border border-warn/40 bg-warn/8 p-3">
            <p className="text-xs font-semibold text-warn">
              This reaches {recipients} {recipients === 1 ? "person" : "people"}, right now.
            </p>
            <p className="mt-1 text-2xs text-ink-dim">
              Push notifications can&apos;t be recalled.
            </p>
            <div className="mt-2.5 flex gap-2">
              <Button size="sm" loading={busy === "send"} onClick={send}>
                <Send className="size-3.5" />
                Send it
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" disabled={!valid} loading={busy === "count"} onClick={count}>
            <Users className="size-3.5" />
            Check who this reaches
          </Button>
        )}
      </div>
    </Panel>
  );
}
