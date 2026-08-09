"use client";

import { create } from "zustand";

/** The non-standard event Chromium fires when a site becomes installable. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type Platform = "ios" | "android" | "desktop" | "unknown";

interface PwaState {
  /** Chromium install prompt, held until the player asks to install. */
  deferredPrompt: BeforeInstallPromptEvent | null;
  installable: boolean;
  /** True when running from the home screen rather than a browser tab. */
  standalone: boolean;
  platform: Platform;
  swReady: boolean;
  /** A new version is waiting to take over. */
  updateReady: boolean;
  setPrompt: (e: BeforeInstallPromptEvent | null) => void;
  setStandalone: (v: boolean) => void;
  setPlatform: (p: Platform) => void;
  setSwReady: (v: boolean) => void;
  setUpdateReady: (v: boolean) => void;
  install: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

export const usePwa = create<PwaState>((set, get) => ({
  deferredPrompt: null,
  installable: false,
  standalone: false,
  platform: "unknown",
  swReady: false,
  updateReady: false,
  setPrompt: (e) => set({ deferredPrompt: e, installable: !!e }),
  setStandalone: (v) => set({ standalone: v }),
  setPlatform: (p) => set({ platform: p }),
  setSwReady: (v) => set({ swReady: v }),
  setUpdateReady: (v) => set({ updateReady: v }),
  install: async () => {
    const prompt = get().deferredPrompt;
    if (!prompt) return "unavailable";
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    // The event can only be used once.
    set({ deferredPrompt: null, installable: false });
    return outcome;
  },
}));

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports as a Mac; the touch-point count gives it away.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (iOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Mobi/i.test(ua)) return "unknown";
  return "desktop";
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari's proprietary flag for home-screen apps.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
