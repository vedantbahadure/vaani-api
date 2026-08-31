import React, { useState } from "react";
import { Mic, MicOff, Loader2, Volume2, AlertCircle, Check } from "lucide-react";
import { useSpeechToText } from "../lib/useVoice";
import { useLang } from "../lib/contexts";
import { t } from "../lib/i18n";
import { SUPPORTED_STT_LANGUAGES } from "../lib/speechRecognition";

/**
 * Reusable Speech-To-Text Input Control
 * Provides one-tap speech transcription using browser-native SpeechRecognition.
 */
export function SpeechToTextInput({
  value = "",
  onChange = () => {},
  onTranscribe = () => {},
  placeholder = "",
  className = "",
  inputClassName = "",
  lang: customLang = null,
  rows = 2,
  showLanguageBadge = true,
}) {
  const { lang: globalLang } = useLang();
  const activeLang = customLang || globalLang;

  const [lastTranscribed, setLastTranscribed] = useState("");

  const {
    isListening,
    isSupported,
    interimTranscript,
    audioLevel,
    error,
    startListening,
    stopListening,
  } = useSpeechToText({
    lang: activeLang,
    continuous: true,
    interimResults: true,
    onResult: (text) => {
      if (text) {
        setLastTranscribed(text);
        onChange(text);
      }
    },
  });

  const handleToggleListening = async () => {
    if (isListening) {
      const finalVal = stopListening();
      if (finalVal) {
        onChange(finalVal);
        onTranscribe(finalVal);
      }
    } else {
      const ok = await startListening(activeLang);
      if (!ok && !isSupported) {
        // Fallback notification handled by error state
      }
    }
  };

  const langInfo = SUPPORTED_STT_LANGUAGES[activeLang] || {
    code: "en-IN",
    label: activeLang.toUpperCase(),
  };

  return (
    <div className={`relative flex flex-col space-y-2 ${className}`}>
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            isListening
              ? `${t(activeLang, "listening_speak_now")} (${langInfo.label})...`
              : placeholder || t(activeLang, "ask_placeholder")
          }
          rows={rows}
          className={`w-full rounded-2xl border border-border bg-background px-3.5 py-2.5 pr-14 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary/40 resize-none transition-all ${
            isListening ? "border-emerald-500 ring-2 ring-emerald-500/20" : ""
          } ${inputClassName}`}
        />

        {/* Mic toggle button */}
        <div className="absolute right-2 bottom-2.5 flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleToggleListening}
            className={`p-2 rounded-xl transition-all cursor-pointer ${
              isListening
                ? "bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/30"
                : "bg-muted hover:bg-accent text-foreground"
            }`}
            title={
              isListening
                ? "Stop speech recognition"
                : `Tap to dictate in ${langInfo.label}`
            }
          >
            {isListening ? (
              <MicOff className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4 text-primary" />
            )}
          </button>
        </div>
      </div>

      {/* Live Interim Transcript & Audio Meter Bar */}
      {isListening && (
        <div className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex flex-col gap-1.5 animate-fadeIn">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Browser Speech-to-Text ({langInfo.code})</span>
            </div>

            {showLanguageBadge && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                Live STT
              </span>
            )}
          </div>

          {/* Real-time speech preview */}
          <div className="text-xs text-foreground/90 font-medium italic min-h-[1.25rem]">
            {interimTranscript ? (
              <span>“{interimTranscript}”</span>
            ) : (
              <span className="text-muted-foreground">Listening for words...</span>
            )}
          </div>

          {/* Visual volume level bar */}
          <div className="w-full bg-emerald-950/20 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-75"
              style={{ width: `${Math.max(5, Math.min(100, audioLevel * 100))}%` }}
            />
          </div>
        </div>
      )}

      {/* Error state display */}
      {error && !isListening && (
        <div className="text-xs text-rose-500 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
