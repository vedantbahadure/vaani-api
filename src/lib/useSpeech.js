import { useCallback, useRef, useState, useEffect } from "react";
import { speak } from "./api";
import { sfx } from "./sound";
import { speechNormalize } from "./nlp";
import { toast } from "sonner";
import {
  speakWebSpeech,
  createStreamingSpeechSession,
  stopWebSpeech,
  pauseWebSpeech,
  resumeWebSpeech,
  isWebSpeechSupported,
  getWebSpeechVoices,
  getBestVoiceForLanguage,
} from "./webSpeech";

/**
 * Enhanced useSpeech Hook:
 * Integrates zero-latency streaming TTS, auto-speak modes, sentence-by-sentence skip/replay,
 * and high-intelligibility rural voice synthesis in Marathi, Hindi, and English.
 */
export function useSpeech() {
  const [playingId, setPlayingId] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentSentence, setCurrentSentence] = useState("");
  const [sentenceInfo, setSentenceInfo] = useState({ text: "", index: 0, total: 0 });
  const [rate, setRateState] = useState(() => {
    const saved = localStorage.getItem("vaani-speech-rate");
    return saved ? parseFloat(saved) : 1.0;
  });
  const [pitch, setPitchState] = useState(() => {
    const saved = localStorage.getItem("vaani-speech-pitch");
    return saved ? parseFloat(saved) : 1.0;
  });
  const [engine, setEngineState] = useState(() => {
    return localStorage.getItem("vaani-tts-engine") || "webspeech";
  });
  const [selectedVoiceURI, setSelectedVoiceURI] = useState(() => {
    return localStorage.getItem("vaani-webspeech-voice") || "";
  });
  const [voiceName, setVoiceName] = useState(() => {
    return localStorage.getItem("vaani-voice-name") || "Kore";
  });
  const [autoSpeakMode, setAutoSpeakModeState] = useState(() => {
    // Check old or new key: "always" | "voice_only" | "off"
    const savedMode = localStorage.getItem("vaani-auto-speak-mode");
    if (savedMode) return savedMode;
    const oldReply = localStorage.getItem("vaani-voice-reply");
    if (oldReply === "0") return "off";
    return "always";
  });

  const [availableVoices, setAvailableVoices] = useState([]);

  const audioRef = useRef(null);
  const rafRef = useRef(0);
  const urlRef = useRef(null);
  const activeControllerRef = useRef(null);
  const activeStreamSessionRef = useRef(null);

  // Load browser voices on mount
  useEffect(() => {
    if (typeof window !== "undefined" && isWebSpeechSupported()) {
      const updateVoices = () => {
        const v = getWebSpeechVoices();
        setAvailableVoices(v);
      };
      updateVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = updateVoices;
      }
    }
  }, []);

  const setAutoSpeakMode = useCallback((mode) => {
    setAutoSpeakModeState(mode);
    localStorage.setItem("vaani-auto-speak-mode", mode);
    localStorage.setItem("vaani-voice-reply", mode === "off" ? "0" : "1");
  }, []);

  const setRate = useCallback((newRate) => {
    setRateState(newRate);
    localStorage.setItem("vaani-speech-rate", String(newRate));
  }, []);

  const setPitch = useCallback((newPitch) => {
    setPitchState(newPitch);
    localStorage.setItem("vaani-speech-pitch", String(newPitch));
  }, []);

  const setEngine = useCallback((newEngine) => {
    setEngineState(newEngine);
    localStorage.setItem("vaani-tts-engine", newEngine);
  }, []);

  const setWebSpeechVoice = useCallback((voiceURI) => {
    setSelectedVoiceURI(voiceURI);
    localStorage.setItem("vaani-webspeech-voice", voiceURI);
  }, []);

  const setVoice = useCallback((newVoice) => {
    setVoiceName(newVoice);
    localStorage.setItem("vaani-voice-name", newVoice);
  }, []);

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
    if (activeStreamSessionRef.current) {
      try {
        activeStreamSessionRef.current.cancel();
      } catch {}
      activeStreamSessionRef.current = null;
    }
    if (activeControllerRef.current) {
      try {
        activeControllerRef.current.cancel();
      } catch {}
      activeControllerRef.current = null;
    }
    stopWebSpeech();
    setIsPaused(false);
  }, []);

  const stop = useCallback(() => {
    cleanup();
    setPlayingId(null);
    setProgress(0);
    setCurrentSentence("");
    setSentenceInfo({ text: "", index: 0, total: 0 });
    setIsPaused(false);
  }, [cleanup]);

  const pause = useCallback(() => {
    if (engine === "webspeech" || !audioRef.current) {
      pauseWebSpeech();
      setIsPaused(true);
    } else if (audioRef.current) {
      audioRef.current.pause();
      setIsPaused(true);
    }
  }, [engine]);

  const resume = useCallback(() => {
    if (engine === "webspeech" || !audioRef.current) {
      resumeWebSpeech();
      setIsPaused(false);
    } else if (audioRef.current) {
      audioRef.current.play();
      setIsPaused(false);
    }
  }, [engine]);

  const togglePause = useCallback(() => {
    if (isPaused) {
      resume();
    } else {
      pause();
    }
  }, [isPaused, resume, pause]);

  const skipSentence = useCallback(() => {
    if (activeStreamSessionRef.current?.skip) {
      activeStreamSessionRef.current.skip();
    } else if (activeControllerRef.current?.skip) {
      activeControllerRef.current.skip();
    }
  }, []);

  const prevSentence = useCallback(() => {
    if (activeControllerRef.current?.prev) {
      activeControllerRef.current.prev();
    }
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  /**
   * Start zero-latency Partial Text Streaming TTS.
   * Begins speaking clause 1 in <300ms as tokens stream in.
   */
  const startStreamTTS = useCallback(
    (id, lang = "en", options = {}) => {
      stop();
      setPlayingId(id);
      setProgress(0.001);
      setIsPaused(false);

      const targetRate = options.rate !== undefined ? options.rate : rate;
      const targetPitch = options.pitch !== undefined ? options.pitch : pitch;
      const targetVoiceURI = options.voiceURI || selectedVoiceURI;

      try {
        const session = createStreamingSpeechSession({
          lang,
          rate: targetRate,
          pitch: targetPitch,
          voiceURI: targetVoiceURI,
          onStart: () => {
            setIsPaused(false);
          },
          onProgress: (p) => {
            setProgress(p);
          },
          onSentence: ({ text, index, total }) => {
            setCurrentSentence(text);
            setSentenceInfo({ text, index, total });
          },
          onEnd: () => {
            sfx.tap();
            stop();
          },
          onError: (err) => {
            console.warn("Streaming TTS playback error:", err);
            stop();
          },
        });

        activeStreamSessionRef.current = session;

        return {
          feed: (delta) => session.feed(delta),
          finish: () => session.finish(),
          cancel: () => session.cancel(),
          skip: () => session.skip(),
        };
      } catch (err) {
        console.warn("Failed to create streaming speech session:", err);
        return {
          feed: () => {},
          finish: () => {},
          cancel: () => {},
          skip: () => {},
        };
      }
    },
    [stop, rate, pitch, selectedVoiceURI]
  );

  /**
   * Play speech for a static completed text and message ID.
   */
  const play = useCallback(
    async (text, id, lang = "en", options = {}) => {
      if (playingId === id && !isPaused) {
        stop();
        return;
      }
      if (playingId === id && isPaused) {
        resume();
        return;
      }

      stop();
      const spoken = speechNormalize(text, lang);
      if (!spoken || spoken.trim().length === 0) return;

      setPlayingId(id);
      setProgress(0.0001);
      setIsPaused(false);

      const targetEngine = options.engine || engine || "webspeech";
      const targetRate = options.rate !== undefined ? options.rate : rate;
      const targetPitch = options.pitch !== undefined ? options.pitch : pitch;
      const targetVoiceURI = options.voiceURI || selectedVoiceURI;

      if (targetEngine === "neural") {
        const activeVoice = options.customVoice || voiceName || "Kore";
        try {
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
            playWithWebSpeechDirect(spoken, id, lang, targetRate, targetPitch, targetVoiceURI);
          };

          await audio.play();
          return;
        } catch (err) {
          console.warn("Neural TTS error, fallback to Web Speech API:", err);
          playWithWebSpeechDirect(spoken, id, lang, targetRate, targetPitch, targetVoiceURI);
          return;
        }
      }

      // Default: High performance, natural Web Speech API
      playWithWebSpeechDirect(spoken, id, lang, targetRate, targetPitch, targetVoiceURI);
    },
    [playingId, isPaused, stop, resume, engine, rate, pitch, selectedVoiceURI, voiceName]
  );

  const playWithWebSpeechDirect = (
    spokenText,
    id,
    lang,
    customRate = 0.92,
    customPitch = 0.95,
    customVoiceURI = null
  ) => {
    if (!isWebSpeechSupported()) {
      toast.error("Web Speech API is not supported in this browser");
      stop();
      return;
    }

    try {
      const controller = speakWebSpeech({
        text: spokenText,
        lang,
        rate: customRate,
        pitch: customPitch,
        voiceURI: customVoiceURI,
        onStart: () => {
          setIsPaused(false);
        },
        onProgress: (p) => {
          setProgress(p);
        },
        onSentence: ({ text, index, total }) => {
          setCurrentSentence(text);
          setSentenceInfo({ text, index, total });
        },
        onEnd: () => {
          sfx.tap();
          stop();
        },
        onError: () => {
          toast.error("Speech playback error");
          stop();
        },
      });

      activeControllerRef.current = controller;
    } catch (err) {
      console.warn("Web Speech speak error:", err);
      toast.error("Could not play synthesized speech");
      stop();
    }
  };

  const speakText = useCallback(
    (text, langCode = "en", options = {}) => {
      return play(text, `speak-${Date.now()}`, langCode, options);
    },
    [play]
  );

  const stopSpeaking = useCallback(() => {
    stop();
  }, [stop]);

  const isSpeaking = !!playingId && !isPaused;

  return {
    play,
    speakText,
    stopSpeaking,
    isSpeaking,
    isPlaying: !!playingId,
    startStreamTTS,
    stop,
    pause,
    resume,
    togglePause,
    skipSentence,
    prevSentence,
    playingId,
    isPaused,
    progress,
    currentSentence,
    sentenceInfo,
    rate,
    setRate,
    pitch,
    setPitch,
    engine,
    setEngine,
    voiceName,
    setVoice,
    selectedVoiceURI,
    setWebSpeechVoice,
    autoSpeakMode,
    setAutoSpeakMode,
    availableVoices,
    isWebSpeechSupported: isWebSpeechSupported(),
  };
}
