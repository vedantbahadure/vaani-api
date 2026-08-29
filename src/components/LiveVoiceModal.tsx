import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Volume2, Square, X, Radio, Sparkles, Loader2 } from "lucide-react";
import { Orb } from "./Orb";
import { useSpeech } from "../lib/useSpeech";
import { useVoiceRecorder } from "../lib/useVoice";
import { streamChat } from "../lib/api";
import { sfx } from "../lib/sound";

interface LiveVoiceModalProps {
  open: boolean;
  onClose: () => void;
  rolePersona?: string;
  language?: string;
}

export function LiveVoiceModal({
  open,
  onClose,
  rolePersona = "rural_advisor",
  language = "en",
}: LiveVoiceModalProps) {
  const [liveState, setLiveState] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");
  const [transcribedTurn, setTranscribedTurn] = useState<string>("");
  const [assistantTurn, setAssistantTurn] = useState<string>("");
  const [history, setHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);

  const speech = useSpeech();
  const { recording, start, stop, interimText } = useVoiceRecorder(language);
  const activeSessionRef = useRef(false);

  useEffect(() => {
    if (open) {
      activeSessionRef.current = true;
      sfx.start();
      setLiveState("idle");
    } else {
      activeSessionRef.current = false;
      speech.stop();
      if (recording) stop();
    }
  }, [open]);

  // Handle continuous voice turn
  const handleStartListening = async () => {
    speech.stop();
    sfx.listen();
    setLiveState("listening");
    setTranscribedTurn("");
    setAssistantTurn("");
    try {
      await start();
    } catch (err) {
      setLiveState("idle");
    }
  };

  const handleStopAndSend = async () => {
    setLiveState("thinking");
    const userSpoken = await stop();
    if (!userSpoken || !userSpoken.trim()) {
      setLiveState("idle");
      return;
    }
    setTranscribedTurn(userSpoken);

    const userEntry = { role: "user" as const, content: userSpoken };
    const updatedHistory = [...history, userEntry];
    setHistory(updatedHistory);

    let fullAnswer = "";
    await streamChat(
      {
        message: userSpoken,
        language,
        history: updatedHistory,
        rolePersona,
        modelTier: "flash",
        enableSearch: true,
      },
      {
        onMeta: () => {},
        onToken: (delta: string) => {
          fullAnswer += delta;
          setAssistantTurn(fullAnswer);
        },
        onGrounding: () => {},
        onDone: () => {
          setHistory((prev) => [...prev, { role: "assistant", content: fullAnswer }]);
          setLiveState("speaking");
          speech.play(fullAnswer, "live-turn", language);
        },
        onError: () => {
          setLiveState("idle");
        },
        signal: undefined,
      }
    );
  };

  useEffect(() => {
    if (!speech.playingId && liveState === "speaking") {
      setLiveState("idle");
    }
  }, [speech.playingId, liveState]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          className="relative w-full max-w-lg p-6 rounded-3xl border border-border bg-card shadow-2xl flex flex-col items-center text-center space-y-6"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-xs font-semibold uppercase tracking-wider">
              <Radio className="w-3.5 h-3.5 animate-pulse" /> Gemini Live Voice Stream
            </div>
            <h2 className="text-xl font-bold font-head tracking-tight">Real-Time Rural Intelligence</h2>
            <p className="text-xs text-muted-foreground">
              Powered by Gemini 3.1 Flash Live & 3.5 Transcribe. Speak freely in Marathi, Hindi, or English.
            </p>
          </div>

          {/* Central Animated Orb */}
          <div className="py-4">
            <Orb state={liveState} size={150} />
          </div>

          {/* Dynamic Status / Caption Box */}
          <div className="w-full min-h-[90px] p-4 rounded-2xl border border-border bg-background/60 flex flex-col justify-center text-sm">
            {recording ? (
              <p className="text-cyan-600 dark:text-cyan-300 font-medium animate-pulse">
                {interimText || "Listening to your voice…"}
              </p>
            ) : liveState === "thinking" ? (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin text-primary" /> Reasoning & searching schemes…
              </div>
            ) : assistantTurn ? (
              <p className="text-foreground text-left line-clamp-3 font-medium">{assistantTurn}</p>
            ) : (
              <p className="text-muted-foreground">Tap the microphone below and ask any question.</p>
            )}
          </div>

          {/* Live Voice Controls */}
          <div className="flex items-center gap-4">
            {recording ? (
              <button
                onClick={handleStopAndSend}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-rose-500 hover:bg-rose-600 text-white font-medium shadow-lg animate-pulse transition-all"
              >
                <Square className="w-4 h-4" /> Stop & Process
              </button>
            ) : (
              <button
                onClick={handleStartListening}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary hover:opacity-90 text-primary-foreground font-medium shadow-lg transition-transform hover:scale-105 active:scale-95"
              >
                <Mic className="w-4 h-4" /> Start Speaking
              </button>
            )}

            {speech.playingId && (
              <button
                onClick={() => speech.stop()}
                className="p-3 rounded-full border border-border hover:bg-accent text-muted-foreground"
                title="Stop Audio"
              >
                <Square className="w-4 h-4" />
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
