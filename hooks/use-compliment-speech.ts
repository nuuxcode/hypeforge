"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useComplimentSpeech(onMessage: (message: string) => void) {
  const [speakingCardId, setSpeakingCardId] = useState<string | null>(null);
  const speechRequest = useRef(0);

  const stopSpeech = useCallback(() => {
    speechRequest.current += 1;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeakingCardId(null);
  }, []);

  const toggleSpeech = useCallback((cardId: string, text: string) => {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      onMessage("Read aloud is not supported in this browser.");
      return;
    }

    const wasSpeaking = speakingCardId === cardId;
    speechRequest.current += 1;
    const request = speechRequest.current;
    window.speechSynthesis.cancel();
    if (wasSpeaking) {
      setSpeakingCardId(null);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.92;
    utterance.pitch = 1.04;
    const preferredVoice = window.speechSynthesis
      .getVoices()
      .find((voice) => voice.lang.toLowerCase().startsWith("en") && voice.localService);
    if (preferredVoice) utterance.voice = preferredVoice;
    utterance.onend = () => {
      if (speechRequest.current === request) setSpeakingCardId(null);
    };
    utterance.onerror = (event) => {
      if (speechRequest.current !== request || event.error === "canceled" || event.error === "interrupted") return;
      console.error("[HypeForge read aloud] Speech synthesis failed", event.error);
      setSpeakingCardId(null);
      onMessage("This device could not read the compliment aloud.");
    };
    setSpeakingCardId(cardId);
    window.speechSynthesis.speak(utterance);
  }, [onMessage, speakingCardId]);

  useEffect(() => () => {
    speechRequest.current += 1;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  return { speakingCardId, stopSpeech, toggleSpeech };
}
