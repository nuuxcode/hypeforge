"use client";

import { ArrowUpRight, BookOpen, History, RotateCcw, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Tooltip } from "@/components/tooltip";
import type { DeckHistoryEntry } from "@/lib/deck-history";
import { useDialogFocus } from "@/lib/use-dialog-focus";

function matchesQuery(entry: DeckHistoryEntry, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const searchable = [
    entry.input,
    ...entry.cards.flatMap((card) => [card.personaName, card.text, ...card.history, ...(card.versions?.map((version) => version.text) ?? [])]),
  ]
    .join(" ")
    .toLowerCase();
  return searchable.includes(needle);
}

function timeLabel(value: string): string {
  const time = Date.parse(value);
  if (Number.isNaN(time)) return "Saved deck";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(time);
}

export function DeckHistoryDrawer({
  open,
  entries,
  tasteSignalCount,
  onClose,
  onRestore,
  onDelete,
  onClear,
  onResetTaste,
  onOpenGuide,
}: {
  open: boolean;
  entries: DeckHistoryEntry[];
  tasteSignalCount: number;
  onClose: () => void;
  onRestore: (entry: DeckHistoryEntry) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onResetTaste: () => void;
  onOpenGuide: () => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => entries.filter((entry) => matchesQuery(entry, query)), [entries, query]);
  const dialogRef = useDialogFocus<HTMLElement>(open, onClose);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-label="Saved compliment decks" aria-modal="true">
      <button
        aria-label="Close saved decks"
        className="absolute inset-0 cursor-default bg-[#141118]/35 backdrop-blur-[2px]"
        type="button"
        onClick={onClose}
      />
      <aside
        aria-labelledby="saved-decks-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-[var(--line)] bg-[var(--bg)] shadow-2xl shadow-black/20"
        ref={dialogRef}
        tabIndex={-1}
      >
        <header className="flex items-center justify-between gap-4 border-b border-[var(--line)] px-5 py-4">
          <div>
            <p className="v2-mono text-[0.68rem] uppercase text-[var(--purple-soft)]">Private workspace</p>
            <h2 className="v2-display mt-1 text-xl font-semibold text-[var(--text)]" id="saved-decks-title">Saved compliment decks</h2>
          </div>
          <Tooltip align="end" label="Close saved decks">
            <button
              aria-label="Close saved decks"
              className="grid size-10 place-items-center rounded-[14px] border border-[var(--line)] bg-[var(--control-bg)] text-[var(--text)] transition hover:bg-[var(--control-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8b5cf6]/35"
              type="button"
              onClick={onClose}
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </Tooltip>
        </header>

        <div className="border-b border-[var(--line)] p-4">
          <label className="sr-only" htmlFor="deck-history-search">
            Search saved decks
          </label>
          <div className="flex items-center gap-2 rounded-[14px] border border-[var(--line)] bg-[var(--input-bg)] px-3">
            <Search aria-hidden="true" className="size-4 text-[var(--text-faint)]" />
            <input
              className="min-h-11 w-full bg-transparent text-sm font-semibold text-[var(--text)] outline-none placeholder:text-[var(--text-faint)]"
              id="deck-history-search"
              placeholder="Search people, personas, or wording"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-[14px] border border-[var(--line)] bg-[var(--control-bg)] px-3 py-2">
            <p className="text-xs font-semibold leading-5 text-[var(--text-muted)]">
              {tasteSignalCount > 0
                ? `${tasteSignalCount} taste signals guide future decks lightly.`
                : "Vote on cards to teach the forge your taste."}
            </p>
            <button
              className="shrink-0 text-xs font-bold text-[var(--coral)] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={tasteSignalCount === 0}
              type="button"
              onClick={onResetTaste}
            >
              Reset taste
            </button>
          </div>
          <button
            className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-[12px] px-2 text-xs font-bold text-[var(--text)] transition hover:bg-[var(--control-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8b5cf6]/35"
            type="button"
            onClick={onOpenGuide}
          >
            <BookOpen aria-hidden="true" className="size-4 text-[var(--purple)]" />
            Compliment guide
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="grid min-h-52 place-items-center rounded-[20px] border border-dashed border-[var(--line)] bg-[var(--panel-raised)] p-6 text-center">
              <div>
                <History aria-hidden="true" className="mx-auto size-5 text-[var(--purple)]" />
                <p className="v2-display mt-3 text-base font-semibold text-[var(--text)]">
                  {entries.length === 0 ? "No decks saved yet." : "No saved deck matches that search."}
                </p>
                <p className="mt-1 text-sm font-medium text-[var(--text-muted)]">
                  Generate a deck and every version stays available here.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((entry) => (
                <article
                  className="group relative rounded-[18px] border border-[var(--line)] bg-[var(--panel-raised)] p-4 pr-12 transition hover:-translate-y-0.5 hover:border-[var(--purple)] hover:bg-[var(--control-hover)] hover:shadow-lg hover:shadow-black/10 focus-within:border-[var(--purple)] focus-within:shadow-lg focus-within:shadow-black/10"
                  key={entry.id}
                >
                  <button
                    aria-label={`Open saved deck for ${entry.input}`}
                    className="block w-full cursor-pointer rounded-[12px] text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8b5cf6]/35"
                    type="button"
                    onClick={() => onRestore(entry)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="v2-display line-clamp-2 text-base font-semibold text-[var(--text)]">{entry.input}</p>
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[var(--purple)] transition group-hover:translate-x-0.5">
                        Open
                        <ArrowUpRight aria-hidden="true" className="size-3.5" />
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-bold text-[var(--text-faint)]">
                      {entry.cards.length} voices · {timeLabel(entry.updatedAt)}
                    </p>
                    <p className="mt-3 line-clamp-2 text-sm font-medium leading-5 text-[var(--text-muted)]">
                      {entry.cards.map((card) => card.personaName).join(" · ")}
                    </p>
                  </button>
                  <Tooltip align="end" className="absolute right-3 top-3" label="Delete saved deck">
                    <button
                      aria-label={`Delete saved deck for ${entry.input}`}
                      className="grid size-9 place-items-center rounded-[12px] text-[var(--text-faint)] transition hover:bg-[#ff6b5f]/10 hover:text-[var(--coral)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8b5cf6]/35"
                      type="button"
                      onClick={() => onDelete(entry.id)}
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </button>
                  </Tooltip>
                </article>
              ))}
            </div>
          )}
        </div>

        {entries.length > 0 ? (
          <footer className="border-t border-[var(--line)] p-4">
            <button
              className="inline-flex min-h-11 items-center gap-2 rounded-[14px] border border-[#ff6b5f]/35 px-4 text-sm font-bold text-[var(--coral)] transition hover:bg-[#ff6b5f]/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8b5cf6]/35"
              type="button"
              onClick={onClear}
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              Clear saved decks
            </button>
          </footer>
        ) : null}
      </aside>
    </div>
  );
}
