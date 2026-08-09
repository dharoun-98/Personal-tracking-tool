"use client";

import { useSyncExternalStore } from "react";

/* ==================================================================== *
 * A shared clock.
 *
 * Time is an external system, so it's modelled as one rather than as state
 * poked from an effect. That keeps render pure (no `Date.now()` mid-render),
 * avoids a cascading re-render on mount, and means every subscriber ticks
 * together instead of each running its own drifting interval.
 * ==================================================================== */

const TICK_MS = 60_000;

let current = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function emit() {
  const next = Date.now();
  // Only notify when the minute actually changed; setInterval can fire early.
  if (next - current < 1000) return;
  current = next;
  for (const listener of listeners) listener();
}

function onVisibilityChange() {
  // A backgrounded tab can wake hours later — resync immediately rather than
  // waiting out the remainder of the interval.
  if (document.visibilityState === "visible") emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  if (timer === null) {
    current = Date.now();
    timer = setInterval(emit, TICK_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
  };
}

/** Must return a stable value between ticks, or React will loop forever. */
function getSnapshot(): number {
  return current;
}

/** The server has no clock we can agree on; callers treat 0 as "unknown". */
function getServerSnapshot(): number {
  return 0;
}

/**
 * Current time, updated about once a minute.
 *
 * Returns `null` on the server and until the first client tick, so callers
 * can render a neutral placeholder rather than a value that would differ
 * between the server HTML and the first client render.
 */
export function useNow(): Date | null {
  const timestamp = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return timestamp === 0 ? null : new Date(timestamp);
}

/** Milliseconds since the epoch, or 0 before the first tick. */
export function useNowMs(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
