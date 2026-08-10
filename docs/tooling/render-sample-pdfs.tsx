/**
 * Renders both player documents with representative sample data, so their
 * layout can be eyeballed without clicking through onboarding every time.
 *
 * Also renders a "bare" variant — a player who skipped every optional
 * question — because that's the path that actually breaks when copy assumes
 * data exists.
 *
 * Run from the repo root:
 *   npx tsx ./docs/tooling/render-sample-pdfs.tsx ./tmp
 */
import { renderToBuffer } from "@react-pdf/renderer";
import { writeFileSync } from "node:fs";
import { StartingReport } from "@/lib/pdf/starting-report";
import { PromiseLetter } from "@/lib/pdf/promise-letter";
import { buildDomainStates } from "@/lib/game";
import type { DocumentData } from "@/lib/pdf/generate";
import type { Quest, Goal, PlayerProfile } from "@/lib/types";

const startedAt = "2026-07-10T09:00:00.000Z";

const profile: PlayerProfile = {
  displayName: "Dharoun Harou",
  priorities: ["purpose", "health", "peace"],
  baselines: { health: 5, wealth: 4, connections: 6, purpose: 7, growth: 5, peace: 3, fun: 4 },
  visions: {
    purpose: "Shipped the product and made it pay for itself.",
    health: "Sleeping properly and training three times a week.",
    peace: "Not carrying the whole day around in my chest at 11pm.",
  },
  motivationStyle: "coach",
  rhythm: "both",
  dailyMinutes: 45,
  promise:
    "stopped putting myself last, got my sleep back, and finished the thing I keep talking about instead of talking about it.",
  promiseHorizonMonths: 12,
  timezone: "Europe/London",
  createdAt: startedAt,
};

const quests: Quest[] = [
  { id: "q1", domain: "health", title: "Move your body", cadence: { kind: "daily" }, kind: "duration", difficulty: 1, window: "anytime", target: 20, unit: "min", createdAt: startedAt, source: "onboarding" },
  { id: "q2", domain: "health", title: "Lights out on time", cadence: { kind: "daily" }, kind: "binary", difficulty: 2, window: "evening", createdAt: startedAt, source: "onboarding" },
  { id: "q3", domain: "purpose", title: "Deep work on the thing that matters", cadence: { kind: "daily" }, kind: "duration", difficulty: 3, window: "morning", target: 60, unit: "min", createdAt: startedAt, source: "onboarding" },
  { id: "q4", domain: "purpose", title: "Weekly review", cadence: { kind: "times-per-week", times: 1 }, kind: "duration", difficulty: 2, window: "evening", target: 30, unit: "min", createdAt: startedAt, source: "onboarding" },
  { id: "q5", domain: "peace", title: "Sit and breathe", cadence: { kind: "daily" }, kind: "duration", difficulty: 1, window: "morning", target: 5, unit: "min", createdAt: startedAt, source: "onboarding" },
  { id: "q6", domain: "peace", title: "Three good things", cadence: { kind: "daily" }, kind: "binary", difficulty: 1, window: "evening", createdAt: startedAt, source: "onboarding" },
];

const goals: Goal[] = [
  { id: "g1", domain: "purpose", title: "Shipped the product and made it pay for itself.", why: "Your purpose vision from day one.", createdAt: startedAt, source: "onboarding" },
  { id: "g2", domain: "health", title: "Sleeping properly and training three times a week.", why: "Your health vision from day one.", createdAt: startedAt, source: "onboarding" },
];

const data: DocumentData = {
  profile,
  quests,
  goals,
  domains: buildDomainStates(quests, []),
  startedAt,
  generatedAt: new Date().toISOString(),
};

async function main() {
  const out = process.argv[2];

  const report = await renderToBuffer(StartingReport({ data }));
  writeFileSync(`${out}/report.pdf`, report);
  console.log(`report.pdf   ${report.length} bytes`);

  const promise = await renderToBuffer(PromiseLetter({ data }));
  writeFileSync(`${out}/promise.pdf`, promise);
  console.log(`promise.pdf  ${promise.length} bytes`);

  // And the degraded path: someone who skipped the optional questions.
  const bare: DocumentData = {
    ...data,
    profile: { ...profile, promise: undefined, visions: {}, priorities: [] },
    quests: [],
    goals: [],
  };
  const bareReport = await renderToBuffer(StartingReport({ data: bare }));
  writeFileSync(`${out}/report-bare.pdf`, bareReport);
  const barePromise = await renderToBuffer(PromiseLetter({ data: bare }));
  writeFileSync(`${out}/promise-bare.pdf`, barePromise);
  console.log(`bare variants OK (${bareReport.length}, ${barePromise.length} bytes)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
