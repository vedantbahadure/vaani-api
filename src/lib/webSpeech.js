// Web Speech API Engine for VAANI (Speech Synthesis & Recognition)
// Delivers instant, zero-latency, streaming voice-first audio playback optimized for rural Indian users.
import { speechNormalize, extractSpokenSentences } from "./nlp";

// Prevent Chrome garbage collection bug with SpeechSynthesisUtterance
if (typeof window !== "undefined") {
  window._vaaniUtterances = window._vaaniUtterances || new Set();
}

let isSpeakingFlag = false;
let isPausedFlag = false;
let keepAliveTimer = null;
let watchdogTimer = null;
let cachedVoices = [];

// Initialize & cache voices on load
export function initWebSpeech() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return false;
  }
  const loadVoices = () => {
    try {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) {
        cachedVoices = v;
      }
    } catch {}
  };
  loadVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
  return true;
}

if (typeof window !== "undefined") {
  initWebSpeech();
}

export function isWebSpeechSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

export function getWebSpeechVoices() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  try {
    const live = window.speechSynthesis.getVoices() || [];
    if (live.length > 0) {
      cachedVoices = live;
      return live;
    }
  } catch {}
  return cachedVoices || [];
}

/**
 * Enhanced voice matcher for rural languages (Marathi, Hindi, English).
 * Scores voices to pick the most natural, clear, and intelligible tone.
 */
export function getBestVoiceForLanguage(lang = "en", preferredVoiceURI = null) {
  const voices = getWebSpeechVoices();
  if (!voices || voices.length === 0) return null;

  if (preferredVoiceURI) {
    const custom = voices.find((v) => v.voiceURI === preferredVoiceURI || v.name === preferredVoiceURI);
    if (custom) return custom;
  }

  const langLower = (lang || "en").toLowerCase();

  const scoreVoice = (v, targetLangPrefix) => {
    let score = 0;
    const vLang = (v.lang || "").toLowerCase().replace("_", "-");
    const vName = (v.name || "").toLowerCase();

    if (vLang === targetLangPrefix || vLang.startsWith(targetLangPrefix)) score += 50;
    if (vName.includes("natural") || vName.includes("online") || vName.includes("neural")) score += 30;
    if (vName.includes("google")) score += 25;
    if (
      vName.includes("female") ||
      vName.includes("zira") ||
      vName.includes("kalpana") ||
      vName.includes("aditi") ||
      vName.includes("swara") ||
      vName.includes("heera") ||
      vName.includes("anjali") ||
      vName.includes("lekha") ||
      vName.includes("geeta") ||
      vName.includes("neerja") ||
      vName.includes("kavya")
    ) {
      score += 20;
    }
    if (v.default) score += 5;
    return score;
  };

  // Marathi: Look for Marathi voice first -> then Hindi voice -> then Indian English -> any voice
  if (langLower === "mr") {
    const mrVoices = voices.filter(
      (v) =>
        (v.lang && v.lang.toLowerCase().replace("_", "-").startsWith("mr")) ||
        (v.name && v.name.toLowerCase().includes("marathi"))
    );
    if (mrVoices.length > 0) {
      return [...mrVoices].sort((a, b) => scoreVoice(b, "mr") - scoreVoice(a, "mr"))[0];
    }

    // High quality Hindi fallback (Devanagari phonetics read Marathi clearly)
    const hiVoices = voices.filter(
      (v) =>
        (v.lang && v.lang.toLowerCase().replace("_", "-").startsWith("hi")) ||
        (v.name && (v.name.toLowerCase().includes("hindi") || v.name.includes("हिन्दी")))
    );
    if (hiVoices.length > 0) {
      return [...hiVoices].sort((a, b) => scoreVoice(b, "hi") - scoreVoice(a, "hi"))[0];
    }
  }

  // Hindi: Look for Hindi voice -> then Indian English -> any voice
  if (langLower === "hi") {
    const hiVoices = voices.filter(
      (v) =>
        (v.lang && v.lang.toLowerCase().replace("_", "-").startsWith("hi")) ||
        (v.name && (v.name.toLowerCase().includes("hindi") || v.name.includes("हिन्दी")))
    );
    if (hiVoices.length > 0) {
      return [...hiVoices].sort((a, b) => scoreVoice(b, "hi") - scoreVoice(a, "hi"))[0];
    }
  }

  // Indian English or general English
  const enInVoices = voices.filter(
    (v) =>
      (v.lang && v.lang.toLowerCase().replace("_", "-") === "en-in") ||
      (v.name && (v.name.toLowerCase().includes("india") || v.name.toLowerCase().includes("neerja") || v.name.toLowerCase().includes("heera")))
  );
  if (enInVoices.length > 0) {
    return [...enInVoices].sort((a, b) => scoreVoice(b, "en-in") - scoreVoice(a, "en-in"))[0];
  }

  const enVoices = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith("en"));
  if (enVoices.length > 0) {
    return [...enVoices].sort((a, b) => scoreVoice(b, "en") - scoreVoice(a, "en"))[0];
  }

  return voices[0] || null;
}

