import { useRef, useState, useCallback, useEffect } from "react";
import { transcribeAudio } from "./api";
import {
  isSpeechRecognitionSupported,
  NativeSpeechRecognizer,
  getSTTLanguageCode,
  cleanTranscribedText,
} from "./speechRecognition";

/**
 * Pure Browser-Native Speech-To-Text (STT) Hook
 * Uses W3C Web Speech Recognition API with real-time interim updates and live volume metering.
 */
export function useSpeechToText(options = {}) {
  const {
    lang = "en",
    continuous = true,
    interimResults = true,
    onResult = () => {},
    onError = () => {},
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState(null);
  const recognizerRef = useRef(null);

  const supported = isSpeechRecognitionSupported();

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    setError(null);
  }, []);

  const stopListening = useCallback(() => {
    if (recognizerRef.current) {
      const finalText = recognizerRef.current.stop();
      recognizerRef.current = null;
      setIsListening(false);
      setAudioLevel(0);
      return finalText;
    }
    setIsListening(false);
    setAudioLevel(0);
    return "";
  }, []);

  const startListening = useCallback(
    async (customLang) => {
      const activeLang = customLang || lang;
      setError(null);
      setInterimTranscript("");

      if (!supported) {
        const err = new Error("Browser Speech Recognition not supported in this browser.");
        setError(err.message);
        onError(err);
        return false;
      }

      if (recognizerRef.current) {
        recognizerRef.current.stop();
      }

      const recognizer = new NativeSpeechRecognizer({
        lang: activeLang,
        continuous,
        interimResults,
        onStart: () => {
          setIsListening(true);
        },
        onInterim: ({ interimText, totalText }) => {
          setInterimTranscript(interimText);
          onResult(totalText);
        },
        onFinal: ({ finalText }) => {
          setTranscript(finalText);
          onResult(finalText);
        },
        onAudioLevel: (lvl) => {
          setAudioLevel(lvl);
        },
        onError: (err) => {
          setError(err.message || String(err));
          onError(err);
        },
        onEnd: ({ finalText }) => {
          setIsListening(false);
          setAudioLevel(0);
          if (finalText) {
            setTranscript(finalText);
          }
        },
      });

      recognizerRef.current = recognizer;
      const started = await recognizer.start();
      return started;
    },
    [lang, continuous, interimResults, onResult, onError, supported]
  );

  useEffect(() => {
    return () => {
      if (recognizerRef.current) {
        recognizerRef.current.abort();
        recognizerRef.current = null;
      }
    };
  }, []);

  return {
    isListening,
    isSupported: supported,
    transcript,
    interimTranscript,
    audioLevel,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
}

/**
 * Universal Voice Recorder & STT Hook
 * 1. Captures audio via MediaRecorder for backend multimodal models
 * 2. Parallel Browser-Native Web Speech API for real-time zero-latency transcription
 * 3. AudioContext AnalyserNode for animated live waveform visualization
 */
