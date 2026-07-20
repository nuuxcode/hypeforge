"use client";

import { useEffect, useState } from "react";
import { sanitizeModelSelection, type ModelSelection } from "./models";

// Per-role Gemini model overrides. Empty selection means "server default" for
// every role, so a fresh visitor sends no override at all.
const STORAGE_KEY = "hypeforge.models";
const CHANGE_EVENT = "hypeforge:models";

export function loadModelSelection(): ModelSelection {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeModelSelection(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

export function saveModelSelection(selection: ModelSelection): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeModelSelection(selection)));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

// Every reader follows the setting live, without prop drilling.
export function useModelSelection(): ModelSelection {
  const [selection, setSelection] = useState<ModelSelection>({});

  useEffect(() => {
    const sync = () => setSelection(loadModelSelection());
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return selection;
}
