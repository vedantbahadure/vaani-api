/**
 * Browser-Native Speech-To-Text (STT) Engine for VAANI
 * Provides robust, zero-latency transcription using the W3C Web Speech Recognition API
 * (SpeechRecognition / webkitSpeechRecognition) with regional Indian language support,
 * live interim streaming, silence detection, and AudioContext visualizer integration.
 */

// Mapping of short ISO language codes to regional BCP-47 locale tags
export const SUPPORTED_STT_LANGUAGES = {
  mr: { code: "mr-IN", label: "मराठी (Marathi)", name: "Marathi" },
  hi: { code: "hi-IN", label: "हिन्दी (Hindi)", name: "Hindi" },
  en: { code: "en-IN", label: "English (India)", name: "English" },
  gu: { code: "gu-IN", label: "ગુજરાતી (Gujarati)", name: "Gujarati" },
  bn: { code: "bn-IN", label: "বাংলা (Bengali)", name: "Bengali" },
  ta: { code: "ta-IN", label: "தமிழ் (Tamil)", name: "Tamil" },
  te: { code: "te-IN", label: "తెలుగు (Telugu)", name: "Telugu" },
  kn: { code: "kn-IN", label: "ಕನ್ನಡ (Kannada)", name: "Kannada" },
  pa: { code: "pa-IN", label: "ਪੰਜਾਬੀ (Punjabi)", name: "Punjabi" },
};

/**
 * Check if the current browser environment supports native SpeechRecognition.
 */
