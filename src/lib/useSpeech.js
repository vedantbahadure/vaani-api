import { useCallback, useRef, useState, useEffect } from "react";
import { speak } from "./api";
import { sfx } from "./sound";
import { speechNormalize } from "./nlp";
import { toast } from "sonner";

// Centralised Text-To-Speech (TTS) engine:
// 1. Primary: High-fidelity Gemini Neural TTS ('gemini-3.1-flash-tts-preview') with voices (Kore, Puck, etc.)
// 2. Secondary Fallback: Browser Web SpeechSynthesis API for 100% offline/resilient playback
// 3. Word/Progress tracking for real-time visual synchronisation
export function useSpeech() {
  const [playingId, setPlayingId] = useState(null);
  const [progress, setProgress] = useState(0);
  const [voiceName, setVoiceName] = useState(() => localStorage.getItem("vaani-voice-name") || "Kore");
  const audioRef = useRef(null);
  const rafRef = useRef(0);
  const urlRef = useRef(null);
  const isSpeechSynthesisRef = useRef(false);

  const cleanup = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {}
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    if (isSpeechSynthesisRef.current && typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
      isSpeechSynthesisRef.current = false;
    }
  }, []);

  const stop = useCallback(() => {
    cleanup();
    setPlayingId(null);
    setProgress(0);
  }, [cleanup]);

  useEffect(() => () => cleanup(), [cleanup]);

  const setVoice = useCallback((newVoice) => {
    setVoiceName(newVoice);
    localStorage.setItem("vaani-voice-name", newVoice);
  }, []);

  const playWithWebSpeech = useCallback((spokenText, id, lang) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("Text-to-speech not supported in this browser");
      stop();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      isSpeechSynthesisRef.current = true;
      const utterance = new SpeechSynthesisUtterance(spokenText);

      // Match language tag
      if (lang === "mr") utterance.lang = "mr-IN";
      else if (lang === "hi") utterance.lang = "hi-IN";
      else utterance.lang = "en-IN";

      const voices = window.speechSynthesis.getVoices?.() || [];
      const matched = voices.find(
        (v) =>
          v.lang.toLowerCase().replace("_", "-").startsWith(utterance.lang.toLowerCase()) ||
          v.lang.toLowerCase().includes(lang)
      );
      if (matched) {
        utterance.voice = matched;
      }

      utterance.rate = 0.95;
      utterance.pitch = 1.0;

      utterance.onboundary = (e) => {
        if (e.charIndex && spokenText.length > 0) {
          setProgress(Math.min(0.999, e.charIndex / spokenText.length));
        }
      };

      utterance.onend = () => {
        sfx.tap();
        stop();
      };

      utterance.onerror = (err) => {
        if (err.error !== "canceled" && err.error !== "interrupted") {
          toast.error("Speech playback error");
        }
        stop();
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      toast.error("Could not play synthesized speech");
      stop();
    }
  }, [stop]);

  const play = useCallback(
    async (text, id, lang = "en", customVoice = null) => {
      if (playingId === id) {
        stop();
        return;
      }
      stop();
      const spoken = speechNormalize(text, lang);
      if (!spoken) return;

      setPlayingId(id);
      setProgress(0.0001);

      const activeVoice = customVoice || voiceName || "Kore";

      try {
        // Attempt Gemini Neural TTS
        const url = await speak(spoken, activeVoice);
        urlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;

        const tick = () => {
          if (!audioRef.current) return;
          const d = audio.duration || 1;
          setProgress(Math.min(0.999, audio.currentTime / d));
          rafRef.current = requestAnimationFrame(tick);
        };

        audio.onplay = () => {
          rafRef.current = requestAnimationFrame(tick);
        };
        audio.onended = () => {
          sfx.tap();
          stop();
        };
        audio.onerror = () => {
          // Fallback to Web Speech API if audio decoding/playback fails
          playWithWebSpeech(spoken, id, lang);
        };

        await audio.play();
      } catch (err) {
        // Fallback to Web Speech Synthesis on server error or offline
        playWithWebSpeech(spoken, id, lang);
      }
    },
    [playingId, stop, voiceName, playWithWebSpeech]
  );

  return { play, stop, playingId, progress, voiceName, setVoice };
}
