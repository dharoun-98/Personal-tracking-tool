"use client";

import { useState } from "react";
import { Check, Download, Share, SquarePlus } from "lucide-react";
import { usePwa } from "@/lib/pwa";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";

/**
 * Install-to-home-screen card.
 *
 * Three genuinely different paths: Chromium fires a prompt we can trigger,
 * iOS has no such API and needs illustrated manual steps, and an already
 * installed app should be told so rather than nagged again.
 */
export function InstallCard() {
  const { installable, standalone, platform, install } = usePwa();
  const [result, setResult] = useState<"accepted" | "dismissed" | null>(null);

  if (standalone) {
    return (
      <Panel className="border-success/30 bg-success/8 p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-success/15 text-success">
            <Check className="size-4.5" strokeWidth={2.5} />
          </span>
          <div>
            <p className="text-sm font-semibold text-success">Installed</p>
            <p className="text-2xs text-ink-mute">
              You&apos;re running the app version. Nice.
            </p>
          </div>
        </div>
      </Panel>
    );
  }

  if (platform === "ios") {
    return (
      <Panel className="p-4">
        <p className="text-sm font-semibold">Add to your home screen</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-mute">
          iOS doesn&apos;t let apps install themselves, so it takes two taps in Safari:
        </p>
        <ol className="mt-3 space-y-2.5 text-xs text-ink-dim">
          <li className="flex items-center gap-2.5">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-cyan">
              <Share className="size-3.5" />
            </span>
            Tap the Share button in the toolbar
          </li>
          <li className="flex items-center gap-2.5">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-cyan">
              <SquarePlus className="size-3.5" />
            </span>
            Choose &ldquo;Add to Home Screen&rdquo;
          </li>
        </ol>
      </Panel>
    );
  }

  return (
    <Panel className="p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet/15 text-violet-soft">
          <Download className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Install the app</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-mute">
            Full screen, works offline, opens instantly from your home screen or dock.
          </p>
          {installable ? (
            <Button
              size="sm"
              className="mt-3"
              onClick={async () => setResult(await install() as "accepted" | "dismissed")}
            >
              Install
            </Button>
          ) : (
            <p className="mt-2.5 text-2xs text-ink-faint">
              {result === "dismissed"
                ? "No problem — the option stays in your browser menu."
                : "Your browser will offer this once you've visited a couple of times, or you can use its Install option directly."}
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}
