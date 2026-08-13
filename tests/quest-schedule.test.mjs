import assert from "node:assert/strict";
import test from "node:test";
import {
  completionCredit,
  flexibleQuestBelongsOnDay,
  questBelongsOnDay,
  questWasActiveOnDay,
} from "../src/lib/quest-schedule.ts";

test("weekly and monthly quota-closing check-ins remain on the day", () => {
  assert.equal(
    flexibleQuestBelongsOnDay(
      { kind: "times-per-week", times: 1 },
      0,
      true,
    ),
    true,
  );
  assert.equal(
    flexibleQuestBelongsOnDay(
      { kind: "times-per-month", times: 3 },
      2,
      true,
    ),
    true,
  );

  // Once a quota was already complete before today, it stays off the board
  // unless today genuinely has a historical response to show.
  assert.equal(
    flexibleQuestBelongsOnDay(
      { kind: "times-per-week", times: 1 },
      1,
      false,
    ),
    false,
  );
});

test("active periods exclude paused historical gaps without hiding logs", () => {
  const quest = {
    createdAt: "2026-08-01T09:00:00.000Z",
    activePeriods: [
      {
        startedAt: "2026-08-01T09:00:00.000Z",
        endedAt: "2026-08-05T10:00:00.000Z",
      },
      { startedAt: "2026-08-10T08:00:00.000Z" },
    ],
  };

  assert.equal(questWasActiveOnDay(quest, "2026-08-03"), true);
  assert.equal(questWasActiveOnDay(quest, "2026-08-07"), false);
  assert.equal(questWasActiveOnDay(quest, "2026-08-12"), true);
  assert.equal(questBelongsOnDay(quest, "2026-08-07", true), true);
});

test("partial work has exactly half completion credit", () => {
  assert.equal(completionCredit("done"), 1);
  assert.equal(completionCredit("partial"), 0.5);
  assert.equal(completionCredit("skipped"), 0);
  assert.equal(completionCredit(undefined), 0);
});
