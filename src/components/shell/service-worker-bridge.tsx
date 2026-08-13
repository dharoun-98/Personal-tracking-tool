"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import {
  detectPlatform,
  isStandalone,
  usePwa,
  type BeforeInstallPromptEvent,
} from "@/lib/pwa";
import { Button } from "@/components/ui/button";

/**
 * Registers the service worker and wires up install/update signals.
 *
 * Renders nothing — it exists so the rest of the tree can stay server-rendered
 * while still getting PWA behaviour.
 */
export function ServiceWorkerBridge() {
  const {
    updateReady,
    setPrompt,
    setStandalone,
    setPlatform,
    setSwReady,
    setUpdateReady,
  } = usePwa();

  useEffect(() => {
    setPlatform(detectPlatform());
    setStandalone(isStandalone());

    const onInstallPrompt = (e: Event) => {
      // Suppressing the default lets us choose our own moment to ask.
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setPrompt(null);
      setStandalone(true);
    };
    const displayQuery = window.matchMedia("(display-mode: standalone)");
    const onDisplayChange = () => setStandalone(isStandalone());

    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    displayQuery.addEventListener("change", onDisplayChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      displayQuery.removeEventListener("change", onDisplayChange);
    };
  }, [setPrompt, setStandalone, setPlatform]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Dev builds change on every save; a cached shell just gets in the way.
    if (process.env.NODE_ENV !== "production") return;

    let cancelled = false;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        if (cancelled) return;
        setSwReady(true);

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              setUpdateReady(true);
            }
          });
        });
      })
      .catch(() => {
        // A failed registration must never break the app — it just means no
        // offline support on this device.
        setSwReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, [setSwReady, setUpdateReady]);

  if (!updateReady) return null;

  return (
    <aside
      className="panel-glass fixed right-4 bottom-[calc(var(--nav-h)+var(--safe-bottom)+1rem)] z-[90] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl p-3 shadow-lg md:bottom-6"
      aria-live="polite"
      aria-label="App update available"
    >
      <p className="min-w-0 text-xs leading-snug text-ink-mute">
        <span className="block font-semibold text-ink">A fresh version is ready</span>
        Refresh when you&apos;re ready.
      </p>
      <Button size="sm" onClick={() => window.location.reload()}>
        <RefreshCw className="size-3.5" aria-hidden />
        Refresh
      </Button>
    </aside>
  );
}
