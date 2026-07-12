"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "hypeforge.sound-effects";
const CHANGE_EVENT = "hypeforge:sound-effects";

type ForgeSound = "charge" | "complete" | "deck-complete" | "level-up";

let audioContext: AudioContext | null = null;

export function loadSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(STORAGE_KEY) !== "off";
}

export function saveSoundEnabled(enabled: boolean): void {
  window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function useSoundEnabled(): boolean {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    const sync = () => setEnabled(loadSoundEnabled());
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return enabled;
}

function contextForGesture(): AudioContext | null {
  if (typeof window === "undefined" || !loadSoundEnabled()) return null;
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return null;
  audioContext ??= new AudioContextClass();
  void audioContext.resume();
  return audioContext;
}

function tone(context: AudioContext, frequency: number, startsIn: number, duration: number, volume: number): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const start = context.currentTime + startsIn;
  const end = start + duration;

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(end + 0.02);
}

// Tiny synthesized cues keep the interaction tactile without adding an asset,
// network request, or autoplay behavior. The first cue always follows a click.
export function playForgeSound(sound: ForgeSound, level = 1): void {
  const context = contextForGesture();
  if (!context) return;

  if (sound === "charge") {
    tone(context, 246.94, 0, 0.09, 0.025);
    tone(context, 329.63, 0.07, 0.1, 0.022);
    return;
  }

  if (sound === "complete") {
    tone(context, 392, 0, 0.12, 0.028);
    tone(context, 523.25, 0.08, 0.16, 0.025);
    return;
  }

  if (sound === "level-up") {
    const boundedLevel = Math.min(Math.max(level, 1), 6);
    const root = 293.66 * (1 + boundedLevel * 0.045);
    tone(context, root, 0, 0.11, 0.024);
    tone(context, root * 1.25, 0.07, 0.14, 0.025);
    tone(context, root * 1.5, 0.15, boundedLevel === 6 ? 0.28 : 0.2, 0.024);
    if (boundedLevel === 6) tone(context, root * 2, 0.24, 0.3, 0.02);
    return;
  }

  tone(context, 329.63, 0, 0.13, 0.022);
  tone(context, 440, 0.08, 0.15, 0.024);
  tone(context, 659.25, 0.16, 0.2, 0.022);
}
