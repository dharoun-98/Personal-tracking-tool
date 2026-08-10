import { NextResponse } from "next/server";
import {
  MAX_ATTACHMENT_BYTES,
  isPlausibleEmail,
  readEmailConfig,
} from "@/lib/email/config";
import {
  documentEmailHtml,
  documentEmailSubject,
  documentEmailText,
} from "@/lib/email/templates";

/**
 * Emails the player their two documents.
 *
 * The PDFs arrive as base64 from the client, because that is the only place
 * they can be produced: the game history lives in localStorage and never
 * reaches the server. The tradeoff is an unauthenticated endpoint that accepts
 * attachments, so it is rate-limited, size-capped, and refuses anything that
 * isn't a PDF.
 *
 * With no mail provider configured it returns 503 and a clear reason. The UI
 * treats that as "download instead" rather than an error.
 */

export const runtime = "nodejs";

/* -------------------------------------------------------------------- *
 * Rate limiting
 *
 * In-memory and therefore per-instance — good enough to stop casual abuse of
 * a low-traffic endpoint, and honest about what it is. A serious limiter
 * belongs in Stage 3 alongside real accounts.
 * -------------------------------------------------------------------- */

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);

  // Opportunistic cleanup so the map can't grow without bound.
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
    }
  }
  return false;
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

/* -------------------------------------------------------------------- *
 * Payload
 * -------------------------------------------------------------------- */

interface Attachment {
  filename: string;
  content: string;
}

const PDF_MAGIC = "JVBER"; // base64 of "%PDF"

function validAttachment(value: unknown): value is Attachment {
  if (!value || typeof value !== "object") return false;
  const a = value as Record<string, unknown>;
  if (typeof a.filename !== "string" || typeof a.content !== "string") return false;
  if (!a.filename.toLowerCase().endsWith(".pdf")) return false;
  if (!a.content.startsWith(PDF_MAGIC)) return false;
  // base64 inflates by ~4/3; compare against the decoded size.
  if (a.content.length * 0.75 > MAX_ATTACHMENT_BYTES) return false;
  return true;
}

export async function POST(request: Request) {
  const config = readEmailConfig();
  if (!config) {
    return NextResponse.json(
      {
        ok: false,
        reason: "not-configured",
        message:
          "Email isn't switched on for this deployment yet. Your documents are still yours — download them straight from your profile.",
      },
      { status: 503 },
    );
  }

  if (rateLimited(clientKey(request))) {
    return NextResponse.json(
      {
        ok: false,
        reason: "rate-limited",
        message: "That's a few too many sends in a row. Try again in a little while.",
      },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, reason: "bad-request", message: "Malformed request." },
      { status: 400 },
    );
  }

  const {
    email,
    name,
    horizonMonths,
    hasPromise,
    attachments,
  } = (body ?? {}) as Record<string, unknown>;

  if (!isPlausibleEmail(email)) {
    return NextResponse.json(
      {
        ok: false,
        reason: "bad-email",
        message: "That address doesn't look right. Mind checking it?",
      },
      { status: 400 },
    );
  }

  if (
    !Array.isArray(attachments) ||
    attachments.length === 0 ||
    attachments.length > 2 ||
    !attachments.every(validAttachment)
  ) {
    return NextResponse.json(
      {
        ok: false,
        reason: "bad-attachments",
        message: "Those documents didn't come through. Try again from your profile.",
      },
      { status: 400 },
    );
  }

  const input = {
    name: typeof name === "string" && name.trim() ? name.trim().slice(0, 60) : "there",
    horizonMonths: typeof horizonMonths === "number" ? horizonMonths : 12,
    hasPromise: hasPromise === true,
  };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: [email.trim()],
        subject: documentEmailSubject(input),
        text: documentEmailText(input),
        html: documentEmailHtml(input),
        attachments: attachments.map((a) => ({
          filename: a.filename,
          content: a.content,
        })),
      }),
    });

    if (!response.ok) {
      // Never surface the provider's raw response — it can echo the API key
      // back in some failure modes.
      const detail = await response.text().catch(() => "");
      console.error("Resend send failed", response.status, detail.slice(0, 300));
      return NextResponse.json(
        {
          ok: false,
          reason: "provider-error",
          message: "The mail provider turned that down. Download them instead?",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Resend send threw", error);
    return NextResponse.json(
      {
        ok: false,
        reason: "network",
        message: "Couldn't reach the mail provider. Your documents are still downloadable.",
      },
      { status: 502 },
    );
  }
}

/** Lets the UI hide the email option entirely when nothing is configured. */
export async function GET() {
  return NextResponse.json({ configured: readEmailConfig() !== null });
}
