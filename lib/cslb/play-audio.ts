"use client";

import { cslbAudioUrl } from "@/lib/cslb";

let activeAudio: HTMLAudioElement | null = null;

export function stopCslbQuestionAudio(): void {
  if (typeof window === "undefined") return;
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.removeAttribute("src");
    activeAudio.load();
    activeAudio = null;
  }
  window.speechSynthesis?.cancel();
}

export function playCslbQuestionAudio(questionId: string, textEn: string): void {
  if (typeof window === "undefined") return;
  stopCslbQuestionAudio();

  const audio = new Audio(cslbAudioUrl(questionId));
  activeAudio = audio;
  let usedFallback = false;
  const fallback = () => {
    if (usedFallback || activeAudio !== audio) return;
    usedFallback = true;
    speakEnglish(textEn);
  };
  audio.addEventListener("error", fallback, { once: true });
  const playMp3 = audio.play();
  if (playMp3) {
    playMp3.catch(fallback);
  }
}

function speakEnglish(textEn: string): void {
  if (!textEn.trim() || typeof window === "undefined" || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(textEn.trim());
  utterance.lang = "en-US";
  utterance.rate = 0.92;
  window.speechSynthesis.speak(utterance);
}
