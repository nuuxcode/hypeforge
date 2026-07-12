"use client";

import { useEffect, useState } from "react";

// How the per-card compliance badge words its headline.
// "audited" is the honest default: it splits code-verified checks from
// AI-audited ones. "verified" is the compact classic badge.
export type ProofHeadlineStyle = "audited" | "verified";

const STORAGE_KEY = "hypeforge.proof-headline";
const CHANGE_EVENT = "hypeforge:proof-style";

export function loadProofStyle(): ProofHeadlineStyle {
  if (typeof window === "undefined") return "audited";
  return window.localStorage.getItem(STORAGE_KEY) === "verified" ? "verified" : "audited";
}

export function saveProofStyle(style: ProofHeadlineStyle): void {
  window.localStorage.setItem(STORAGE_KEY, style);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

// Every badge on the page follows the setting live, without prop drilling.
export function useProofStyle(): ProofHeadlineStyle {
  const [style, setStyle] = useState<ProofHeadlineStyle>("audited");

  useEffect(() => {
    const sync = () => setStyle(loadProofStyle());
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return style;
}
