import { useRef, useState, useCallback, useEffect } from "react";
import { transcribeAudio } from "./api";

// Speech-To-Text (STT) Hook:
// 1. Records high quality audio chunks via MediaRecorder for Gemini Multilingual STT ('gemini-3.5-transcribe')
// 2. Parallel Browser Web Speech Recognition (if supported) for instant interim feedback
// 3. AudioContext AnalyserNode for animated live waveform visualization
export function useVoiceRecorder(language = "en") {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [interimText, setInterimText] = useState("");
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const recognitionRef = useRef(null);
  const liveTranscriptRef = useRef("");

  const getAnalyser = useCallback(() => analyserRef.current, []);

  const teardownAudio = () => {
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
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
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

      // Setup audio analyzer for waveform
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
        }
      } catch (err) {
        console.warn("AudioContext init error:", err);
      }

      // Initialize parallel SpeechRecognition if available in browser
      liveTranscriptRef.current = "";
      setInterimText("");
      const SpeechRecognition =
        typeof window !== "undefined" &&
        (window.SpeechRecognition || window.webkitSpeechRecognition);

      if (SpeechRecognition) {
        try {
          const recognizer = new SpeechRecognition();
          recognizer.continuous = true;
          recognizer.interimResults = true;
          if (language === "mr") recognizer.lang = "mr-IN";
          else if (language === "hi") recognizer.lang = "hi-IN";
          else recognizer.lang = "en-IN";

          recognizer.onresult = (event) => {
            let finalStr = "";
            let interimStr = "";
            for (let i = 0; i < event.results.length; i++) {
              if (event.results[i].isFinal) {
                finalStr += event.results[i][0].transcript + " ";
              } else {
                interimStr += event.results[i][0].transcript;
              }
            }
            const currentTotal = (finalStr + interimStr).trim();
            liveTranscriptRef.current = currentTotal;
            setInterimText(currentTotal);
          };

          recognizer.onerror = () => {};
          recognizer.start();
          recognitionRef.current = recognizer;
        } catch (e) {
          // Browser speech recognition not permitted or failed
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
        
        // Stop browser speech recognition
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch {}
          recognitionRef.current = null;
        }

        const localLiveText = liveTranscriptRef.current.trim();
        teardownAudio();

        if (blob.size === 0 && !localLiveText) {
          setInterimText("");
          return resolve("");
        }

        setTranscribing(true);
        try {
          // Send audio to server-side Gemini transcribe model
          const res = await transcribeAudio(blob, language);
          const finalResult = (res?.text || "").trim();
          setInterimText("");
          if (finalResult) {
            resolve(finalResult);
          } else if (localLiveText) {
            resolve(localLiveText);
          } else {
            resolve("");
          }
        } catch (err) {
          console.warn("Backend STT error, fallback to browser speech transcript:", err);
          setInterimText("");
          resolve(localLiveText || "");
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
        resolve(liveTranscriptRef.current.trim() || "");
      }
    });
  }, [language]);

  return {
    recording,
    transcribing,
    interimText,
    start,
    stop,
    getAnalyser,
  };
}
