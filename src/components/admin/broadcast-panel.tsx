"use client";

import { useRef, useState } from "react";
import { Megaphone, Send, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";

type Segment = "all" | "trialing" | "active" | "lapsed" | "quiet";

interface BroadcastDraft {
  segment: Segment;
  title: string;
  message: string;
  url: string;
}

interface ConfirmedDraft extends BroadcastDraft {
  recipients: number;
  reviewToken: string;
}

interface BroadcastResponse {
  ok?: boolean;
  reason?: string;
  message?: string;
  recipients?: number;
  reviewToken?: string;
  sent?: number;
  failed?: number;
}

interface ResultNotice {
  tone: "success" | "warning" | "neutral";
  message: string;
}

const SEGMENTS: Array<{ id: Segment; label: string; hint: string }> = [
  { id: "all", label: "Everyone", hint: "Every account with a reachable device." },
  { id: "trialing", label: "On trial", hint: "Players whose trial is still open." },
  {
    id: "active",
    label: "Paid / free",
    hint: "Paid players and accounts with free or team access.",
  },
  {
    id: "lapsed",
    label: "Needs access",
    hint: "Players locked after an ended trial, subscription, or payment grace period.",
  },
  {
    id: "quiet",
    label: "Gone quiet",
    hint: "Onboarded players with access who checked in before, but not for 7 days.",
  },
];

const DESTINATIONS = [
  { value: "/dashboard", label: "Dashboard" },
  { value: "/journey", label: "Journey" },
  { value: "/map", label: "Life map" },
  { value: "/profile", label: "Profile" },
  { value: "/account", label: "Account" },
] as const;

const MAX_TITLE = 60;
const MAX_BODY = 140;

/** A two-step composer for an irreversible push notification. */
export function BroadcastPanel() {
  const [segment, setSegment] = useState<Segment>("all");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [url, setUrl] = useState("/dashboard");
  const [busy, setBusy] = useState<"count" | "send" | null>(null);
  const [confirmed, setConfirmed] = useState<ConfirmedDraft | null>(null);
  const [result, setResult] = useState<ResultNotice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const revision = useRef(0);

  const selectedSegment = SEGMENTS.find((option) => option.id === segment) ?? SEGMENTS[0];
  const selectedDestination =
    DESTINATIONS.find((option) => option.value === url) ?? DESTINATIONS[0];
  const confirmedSegment = confirmed
    ? (SEGMENTS.find((option) => option.id === confirmed.segment) ?? SEGMENTS[0])
    : null;
  const confirmedDestination = confirmed
    ? (DESTINATIONS.find((option) => option.value === confirmed.url) ?? DESTINATIONS[0])
    : null;
  const valid = title.trim().length > 0 && message.trim().length > 0;
  const controlsDisabled = busy !== null;

  const invalidateConfirmation = () => {
    revision.current += 1;
    setConfirmed(null);
    setError(null);
    setResult(null);
  };

  const post = async (draft: BroadcastDraft | ConfirmedDraft, dryRun: boolean) => {
    const response = await fetch("/api/admin/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, dryRun }),
    });
    const payload = (await response.json().catch(() => ({}))) as BroadcastResponse;
    return { response, payload };
  };

  const checkAudience = async () => {
    if (!valid || controlsDisabled) return;

    const draft: BroadcastDraft = {
      segment,
      title: title.trim(),
      message: message.trim(),
      url,
    };
    const checkedRevision = revision.current;
    setBusy("count");
    setError(null);
    setResult(null);
    setConfirmed(null);

    try {
      const { response, payload } = await post(draft, true);
      if (revision.current !== checkedRevision) return;
      if (!response.ok || !payload.ok) {
        setError(payload.message ?? "Couldn't check that audience. Please try again.");
        return;
      }

      const recipients = Math.max(0, Number(payload.recipients) || 0);
      if (recipients === 0) {
        setResult({ tone: "neutral", message: "No reachable players match that audience." });
        return;
      }

      if (!payload.reviewToken) {
        setError("The audience review could not be secured. Please try again.");
        return;
      }

      // Store the exact reviewed payload and server-signed audience snapshot.
      // Send never reads mutable form state.
      setConfirmed({ ...draft, recipients, reviewToken: payload.reviewToken });
    } catch {
      if (revision.current === checkedRevision) {
        setError("Couldn't reach the notification service. Please try again.");
      }
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    if (!confirmed || controlsDisabled) return;

    const draft = confirmed;
    setBusy("send");
    setError(null);
    setResult(null);

    try {
      const { response, payload } = await post(draft, false);
      if (response.status === 409) {
        const currentRecipients =
          typeof payload.recipients === "number" && Number.isSafeInteger(payload.recipients)
            ? Math.max(0, payload.recipients)
            : null;
        revision.current += 1;
        setConfirmed(null);
        setResult({
          tone: "warning",
          message:
            payload.message ??
            (currentRecipients === null
              ? "The audience changed. Nothing was sent. Check the audience again before sending."
              : `The audience changed from ${draft.recipients} to ${currentRecipients}. Nothing was sent. Check the audience again before sending.`),
        });
        return;
      }
      if (!response.ok || !payload.ok) {
        setError(payload.message ?? "The notification could not be sent.");
        return;
      }

      const sent = Math.max(0, Number(payload.sent) || 0);
      const recipients = Math.max(0, Number(payload.recipients) || 0);
      const failed = Math.max(0, Number(payload.failed) || 0);
      setResult({
        tone: failed > 0 ? "warning" : "success",
        message:
          failed > 0
            ? `Sent to ${sent} of ${recipients}; ${failed} could not be reached.`
            : `Sent to ${sent} ${sent === 1 ? "person" : "people"}.`,
      });
      revision.current += 1;
      setConfirmed(null);
      setTitle("");
      setMessage("");
    } catch {
      setError("The notification service could not be reached. Nothing was retried automatically.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel className="p-4 sm:p-5">
      <div className="mb-5 flex items-center gap-2.5">
        <span className="grid size-11 place-items-center rounded-xl bg-violet/15 text-violet-soft">
          <Megaphone className="size-5" aria-hidden />
        </span>
        <div>
          <h3 className="text-base font-semibold">Send a notification</h3>
          <p className="text-xs text-ink-mute">
            Only reaches people who turned notifications on.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <fieldset aria-describedby="broadcast-audience-hint" disabled={controlsDisabled}>
          <legend className="mb-2 text-xs font-semibold text-ink-mute">Audience</legend>
          <div className="flex flex-wrap gap-2">
            {SEGMENTS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={segment === option.id}
                onClick={() => {
                  setSegment(option.id);
                  invalidateConfirmation();
                }}
                className={cn(
                  "tappable min-h-11 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-soft disabled:opacity-45",
                  segment === option.id
                    ? "border-violet bg-violet/15 text-ink"
                    : "border-edge bg-surface text-ink-mute hover:text-ink",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p id="broadcast-audience-hint" className="mt-2 text-xs leading-relaxed text-ink-mute">
            {selectedSegment.hint}
          </p>
        </fieldset>

        <div>
          <label
            htmlFor="broadcast-title"
            className="mb-1.5 flex items-baseline justify-between text-xs font-semibold text-ink-mute"
          >
            Title
            <span className="font-normal text-ink-faint tabular-nums">
              {title.length}/{MAX_TITLE}
            </span>
          </label>
          <input
            id="broadcast-title"
            value={title}
            maxLength={MAX_TITLE}
            disabled={controlsDisabled}
            onChange={(event) => {
              setTitle(event.target.value);
              invalidateConfirmation();
            }}
            placeholder="A short, useful headline"
            className="w-full rounded-xl border border-edge bg-surface px-3.5 py-3 text-sm outline-none placeholder:text-ink-faint focus:border-violet focus:ring-2 focus:ring-violet/25 disabled:opacity-55"
          />
        </div>

        <div>
          <label
            htmlFor="broadcast-message"
            className="mb-1.5 flex items-baseline justify-between text-xs font-semibold text-ink-mute"
          >
            Message
            <span className="font-normal text-ink-faint tabular-nums">
              {message.length}/{MAX_BODY}
            </span>
          </label>
          <textarea
            id="broadcast-message"
            value={message}
            maxLength={MAX_BODY}
            rows={3}
            disabled={controlsDisabled}
            onChange={(event) => {
              setMessage(event.target.value);
              invalidateConfirmation();
            }}
            placeholder="Keep it concise—phones may truncate longer messages."
            className="w-full resize-none rounded-xl border border-edge bg-surface px-3.5 py-3 text-sm outline-none placeholder:text-ink-faint focus:border-violet focus:ring-2 focus:ring-violet/25 disabled:opacity-55"
          />
        </div>

        <div>
          <label
            htmlFor="broadcast-destination"
            className="mb-1.5 block text-xs font-semibold text-ink-mute"
          >
            Opens in
          </label>
          <select
            id="broadcast-destination"
            value={url}
            disabled={controlsDisabled}
            onChange={(event) => {
              setUrl(event.target.value);
              invalidateConfirmation();
            }}
            className="w-full rounded-xl border border-edge bg-surface px-3.5 py-3 text-sm outline-none focus:border-violet focus:ring-2 focus:ring-violet/25 disabled:opacity-55"
          >
            {DESTINATIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {(title || message) && (
          <div className="rounded-xl border border-edge bg-surface-2 p-3.5" aria-label="Preview">
            <p className="mb-1.5 text-xs font-semibold text-ink-faint uppercase">Preview</p>
            <p className="truncate text-sm font-semibold">{title || "Title"}</p>
            <p className="mt-0.5 line-clamp-2 text-sm text-ink-dim">
              {message || "Message"}
            </p>
            <p className="mt-2 text-xs text-ink-faint">Opens {selectedDestination.label}</p>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-danger/12 px-3.5 py-2.5 text-sm text-danger">
            {error}
          </p>
        )}
        {result && (
          <p
            role="status"
            aria-live="polite"
            className={cn(
              "rounded-xl px-3.5 py-2.5 text-sm",
              result.tone === "success" && "bg-success/12 text-success",
              result.tone === "warning" && "bg-warn/12 text-warn",
              result.tone === "neutral" && "bg-surface-2 text-ink-dim",
            )}
          >
            {result.message}
          </p>
        )}

        {confirmed ? (
          <div className="rounded-xl border border-warn/40 bg-warn/8 p-4">
            <p className="text-sm font-semibold text-warn">
              Ready to send to {confirmed.recipients}{" "}
              {confirmed.recipients === 1 ? "person" : "people"}.
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-dim">
              Audience: {confirmedSegment?.label} · opens {confirmedDestination?.label}. Push
              notifications cannot be recalled.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-ink-mute">
              We recheck the exact audience when you send. If anyone joined or left, nothing is
              sent until you review it again.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" loading={busy === "send"} onClick={() => void send()}>
                <Send className="size-4" aria-hidden />
                Send notification
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={busy !== null}
                onClick={() => {
                  revision.current += 1;
                  setConfirmed(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            disabled={!valid || busy !== null}
            loading={busy === "count"}
            onClick={() => void checkAudience()}
          >
            <Users className="size-4" aria-hidden />
            Check audience
          </Button>
        )}
      </div>
    </Panel>
  );
}