// Stop current speech and clear all active timers
export function stopWebSpeech() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
  if (watchdogTimer) {
    clearTimeout(watchdogTimer);
    watchdogTimer = null;
  }
  try {
    if (window._vaaniUtterances) window._vaaniUtterances.clear();
    window.speechSynthesis.cancel();
  } catch {}
  isSpeakingFlag = false;
  isPausedFlag = false;
}

export function pauseWebSpeech() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.pause();
    isPausedFlag = true;
  } catch {}
}

export function resumeWebSpeech() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.resume();
    isPausedFlag = false;
  } catch {}
}

export function isWebSpeechSpeaking() {
  return isSpeakingFlag;
}

export function isWebSpeechPaused() {
  return isPausedFlag;
}

/**
 * Creates an Ultra-Low Latency Streaming Speech Session.
 * Buffers streaming LLM tokens, detects early clause boundaries on the fly,
 * normalizes phonetically, and speaks the first sentence in <300ms.
 */
export function createStreamingSpeechSession({
  lang = "en",
  rate = 0.9,
  pitch = 0.95,
  volume = 1.0,
  voiceURI = null,
  onStart = () => {},
  onProgress = () => {},
  onSentence = () => {},
  onEnd = () => {},
  onError = () => {},
}) {
  if (!isWebSpeechSupported()) {
    onError(new Error("Web Speech API is not supported in this browser"));
    return {
      feed: () => {},
      finish: () => {},
      cancel: () => {},
      skip: () => {},
    };
  }

  stopWebSpeech();

  // Unpause in case browser was previously paused
  try {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  } catch {}

  let textBuffer = "";
  const sentenceQueue = [];
  let isPlayingQueue = false;
  let isFinishedStream = false;
  let isCancelled = false;
  let totalSpokenChars = 0;
  let estimatedTotalChars = 0;
  let hasStarted = false;
  let currentSentenceIndex = 0;

  isSpeakingFlag = true;
  isPausedFlag = false;

  // Keep-alive timer for Chromium speech synthesis
  keepAliveTimer = setInterval(() => {
    try {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    } catch {}
  }, 7000);

  const resetWatchdog = () => {
    if (watchdogTimer) clearTimeout(watchdogTimer);
    // Watchdog unfreezes speech if Chrome deadlocks onend
    watchdogTimer = setTimeout(() => {
      if (isPlayingQueue && !isPausedFlag && isSpeakingFlag) {
        try {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          } else if (!window.speechSynthesis.speaking && sentenceQueue.length > 0) {
            processNextSentenceInQueue();
          }
        } catch {}
      }
    }, 10000);
  };

  const processNextSentenceInQueue = () => {
    if (isCancelled) return;

    if (sentenceQueue.length === 0) {
      isPlayingQueue = false;
      if (isFinishedStream) {
        if (keepAliveTimer) {
          clearInterval(keepAliveTimer);
          keepAliveTimer = null;
        }
        if (watchdogTimer) {
          clearTimeout(watchdogTimer);
          watchdogTimer = null;
        }
        isSpeakingFlag = false;
        isPausedFlag = false;
        onEnd();
      }
      return;
    }

    isPlayingQueue = true;
    const rawSentence = sentenceQueue.shift();
    const normalized = speechNormalize(rawSentence, lang);

    if (!normalized || normalized.trim().length === 0) {
      processNextSentenceInQueue();
      return;
    }

    currentSentenceIndex++;
    resetWatchdog();

    const matchedVoice = getBestVoiceForLanguage(lang, voiceURI);
    const utterance = new SpeechSynthesisUtterance(normalized);

    if (matchedVoice) {
      utterance.voice = matchedVoice;
      utterance.lang = matchedVoice.lang;
    } else {
      if (lang === "mr" || lang === "hi") {
        utterance.lang = "hi-IN";
      } else {
        utterance.lang = "en-IN";
      }
    }

    utterance.rate = rate || 0.9;
    utterance.pitch = pitch || 0.95;
    utterance.volume = volume || 1.0;

    if (window._vaaniUtterances) {
      window._vaaniUtterances.add(utterance);
    }

    utterance.onstart = () => {
      if (!hasStarted) {
        hasStarted = true;
        onStart();
      }
      resetWatchdog();
      onSentence({
        text: normalized,
        raw: rawSentence,
        index: currentSentenceIndex,
        total: currentSentenceIndex + sentenceQueue.length,
      });
    };

    utterance.onboundary = (e) => {
      resetWatchdog();
      if (e.charIndex !== undefined && estimatedTotalChars > 0) {
        const prog = Math.min(
          0.99,
          (totalSpokenChars + e.charIndex) / Math.max(estimatedTotalChars, totalSpokenChars + normalized.length)
        );
        onProgress(prog);
      }
    };

    utterance.onend = () => {
      if (window._vaaniUtterances) {
        window._vaaniUtterances.delete(utterance);
      }
      totalSpokenChars += normalized.length + 1;
      processNextSentenceInQueue();
    };

    utterance.onerror = (err) => {
      if (window._vaaniUtterances) {
        window._vaaniUtterances.delete(utterance);
      }
      if (err?.error === "canceled" || err?.error === "interrupted") {
        isCancelled = true;
      } else {
        console.warn("SpeechSynthesis utterance error:", err?.error || err);
      }
      if (isCancelled) {
        if (keepAliveTimer) {
          clearInterval(keepAliveTimer);
          keepAliveTimer = null;
        }
        if (watchdogTimer) {
          clearTimeout(watchdogTimer);
          watchdogTimer = null;
        }
        isSpeakingFlag = false;
        isPausedFlag = false;
      } else {
        processNextSentenceInQueue();
      }
    };

    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("speechSynthesis.speak exception:", e);
      processNextSentenceInQueue();
    }
  };

  /**
   * Feed new streaming token delta into buffer.
   * Uses ultra-low-latency segmentation so auto-speak starts speaking in <100ms
   * as soon as the first word or punctuation is received.
   */
  const feed = (tokenDelta) => {
    if (isCancelled || !tokenDelta) return;
    textBuffer += tokenDelta;
    estimatedTotalChars += tokenDelta.length;

    // Fast boundary check: look for early punctuation (. ! ? । \n : ; ,)
    // First sentence starts immediately on greeting or short clause (e.g. "नमस्ते!", "Hello,")
    const isFirstSentence = (currentSentenceIndex === 0 && sentenceQueue.length === 0 && !isPlayingQueue);
    const minClauseLength = isFirstSentence ? 6 : 14;

    // Pattern matching standard punctuation boundaries
    const punctMatch = textBuffer.search(/[.!?:।\n;]/);
    const commaMatch = textBuffer.search(/[,—]/);

    let splitAt = -1;

    if (punctMatch !== -1 && punctMatch >= minClauseLength - 1) {
      splitAt = punctMatch + 1;
    } else if (commaMatch !== -1 && commaMatch >= minClauseLength + 4) {
      splitAt = commaMatch + 1;
    } else if (textBuffer.length > (isFirstSentence ? 32 : 55)) {
      // Fallback split on whitespace to prevent speech delay on long unstructured lines
      const lastSpace = textBuffer.lastIndexOf(" ");
      if (lastSpace >= minClauseLength) {
        splitAt = lastSpace + 1;
      }
    }

    if (splitAt > 0) {
      const chunk = textBuffer.slice(0, splitAt).trim();
      textBuffer = textBuffer.slice(splitAt).trimStart();
      if (chunk.length > 0) {
        sentenceQueue.push(chunk);
        if (!isPlayingQueue) {
          processNextSentenceInQueue();
        }
      }
    }
  };

  /**
   * Called when stream generation finishes. Flushes any remaining buffer text.
   */
  const finish = () => {
    if (isCancelled) return;
    isFinishedStream = true;

    if (textBuffer.trim().length > 0) {
      sentenceQueue.push(textBuffer.trim());
      textBuffer = "";
    }

    if (!isPlayingQueue) {
      if (sentenceQueue.length > 0) {
        processNextSentenceInQueue();
      } else {
        if (keepAliveTimer) {
          clearInterval(keepAliveTimer);
          keepAliveTimer = null;
        }
        if (watchdogTimer) {
          clearTimeout(watchdogTimer);
          watchdogTimer = null;
        }
        isSpeakingFlag = false;
        isPausedFlag = false;
        onEnd();
      }
    }
  };

  const cancel = () => {
    isCancelled = true;
    sentenceQueue.length = 0;
    textBuffer = "";
    stopWebSpeech();
  };

  const skip = () => {
    try {
      window.speechSynthesis.cancel();
    } catch {}
    processNextSentenceInQueue();
  };

  return {
    feed,
    finish,
    cancel,
    skip,
  };
}

