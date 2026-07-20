"use client";

import Image from "next/image";
import { BookOpen, History, Moon, Settings2, Share2, Sun } from "lucide-react";
import { Tooltip } from "@/components/tooltip";

export type ThemeMode = "light" | "dark";

export function HypeForgeHeader({
  canShare,
  theme,
  onOpenGuide,
  onOpenHistory,
  onOpenSettings,
  onShare,
  onToggleTheme,
}: {
  canShare: boolean;
  theme: ThemeMode;
  onOpenGuide: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  onShare: () => void;
  onToggleTheme: () => void;
}) {
  const themeLabel = theme === "light" ? "Switch to dark mode" : "Switch to light mode";

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--chrome-bg)] backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-[1500px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center">
          <Image
            alt="HypeForge"
            className="h-9 w-auto shrink-0"
            height={200}
            priority
            src={theme === "dark" ? "/brand/hypeforge-logo-dark.png" : "/brand/hypeforge-logo-light.png"}
            width={620}
          />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Tooltip align="end" className="hidden min-[380px]:inline-flex" label="Compliment guide">
            <button aria-label="Open compliment guide" className="v2-header-button" type="button" onClick={onOpenGuide}>
              <BookOpen aria-hidden="true" className="size-4" />
            </button>
          </Tooltip>
          <Tooltip align="end" label="Saved compliment decks">
            <button aria-label="Open saved compliment decks" className="v2-header-button" type="button" onClick={onOpenHistory}>
              <History aria-hidden="true" className="size-4" />
            </button>
          </Tooltip>
          {canShare ? (
            <Tooltip align="end" label="Create a share link">
              <button aria-label="Share this compliment deck" className="v2-header-button" type="button" onClick={onShare}>
                <Share2 aria-hidden="true" className="size-4" />
              </button>
            </Tooltip>
          ) : null}
          <Tooltip align="end" label={themeLabel}>
            <button aria-label={themeLabel} className="v2-header-button" type="button" onClick={onToggleTheme}>
              {theme === "light" ? <Moon aria-hidden="true" className="size-4" /> : <Sun aria-hidden="true" className="size-4" />}
            </button>
          </Tooltip>
          <Tooltip align="end" label="Open settings">
            <button aria-label="Open settings" className="v2-header-button" type="button" onClick={onOpenSettings}>
              <Settings2 aria-hidden="true" className="size-4" />
            </button>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