export function useVoiceRecorder(language = "en") {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const nativeRecognizerRef = useRef(null);
  const liveTranscriptRef = useRef("");
  const animFrameRef = useRef(null);

  const getAnalyser = useCallback(() => analyserRef.current, []);

  const teardownAudio = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch {}
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    if (nativeRecognizerRef.current) {
      try {
        nativeRecognizerRef.current.abort();
      } catch {}
      nativeRecognizerRef.current = null;
    }
    setAudioLevel(0);
  };

  useEffect(() => {
    return () => teardownAudio();
  }, []);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Setup audio analyzer for waveform and volume meter
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) {
          const ctx = new AC();
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 512;
          analyser.smoothingTimeConstant = 0.8;
          source.connect(analyser);
          audioCtxRef.current = ctx;
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateMeter = () => {
            if (!analyserRef.current) return;
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            setAudioLevel(Math.min(1.0, avg / 128.0));
            animFrameRef.current = requestAnimationFrame(updateMeter);
          };
          animFrameRef.current = requestAnimationFrame(updateMeter);
        }
      } catch (err) {
        console.warn("AudioContext init error:", err);
      }

      // Initialize parallel Browser-Native Speech Recognition
      liveTranscriptRef.current = "";
      setInterimText("");

      if (isSpeechRecognitionSupported()) {
        try {
          const recognizer = new NativeSpeechRecognizer({
            lang: language,
            continuous: true,
            interimResults: true,
            onInterim: ({ totalText, interimText: curInterim }) => {
              const currentTotal = (totalText || curInterim || "").trim();
              liveTranscriptRef.current = currentTotal;
              setInterimText(currentTotal);
            },
            onFinal: ({ finalText }) => {
              if (finalText) {
                liveTranscriptRef.current = finalText.trim();
                setInterimText(finalText.trim());
              }
            },
            onError: () => {},
          });
          recognizer.start().catch(() => {});
          nativeRecognizerRef.current = recognizer;
        } catch (e) {
          // Non-fatal, MediaRecorder will capture audio
        }
      }

      // Setup MediaRecorder
      let mimeType = "audio/webm";
      if (!MediaRecorder.isTypeSupported("audio/webm")) {
        if (MediaRecorder.isTypeSupported("audio/mp4")) mimeType = "audio/mp4";
        else if (MediaRecorder.isTypeSupported("audio/ogg")) mimeType = "audio/ogg";
        else mimeType = "";
      }

      const mr = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mr.start(250);
      mediaRef.current = mr;
      setRecording(true);
    } catch (e) {
      setRecording(false);
      teardownAudio();
      throw e;
    }
  }, [language]);

  const stop = useCallback(async () => {
    return new Promise((resolve) => {
      const mr = mediaRef.current;
      if (!mr) {
        teardownAudio();
        setRecording(false);
        return resolve("");
      }

      mr.onstop = async () => {
        setRecording(false);
        const recordedMime = mr.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: recordedMime });

        // Stop browser-native speech recognition
        let nativeFinalText = "";
        if (nativeRecognizerRef.current) {
          try {
            nativeFinalText = nativeRecognizerRef.current.stop() || "";
          } catch {}
          nativeRecognizerRef.current = null;
        }

        const localLiveText = (nativeFinalText || liveTranscriptRef.current || "").trim();
        teardownAudio();

        if (blob.size === 0 && !localLiveText) {
          setInterimText("");
          return resolve("");
        }

        // If we already have strong browser-native STT transcript, return it quickly
        // while also ensuring reliable fallback to server if empty
        if (localLiveText && blob.size < 500) {
          setInterimText("");
          return resolve(cleanTranscribedText(localLiveText));
        }

        setTranscribing(true);
        try {
          // Send audio to server-side transcribe model
          const res = await transcribeAudio(blob, language);
          const finalResult = cleanTranscribedText(res?.text || "");
          setInterimText("");
          if (finalResult) {
            resolve(finalResult);
          } else if (localLiveText) {
            resolve(cleanTranscribedText(localLiveText));
          } else {
            resolve("");
          }
        } catch (err) {
          console.warn("Backend STT error, fallback to browser speech transcript:", err);
          setInterimText("");
          resolve(cleanTranscribedText(localLiveText || ""));
        } finally {
          setTranscribing(false);
        }
      };

      try {
        if (mr.state === "recording" && typeof mr.requestData === "function") {
          mr.requestData();
        }
        mr.stop();
      } catch {
        teardownAudio();
        setRecording(false);
        resolve(cleanTranscribedText(liveTranscriptRef.current || ""));
      }
    });
  }, [language]);

  return {
    recording,
    isRecording: recording,
    transcribing,
    isTranscribing: transcribing,
    interimText,
    transcript: interimText,
    audioLevel,
    isSpeechRecognitionSupported: isSpeechRecognitionSupported(),
    start,
    startRecording: start,
    stop,
    stopRecording: stop,
    getAnalyser,
  };
}