/**
 * Standard Speak for full completed messages (e.g. user taps play audio icon or auto-speak review).
 */
export function speakWebSpeech({
  text,
  lang = "en",
  rate = 0.9,
  pitch = 0.95,
  volume = 1.0,
  voiceURI = null,
  onStart = () => {},
  onProgress = () => {},
  onSentence = () => {},
  onEnd = () => {},
  onError = () => {},
}) {
  if (!isWebSpeechSupported()) {
    onError(new Error("Web Speech API not supported"));
    return { cancel: () => {}, skip: () => {}, prev: () => {} };
  }

  stopWebSpeech();

  const normalized = speechNormalize(text, lang);
  if (!normalized || normalized.trim().length === 0) {
    onEnd();
    return { cancel: () => {}, skip: () => {}, prev: () => {} };
  }

  const sentences = extractSpokenSentences(normalized);
  if (sentences.length === 0) {
    sentences.push(normalized);
  }

  let currentIndex = 0;
  let isCancelled = false;
  let totalChars = sentences.reduce((sum, s) => sum + s.length, 0);
  let spokenChars = 0;

  isSpeakingFlag = true;
  isPausedFlag = false;

  const speakCurrentSentence = () => {
    if (isCancelled || currentIndex >= sentences.length) {
      isSpeakingFlag = false;
      isPausedFlag = false;
      onEnd();
      return;
    }

    const currentText = sentences[currentIndex].trim();
    if (!currentText) {
      currentIndex++;
      speakCurrentSentence();
      return;
    }

    const matchedVoice = getBestVoiceForLanguage(lang, voiceURI);
    const utterance = new SpeechSynthesisUtterance(currentText);

    if (matchedVoice) {
      utterance.voice = matchedVoice;
      utterance.lang = matchedVoice.lang;
    } else {
      if (lang === "mr" || lang === "hi") {
        utterance.lang = "hi-IN";
      } else {
        utterance.lang = "en-IN";
      }
    }

    utterance.rate = rate || 0.9;
    utterance.pitch = pitch || 0.95;
    utterance.volume = volume || 1.0;

    if (window._vaaniUtterances) {
      window._vaaniUtterances.add(utterance);
    }

    utterance.onstart = () => {
      if (currentIndex === 0) {
        onStart();
      }
      onSentence({
        text: currentText,
        raw: currentText,
        index: currentIndex + 1,
        total: sentences.length,
      });
    };

    utterance.onboundary = (e) => {
      if (e.charIndex !== undefined && totalChars > 0) {
        const prog = Math.min(0.99, (spokenChars + e.charIndex) / totalChars);
        onProgress(prog);
      }
    };

    utterance.onend = () => {
      if (window._vaaniUtterances) {
        window._vaaniUtterances.delete(utterance);
      }
      spokenChars += currentText.length;
      currentIndex++;
      speakCurrentSentence();
    };

    utterance.onerror = (err) => {
      if (window._vaaniUtterances) {
        window._vaaniUtterances.delete(utterance);
      }
      if (err?.error === "canceled" || err?.error === "interrupted") {
        isCancelled = true;
      } else {
        console.warn("SpeechSynthesis error:", err?.error || err);
      }
      if (!isCancelled) {
        currentIndex++;
        speakCurrentSentence();
      }
    };

    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("speechSynthesis speak error:", e);
      currentIndex++;
      speakCurrentSentence();
    }
  };

  speakCurrentSentence();

  return {
    cancel: () => {
      isCancelled = true;
      stopWebSpeech();
    },
    skip: () => {
      if (currentIndex < sentences.length - 1) {
        spokenChars += (sentences[currentIndex] || "").length;
        currentIndex++;
        try {
          window.speechSynthesis.cancel();
        } catch {}
        speakCurrentSentence();
      }
    },
    prev: () => {
      if (currentIndex > 0) {
        currentIndex = Math.max(0, currentIndex - 1);
        try {
          window.speechSynthesis.cancel();
        } catch {}
        speakCurrentSentence();
      }
    },
  };
}

export {
  isSpeechRecognitionSupported,
  NativeSpeechRecognizer,
  getSTTLanguageCode,
  transcribeSpeechNative,
  SUPPORTED_STT_LANGUAGES,
} from "./speechRecognition";
