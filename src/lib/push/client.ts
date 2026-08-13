"use client";

/* ==================================================================== *
 * Browser side of push.
 *
 * Three platform realities shape everything here:
 *
 *  1. iOS only delivers push to a PWA installed to the Home Screen. Safari
 *     tabs get nothing, and `Notification` isn't even defined there. So the
 *     UI has to detect that and ask people to install first, rather than
 *     showing a button that silently does nothing.
 *  2. `Notification.requestPermission()` must be called from a user gesture.
 *  3. Once denied, the prompt cannot be shown again from JavaScript — the
 *     player has to change it in browser settings. Asking at the wrong moment
 *     doesn't just fail, it burns the only chance.
 * ==================================================================== */

export type PushSupport =
  | "ready"
  /** Installed-PWA-only platform, currently running in a browser tab. */
  | "needs-install"
  /** Browser has no Push API at all. */
  | "unsupported"
  /** Blocked by the player; only recoverable in browser settings. */
  | "denied";

export function detectSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";

  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  const hasApi =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  if (!hasApi) {
    // iOS exposes none of this in a tab but all of it once installed, so the
    // honest answer there is "install first", not "unsupported".
    const ua = navigator.userAgent;
    const iOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    return iOS && !standalone ? "needs-install" : "unsupported";
  }

  if (Notification.permission === "denied") return "denied";
  return "ready";
}

/**
 * VAPID keys travel as base64url; PushManager wants raw bytes.
 *
 * Backed by an explicit ArrayBuffer so the result is `Uint8Array<ArrayBuffer>`.
 * Since TypeScript 5.7 the typed arrays are generic over their buffer, and
 * `BufferSource` won't accept one that might be backed by a SharedArrayBuffer.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export interface EnableResult {
  ok: boolean;
  reason?: "denied" | "dismissed" | "no-key" | "failed" | "no-worker";
  message?: string;
}

/**
 * Asks for permission and registers a subscription.
 *
 * Must be called directly from a click handler — browsers reject
 * `requestPermission` from anywhere else.
 */
export async function enablePush(): Promise<EnableResult> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return { ok: false, reason: "no-key", message: "Notifications aren't configured yet." };
  }

  const permission = await Notification.requestPermission();
  if (permission === "denied") {
    return {
      ok: false,
      reason: "denied",
      message:
        "Notifications are blocked for this site. You can re-allow them in your browser's site settings.",
    };
  }
  if (permission !== "granted") {
    return { ok: false, reason: "dismissed", message: "No problem — maybe later." };
  }

  const registration = await navigator.serviceWorker.ready.catch(() => null);
  if (!registration) {
    return {
      ok: false,
      reason: "no-worker",
      message: "The offline worker isn't running yet. Reload and try again.",
    };
  }

  try {
    // Reuse an existing subscription if there is one; calling subscribe twice
    // with different keys throws rather than replacing.
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));

    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      return { ok: false, reason: "failed", message: result.message ?? "Couldn't register." };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: "failed",
      message: error instanceof Error ? error.message : "Couldn't subscribe.",
    };
  }
}

/** Unsubscribes this device and tells the server to forget it. */
export async function disablePush(): Promise<void> {
  const registration = await navigator.serviceWorker.ready.catch(() => null);
  const subscription = await registration?.pushManager.getSubscription();

  if (subscription) {
    const response = await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.message ?? "The server could not turn notifications off.");
    }
    await subscription.unsubscribe().catch(() => {});
  } else {
    const response = await fetch("/api/push/subscribe", { method: "DELETE" });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.message ?? "The server could not turn notifications off.");
    }
  }
}

/** Whether this device currently holds a subscription. */
export async function isSubscribed(): Promise<boolean> {
  if (detectSupport() !== "ready") return false;
  const registration = await navigator.serviceWorker.ready.catch(() => null);
  if (!registration) return false;
  return !!(await registration.pushManager.getSubscription());
}