export function isSpeechRecognitionSupported() {
  if (typeof window === "undefined") return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Resolves BCP-47 language tag for SpeechRecognition.
 */
export function getSTTLanguageCode(lang = "en") {
  const normalized = (lang || "en").toLowerCase().trim();
  if (SUPPORTED_STT_LANGUAGES[normalized]) {
    return SUPPORTED_STT_LANGUAGES[normalized].code;
  }
  if (normalized.includes("-")) return normalized;
  if (normalized === "mr") return "mr-IN";
  if (normalized === "hi") return "hi-IN";
  return "en-IN";
}

/**
 * Clean and normalize transcribed text for rural queries.
 */
export function cleanTranscribedText(rawText = "") {
  if (!rawText) return "";
  return rawText
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Browser-Native Speech Recognition Session
 * Manages recognition lifecycle, interim token streaming, audio level monitoring, and auto-restart.
 */
export class NativeSpeechRecognizer {
  constructor(options = {}) {
    this.lang = options.lang || "en";
    this.continuous = options.continuous ?? true;
    this.interimResults = options.interimResults ?? true;
    this.maxAlternatives = options.maxAlternatives ?? 1;
    this.silenceTimeoutMs = options.silenceTimeoutMs || 3500; // Auto-stop after silence

    this.onStart = options.onStart || (() => {});
    this.onInterim = options.onInterim || (() => {});
    this.onFinal = options.onFinal || (() => {});
    this.onError = options.onError || (() => {});
    this.onEnd = options.onEnd || (() => {});
    this.onAudioLevel = options.onAudioLevel || (() => {});

    this.recognition = null;
    this.isListening = false;
    this.isExplicitlyStopped = false;
    this.finalTranscript = "";
    this.interimTranscript = "";
    this.silenceTimer = null;
    this.audioContext = null;
    this.mediaStream = null;
    this.analyser = null;
    this.meterRafId = null;
  }

  /**
   * Initialize microphone stream and AudioContext analyzer for visual audio feedback.
   */
  async _setupAudioMetering() {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      this.mediaStream = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);

        this.audioContext = ctx;
        this.analyser = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const checkLevel = () => {
          if (!this.isListening) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const normalized = Math.min(1.0, avg / 128.0);
          this.onAudioLevel(normalized);
          this.meterRafId = requestAnimationFrame(checkLevel);
        };
        this.meterRafId = requestAnimationFrame(checkLevel);
      }
    } catch (err) {
      // Audio metering is non-fatal; continue with speech recognition
    }
  }

  _cleanupAudioMetering() {
    if (this.meterRafId) {
      cancelAnimationFrame(this.meterRafId);
      this.meterRafId = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }
    this.analyser = null;
  }

  _resetSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
    }
    if (this.silenceTimeoutMs > 0 && this.isListening) {
      this.silenceTimer = setTimeout(() => {
        if (this.isListening && !this.isExplicitlyStopped) {
          // If we received some speech, cleanly conclude
          this.stop();
        }
      }, this.silenceTimeoutMs);
    }
  }

  /**
   * Start capturing and transcribing speech.
   */
  async start() {
    if (!isSpeechRecognitionSupported()) {
      const err = new Error("Web Speech Recognition API is not supported in this browser.");
      err.code = "NOT_SUPPORTED";
      this.onError(err);
      return false;
    }

    if (this.isListening) {
      return true;
    }

    this.isExplicitlyStopped = false;
    this.finalTranscript = "";
    this.interimTranscript = "";

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRecognition();

    rec.continuous = this.continuous;
    rec.interimResults = this.interimResults;
    rec.maxAlternatives = this.maxAlternatives;
    rec.lang = getSTTLanguageCode(this.lang);

    rec.onstart = () => {
      this.isListening = true;
      this._resetSilenceTimer();
      this.onStart();
    };

    rec.onresult = (event) => {
      this._resetSilenceTimer();
      let currentInterim = "";
      let newlyFinal = "";
      let confidence = 0.9;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        const text = item[0]?.transcript || "";
        if (item[0]?.confidence) {
          confidence = item[0].confidence;
        }

        if (item.isFinal) {
          newlyFinal += text + " ";
        } else {
          currentInterim += text;
        }
      }

      if (newlyFinal) {
        this.finalTranscript = (this.finalTranscript + " " + newlyFinal).trim();
        this.onFinal({
          finalText: this.finalTranscript,
          newSegment: newlyFinal.trim(),
          confidence,
        });
      }

      this.interimTranscript = currentInterim.trim();
      const combined = (this.finalTranscript + " " + this.interimTranscript).trim();

      this.onInterim({
        interimText: this.interimTranscript,
        totalText: combined,
        confidence,
      });
    };

    rec.onerror = (event) => {
      const errType = event.error || "unknown";
      if (errType === "no-speech") {
        // Normal silence timeout
        return;
      }
      if (errType === "aborted") {
        return;
      }

      const formattedError = new Error(`Speech recognition error: ${errType}`);
      formattedError.code = errType;
      this.onError(formattedError);
    };

    rec.onend = () => {
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }

      // If recognition stopped unexpectedly (and wasn't explicitly stopped), auto-restart if continuous
      if (this.isListening && !this.isExplicitlyStopped && this.continuous) {
        try {
          rec.start();
          return;
        } catch {}
      }

      this.isListening = false;
      this._cleanupAudioMetering();
      this.onEnd({
        finalText: cleanTranscribedText(this.finalTranscript || this.interimTranscript),
      });
    };

    this.recognition = rec;

    // Start live audio visualizer
    this._setupAudioMetering();

    try {
      rec.start();
      return true;
    } catch (err) {
      this.isListening = false;
      this._cleanupAudioMetering();
      this.onError(err);
      return false;
    }
  }

  /**
   * Stop capturing audio and finalize transcript.
   */
  stop() {
    this.isExplicitlyStopped = true;
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        try {
          this.recognition.abort();
        } catch {}
      }
    }
    this.isListening = false;
    this._cleanupAudioMetering();
    return cleanTranscribedText(this.finalTranscript || this.interimTranscript);
  }

  /**
   * Abort immediately without triggering normal finish.
   */
  abort() {
    this.isExplicitlyStopped = true;
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {}
    }
    this.isListening = false;
    this._cleanupAudioMetering();
  }

  setLanguage(newLang) {
    this.lang = newLang;
    if (this.recognition) {
      this.recognition.lang = getSTTLanguageCode(newLang);
    }
  }
}

/**
 * One-shot helper to transcribe speech using browser-native SpeechRecognition.
 * Returns a Promise that resolves with the transcribed text.
 */
export function transcribeSpeechNative({
  lang = "en",
  silenceTimeoutMs = 4000,
  onInterim = () => {},
  onAudioLevel = () => {},
} = {}) {
  return new Promise((resolve, reject) => {
    if (!isSpeechRecognitionSupported()) {
      return reject(new Error("Native SpeechRecognition not supported"));
    }

    let finalCollected = "";

    const recognizer = new NativeSpeechRecognizer({
      lang,
      continuous: false,
      interimResults: true,
      silenceTimeoutMs,
      onStart: () => {},
      onInterim: (data) => {
        onInterim(data.totalText || data.interimText);
      },
      onFinal: (data) => {
        finalCollected = data.finalText;
      },
      onAudioLevel,
      onEnd: (data) => {
        resolve(data.finalText || finalCollected);
      },
      onError: (err) => {
        if (finalCollected) {
          resolve(finalCollected);
        } else {
          reject(err);
        }
      },
    });

    recognizer.start().catch(reject);
  });
}
