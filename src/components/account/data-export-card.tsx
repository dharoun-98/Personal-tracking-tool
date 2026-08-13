"use client";

import { useState } from "react";
import { Check, Database, Download } from "lucide-react";
import { useGame, useHydrated } from "@/lib/store";
import { THEME_STORAGE_KEY, type ThemePreference } from "@/lib/theme";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";

type ExportState = "idle" | "done" | "error";

/**
 * Downloads the complete portable copy of the data held by this device.
 *
 * This intentionally reads the store only when the player presses Export.
 * Apart from avoiding needless rerenders, that guarantees the file represents
 * one coherent instant rather than a mixture of values captured across hooks.
 * Authentication tokens never live in this store and are therefore never part
 * of the file.
 */
export function DataExportCard() {
  const hydrated = useHydrated();
  const [state, setState] = useState<ExportState>("idle");

  const download = () => {
    setState("idle");

    try {
      const local = useGame.getState();
      const exportedAt = new Date();
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      const themePreference: ThemePreference =
        storedTheme === "light" || storedTheme === "dark" || storedTheme === "system"
          ? storedTheme
          : "system";
      const payload = {
        format: "lifequest-local-data",
        schemaVersion: 1,
        appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? null,
        exportedAt: exportedAt.toISOString(),
        data: {
          profile: local.profile,
          quests: local.quests,
          logs: local.logs,
          goals: local.goals,
          reflections: local.reflections,
          unlocked: local.unlocked,
          coachCooldowns: local.coachCooldowns,
          account: local.account,
          sync: local.sync,
          revision: local.revision,
          onboardingComplete: local.onboardingComplete,
          lastSeenAt: local.lastSeenAt,
          reportsGeneratedAt: local.reportsGeneratedAt,
          themePreference,
        },
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `lifequest-data-${exportedAt.toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setState("done");
    } catch {
      setState("error");
    }
  };

  return (
    <Panel className="p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-cyan/15 text-cyan-ink">
          <Database className="size-4.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Export all data</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-mute">
            Download every quest, check-in, goal, reflection, preference and
            achievement stored on this device as a readable JSON file.
          </p>
          <p className="mt-1.5 text-2xs leading-relaxed text-ink-faint">
            The file can contain private information. Keep it somewhere you trust.
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-3"
            disabled={!hydrated}
            onClick={download}
          >
            {state === "done" ? (
              <Check className="size-3.5" aria-hidden />
            ) : (
              <Download className="size-3.5" aria-hidden />
            )}
            {state === "done" ? "Downloaded" : "Download JSON"}
          </Button>
          <p
            className={state === "error" ? "mt-2 text-2xs text-danger" : "sr-only"}
            role={state === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {state === "error"
              ? "The export could not be created. Try again."
              : state === "done"
                ? "Your Lifequest data export was downloaded."
                : ""}
          </p>
        </div>
      </div>
    </Panel>
  );
}
