"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Pause, Pencil, RotateCcw } from "lucide-react";
import { cadenceLabel, difficultyLabel } from "@/lib/format";
import { useGame } from "@/lib/store";
import type { Quest } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

/**
 * The small management surface below a domain's day-to-day view.
 *
 * Pausing uses the store's archive flag: the quest leaves the schedule while
 * every existing check-in remains part of the player's history. We use the
 * friendlier word in the UI and explain the consequence before it happens.
 */
export function QuestManagement({ quests }: { quests: Quest[] }) {
  const updateQuest = useGame((state) => state.updateQuest);
  const archiveQuest = useGame((state) => state.archiveQuest);
  const restoreQuest = useGame((state) => state.restoreQuest);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingPauseId, setConfirmingPauseId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const editTriggers = useRef(new Map<string, HTMLButtonElement>());
  const pauseTriggers = useRef(new Map<string, HTMLButtonElement>());
  const pauseConfirmButtons = useRef(new Map<string, HTMLButtonElement>());
  const messageRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!confirmingPauseId) return;
    requestAnimationFrame(() => pauseConfirmButtons.current.get(confirmingPauseId)?.focus());
  }, [confirmingPauseId]);

  const restoreTriggerFocus = (kind: "edit" | "pause", questId: string) => {
    requestAnimationFrame(() =>
      (kind === "edit" ? editTriggers : pauseTriggers).current.get(questId)?.focus(),
    );
  };

  const active = quests.filter((quest) => !quest.archivedAt);
  const paused = quests.filter((quest) => !!quest.archivedAt);

  const beginEditing = (quest: Quest) => {
    setConfirmingPauseId(null);
    setEditingId((current) => (current === quest.id ? null : quest.id));
    setMessage(null);
  };

  const beginPause = (quest: Quest) => {
    setEditingId(null);
    setConfirmingPauseId((current) => (current === quest.id ? null : quest.id));
    setMessage(null);
  };

  return (
    <div className="space-y-4">
      {message && (
        <p
          ref={messageRef}
          role="status"
          tabIndex={-1}
          className="px-1 text-xs font-medium text-success outline-none"
        >
          {message}
        </p>
      )}

      {active.length > 0 ? (
        <Panel className="divide-y divide-hairline/60 overflow-hidden">
          {active.map((quest) => {
            const editing = editingId === quest.id;
            const confirmingPause = confirmingPauseId === quest.id;

            return (
              <div key={quest.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{quest.title}</p>
                    <p className="mt-1 text-xs text-ink-mute">
                      {cadenceLabel(quest.cadence)} · {difficultyLabel(quest.difficulty)}
                    </p>
                    {quest.detail && !editing && (
                      <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">
                        {quest.detail}
                      </p>
                    )}
                  </div>
                </div>

                {!editing && !confirmingPause && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      ref={(node) => {
                        if (node) editTriggers.current.set(quest.id, node);
                        else editTriggers.current.delete(quest.id);
                      }}
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="min-h-11"
                      aria-expanded={editing}
                      onClick={() => beginEditing(quest)}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                      Edit
                    </Button>
                    <Button
                      ref={(node) => {
                        if (node) pauseTriggers.current.set(quest.id, node);
                        else pauseTriggers.current.delete(quest.id);
                      }}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="min-h-11"
                      aria-expanded={confirmingPause}
                      onClick={() => beginPause(quest)}
                    >
                      <Pause className="size-3.5" aria-hidden />
                      Pause
                    </Button>
                  </div>
                )}

                {editing && (
                  <QuestEditor
                    quest={quest}
                    onCancel={() => {
                      setEditingId(null);
                      restoreTriggerFocus("edit", quest.id);
                    }}
                    onSave={(patch) => {
                      updateQuest(quest.id, patch);
                      setEditingId(null);
                      setMessage(`Saved “${patch.title}”.`);
                      restoreTriggerFocus("edit", quest.id);
                    }}
                  />
                )}

                {confirmingPause && (
                  <div className="mt-3 rounded-2xl border border-warn/35 bg-warn/8 p-3.5">
                    <p className="text-sm font-semibold text-warn">Pause this quest?</p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-dim">
                      It will leave your board and schedule. All past check-ins stay in
                      your history, and you can restore it below at any time.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        ref={(node) => {
                          if (node) pauseConfirmButtons.current.set(quest.id, node);
                          else pauseConfirmButtons.current.delete(quest.id);
                        }}
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="min-h-11"
                        onClick={() => {
                          archiveQuest(quest.id);
                          setConfirmingPauseId(null);
                          setMessage(`Paused “${quest.title}”.`);
                          requestAnimationFrame(() => messageRef.current?.focus());
                        }}
                      >
                        Pause quest
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-11"
                        onClick={() => {
                          setConfirmingPauseId(null);
                          restoreTriggerFocus("pause", quest.id);
                        }}
                      >
                        Keep active
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </Panel>
      ) : (
        <Panel className="p-4">
          <p className="text-sm font-medium">No active quests here.</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-mute">
            Add a new one, or restore a paused quest below.
          </p>
        </Panel>
      )}

      {paused.length > 0 && (
        <div>
          <h3 className="mb-2 px-1 text-xs font-semibold tracking-[0.12em] text-ink-mute uppercase">
            Paused · {paused.length}
          </h3>
          <Panel className="divide-y divide-hairline/60 overflow-hidden">
            {paused.map((quest) => (
              <div key={quest.id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink-dim">{quest.title}</p>
                  <p className="mt-1 text-xs text-ink-faint">
                    {cadenceLabel(quest.cadence)} · History kept
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="min-h-11 shrink-0"
                  onClick={() => {
                    restoreQuest(quest.id);
                    setMessage(`Restored “${quest.title}”.`);
                  }}
                >
                  <RotateCcw className="size-3.5" aria-hidden />
                  Restore
                </Button>
              </div>
            ))}
          </Panel>
        </div>
      )}
    </div>
  );
}

function QuestEditor({
  quest,
  onSave,
  onCancel,
}: {
  quest: Quest;
  onSave: (patch: Pick<Quest, "title" | "detail">) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [title, setTitle] = useState(quest.title);
  const [detail, setDetail] = useState(quest.detail ?? "");

  return (
    <form
      className="mt-4 space-y-3 border-t border-hairline/60 pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        const cleanTitle = title.trim();
        if (!cleanTitle) return;
        onSave({
          title: cleanTitle,
          detail: detail.trim() || undefined,
        });
      }}
    >
      <div>
        <label htmlFor={`${id}-title`} className="mb-1.5 block text-xs font-medium text-ink-mute">
          Quest name
        </label>
        <input
          id={`${id}-title`}
          autoFocus
          required
          maxLength={80}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full rounded-xl border border-edge bg-sunken px-3.5 py-3 text-sm outline-none placeholder:text-ink-faint focus-visible:border-violet focus-visible:ring-2 focus-visible:ring-violet/25"
        />
      </div>

      <div>
        <label htmlFor={`${id}-detail`} className="mb-1.5 block text-xs font-medium text-ink-mute">
          Why it matters <span className="text-ink-faint">(optional)</span>
        </label>
        <textarea
          id={`${id}-detail`}
          rows={2}
          maxLength={140}
          value={detail}
          onChange={(event) => setDetail(event.target.value)}
          className="w-full resize-none rounded-xl border border-edge bg-sunken px-3.5 py-3 text-sm outline-none placeholder:text-ink-faint focus-visible:border-violet focus-visible:ring-2 focus-visible:ring-violet/25"
        />
      </div>

      <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-xs leading-relaxed text-ink-mute">
        Schedule: <span className="font-semibold text-ink">{cadenceLabel(quest.cadence)}</span>.
        To change it without rewriting past trends, pause this quest and add a new one.
      </p>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="submit" size="sm" className="min-h-11" disabled={!title.trim()}>
          Save changes
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
