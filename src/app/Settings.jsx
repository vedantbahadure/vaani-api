import React, { useState } from "react";
import { useTheme } from "next-themes";
import {
  Sun,
  Moon,
  Monitor,
  Volume2,
  Volume1,
  VolumeX,
  Cpu,
  Sparkles,
  Music,
  Mic,
  MicOff,
  Play,
  Square,
  Radio,
  Gauge,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Zap,
  Layers,
  BookOpen,
} from "lucide-react";
import { useLang, useMode } from "../lib/contexts";
import { t, LANGS } from "../lib/i18n";
import { Switch } from "../components/ui/switch";
import { sfx } from "../lib/sound";
import { useSpeech } from "../lib/useSpeech";
import { useSpeechToText } from "../lib/useVoice";
import { isSpeechRecognitionSupported, SUPPORTED_STT_LANGUAGES } from "../lib/speechRecognition";

const TTS_VOICES = [
  { id: "Kore", label: "Kore (Female · Warm & Natural)", desc: "Clear, conversational, and gentle tone" },
  { id: "Puck", label: "Puck (Male · Friendly)", desc: "Upbeat, energetic, and engaging" },
  { id: "Zephyr", label: "Zephyr (Female · Soft)", desc: "Calm, soothing, and empathetic" },
  { id: "Fenrir", label: "Fenrir (Male · Deep)", desc: "Authoritative and grounded delivery" },
  { id: "Charon", label: "Charon (Male · Resonant)", desc: "Classic, poised, and articulate" },
];

const SPEED_OPTIONS = [
  { value: 0.85, label: "0.85x", desc: "Clear & Deliberate" },
  { value: 1.0, label: "1.0x (Default)", desc: "Fast, Natural & Snappy" },
  { value: 1.15, label: "1.15x", desc: "Brisk & Instant" },
  { value: 1.3, label: "1.3x", desc: "Super Fast" },
];

const AUTO_SPEAK_MODES = [
  {
    id: "always",
    icon: Volume2,
    label: "Always Speak (Auto-Speak)",
    desc: "Speaks aloud automatically for all responses (voice & text)",
    badge: "Recommended",
  },
  {
    id: "voice_only",
    icon: Volume1,
    label: "Voice Queries Only",
    desc: "Speaks aloud automatically only when asking using microphone",
    badge: "Smart",
  },
  {
    id: "off",
    icon: VolumeX,
    label: "Muted / Manual",
    desc: "Only speaks when you tap the volume play icon",
    badge: "Quiet",
  },
];

export default function Settings() {
  const { lang, setLang } = useLang();
  const { mode, setMode } = useMode();
  const { theme, setTheme } = useTheme();
  const speech = useSpeech();

  const [sfxOn, setSfxOn] = useState(sfx.isEnabled());
  const [wakeOn, setWakeOn] = useState(localStorage.getItem("vaani-wakeword") === "1");

  const toggleSfx = (v) => {
    setSfxOn(v);
    sfx.setEnabled(v);
    if (v) sfx.success();
  };

  const toggleWake = (v) => {
    setWakeOn(v);
    localStorage.setItem("vaani-wakeword", v ? "1" : "0");
  };

  const handleTestWebSpeech = () => {
    if (speech.playingId === "test-webspeech") {
      speech.stop();
      return;
    }
    const sampleText =
      lang === "mr"
        ? "नमस्कार! मी वाणी आहे. पीएम किसान सन्मान निधी योजनेचे ६,००० रुपये थेट बँक खात्यात जमा होतात, तसेच सात बारा उतारा ऑनलाइन उपलब्ध आहे."
        : lang === "hi"
        ? "नमस्ते! मैं वाणी हूँ। पीएम किसान सम्मान निधि योजना के ६,००० रुपये सीधे बैंक खाते में आते हैं, और फसल बीमा योजना का लाभ आसानी से मिलता है।"
        : "Hello! I am VAANI. PM-KISAN provides ₹6,000 annually via direct bank transfer, and crop insurance covers natural risks.";

    speech.play(sampleText, "test-webspeech", lang, { engine: speech.engine });
  };

  const handleTestVoice = (voiceId) => {
    if (speech.playingId === `test-${voiceId}`) {
      speech.stop();
      return;
    }
    const sampleText =
      lang === "mr"
        ? "नमस्कार! मी वाणी आहे, ग्रामीण भारतासाठी तुमची विश्वासार्ह सहाय्यक."
        : lang === "hi"
        ? "नमस्ते! मैं वाणी हूँ, ग्रामीण भारत के लिए आपकी विश्वसनीय सहायक।"
        : "Hello! I am VAANI, your voice-first AI assistant for rural governance in India.";

    speech.play(sampleText, `test-${voiceId}`, lang, { customVoice: voiceId, engine: "neural" });
  };

  return (
    <div className="px-5 md:px-10 py-8 max-w-2xl mx-auto">
      <h1 className="font-head text-3xl md:text-4xl font-light tracking-tight">{t(lang, "settings_title")}</h1>

      <div className="mt-8 space-y-6">
        {/* Appearance */}
        <Section title={t(lang, "theme")}>
          <div className="grid grid-cols-3 gap-2">
            {[
              { v: "light", i: Sun, l: t(lang, "light") },
              { v: "dark", i: Moon, l: t(lang, "dark") },
              { v: "system", i: Monitor, l: t(lang, "system") },
            ].map((o) => (
              <button
                key={o.v}
                onClick={() => setTheme(o.v)}
                data-testid={`theme-${o.v}`}
                className={`flex flex-col items-center gap-2 py-4 rounded-2xl border transition-colors duration-300 ${
                  theme === o.v
                    ? "border-primary bg-primary/8 text-foreground"
                    : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                <o.i className="w-5 h-5" />
                <span className="text-xs font-medium">{o.l}</span>
              </button>
            ))}
          </div>
        </Section>

        {/* Language */}
        <Section title={t(lang, "language")}>
          <div className="grid grid-cols-3 gap-2">
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                data-testid={`setting-lang-${l.code}`}
                className={`py-4 rounded-2xl border transition-colors duration-300 ${
                  lang === l.code ? "border-primary bg-primary/8" : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                <div className="font-deva text-base">{l.native}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{l.label}</div>
              </button>
            ))}
          </div>
        </Section>

        {/* Voice & Auto-Speak Settings */}
        <Section title={t(lang, "voice")}>
          <div className="space-y-4">
            {/* Auto-Speak Behavior Selector */}
            <div className="p-4 rounded-2xl border border-border bg-card/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs uppercase tracking-[0.2em] font-semibold text-muted-foreground">
                    Auto-Speak (स्वयंचलित आवाज)
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-medium">
                  Zero-Latency Streaming
                </span>
              </div>

              <div className="space-y-2">
                {AUTO_SPEAK_MODES.map((m) => {
                  const Icon = m.icon;
                  const isSelected = speech.autoSpeakMode === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => speech.setAutoSpeakMode(m.id)}
                      data-testid={`auto-speak-opt-${m.id}`}
                      className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? "border-emerald-500/50 bg-emerald-500/10 text-foreground shadow-xs"
                          : "border-border/60 bg-background/50 text-muted-foreground hover:bg-accent/40"
                      }`}
                    >
                      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? "text-emerald-500" : ""}`} />
                      <div className="flex-1">
                        <div className="text-sm font-semibold flex items-center justify-between">
                          <span>{m.label}</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              isSelected
                                ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {m.badge}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{m.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Wake Word & SFX */}
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-border bg-card/40">
                <span className="flex items-center gap-2.5 text-xs font-medium">
                  <Mic className="w-4 h-4 text-primary" />
                  {lang === "hi" ? "वेक-वर्ड ‘वाणी’" : lang === "mr" ? "वेक-वर्ड ‘वाणी’" : "Wake word “VAANI”"}
                </span>
                <Switch checked={wakeOn} onCheckedChange={toggleWake} data-testid="wakeword-switch" />
              </label>

              <label className="flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-border bg-card/40">
                <span className="flex items-center gap-2.5 text-xs font-medium">
                  <Music className="w-4 h-4 text-primary" />
                  {lang === "hi" ? "ध्वनि प्रभाव (SFX)" : lang === "mr" ? "ध्वनी प्रभाव (SFX)" : "Sound effects (SFX)"}
                </span>
                <Switch checked={sfxOn} onCheckedChange={toggleSfx} data-testid="sfx-switch" />
              </label>
            </div>

            {/* Web Speech API Engine Card */}
            <div className="p-4 rounded-2xl border border-border bg-card/40 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-primary" />
                    {t(lang, "web_speech_title")}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Native browser speech synthesis with Indian regional accent optimization (Marathi, Hindi, English)
                  </div>
                </div>
                <button
                  onClick={handleTestWebSpeech}
                  data-testid="test-web-speech-btn"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/40 bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors shadow-xs"
                >
                  {speech.playingId === "test-webspeech" ? (
                    <>
                      <Square className="w-3 h-3 text-rose-500" /> Stop
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 text-primary" /> Test Voice
                    </>
                  )}
                </button>
              </div>

              {/* Speech Speed / Cadence selector */}
              <div className="pt-2 border-t border-border/50">
                <div className="text-xs font-medium text-foreground mb-2 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-primary" />
                  {t(lang, "speech_speed")}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SPEED_OPTIONS.map((sp) => (
                    <button
                      key={sp.value}
                      onClick={() => speech.setRate(sp.value)}
                      className={`p-2.5 rounded-xl border text-left transition-colors ${
                        Math.abs(speech.rate - sp.value) < 0.04
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border/60 bg-background/50 hover:bg-accent/40 text-muted-foreground"
                      }`}
                    >
                      <div className="text-xs font-semibold">{sp.label}</div>
                      <div className="text-[10px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">
                        {sp.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Engine Switcher: Web Speech vs Neural */}
              <div className="pt-2 border-t border-border/50 flex items-center justify-between flex-wrap gap-2">
                <div className="text-xs font-medium">TTS Synthesis Engine:</div>
                <div className="flex items-center gap-1 bg-background p-1 rounded-xl border border-border">
                  <button
                    onClick={() => speech.setEngine("webspeech")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      speech.engine === "webspeech"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Web Speech (Instant & Streamed)
                  </button>
                  <button
                    onClick={() => speech.setEngine("neural")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      speech.engine === "neural"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Gemini Neural
                  </button>
                </div>
              </div>

              {/* Available Browser Voices Preview if in WebSpeech mode */}
              {speech.engine === "webspeech" && speech.availableVoices.length > 0 && (
                <div className="pt-2 border-t border-border/50 space-y-1.5">
                  <div className="text-[11px] font-medium text-muted-foreground">
                    Detected System Voices ({speech.availableVoices.length}):
                  </div>
                  <select
                    value={speech.selectedVoiceURI || ""}
                    onChange={(e) => speech.setWebSpeechVoice(e.target.value)}
                    className="w-full text-xs p-2 rounded-xl border border-border bg-background outline-none font-medium"
                  >
                    <option value="">Auto-select highest quality voice for {lang.toUpperCase()} (Recommended)</option>
                    {speech.availableVoices.map((v, i) => (
                      <option key={i} value={v.voiceURI || v.name}>
                        {v.name} ({v.lang}) {v.default ? "— System Default" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Neural Voice Persona Selector */}
            {speech.engine === "neural" && (
              <div className="p-4 rounded-2xl border border-border bg-card/40 space-y-3">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold">
                  {lang === "hi"
                    ? "जेमिनी न्यूरल आवाज़ (Neural TTS)"
                    : lang === "mr"
                    ? "जेमिनी न्यूरल आवाज (Neural TTS)"
                    : "Gemini Neural Voices"}
                </div>
                <div className="space-y-2">
                  {TTS_VOICES.map((v) => {
                    const isSelected = speech.voiceName === v.id;
                    const isPlaying = speech.playingId === `test-${v.id}`;
                    return (
                      <div
                        key={v.id}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-colors duration-200 ${
                          isSelected
                            ? "border-primary bg-primary/10"
                            : "border-border/60 bg-background/50 hover:bg-accent/40"
                        }`}
                      >
                        <button onClick={() => speech.setVoice(v.id)} className="flex-1 text-left">
                          <div className="text-sm font-medium flex items-center gap-2">
                            {v.label}
                            {isSelected && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-semibold">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">{v.desc}</div>
                        </button>
                        <button
                          onClick={() => handleTestVoice(v.id)}
                          className="p-2 rounded-full border border-border bg-card hover:bg-accent transition-colors shrink-0 ml-2"
                          title="Preview voice"
                        >
                          {isPlaying ? (
                            <Square className="w-4 h-4 text-rose-500" />
                          ) : (
                            <Play className="w-4 h-4 text-primary" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* Speech-To-Text (STT) & Native Microphone Engine */}
        <Section title="Speech-To-Text (STT) Recognition">
          <STTDiagnosticCard defaultLang={lang} />
        </Section>

        {/* Experience Mode */}
        <Section title={t(lang, "mode")}>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode("showcase")}
              data-testid="mode-showcase"
              className={`flex flex-col items-start gap-1 p-4 rounded-2xl border text-left transition-colors duration-300 ${
                mode === "showcase" ? "border-primary bg-primary/8" : "border-border hover:bg-accent"
              }`}
            >
              <Sparkles className="w-5 h-5 text-primary mb-1" />
              <span className="text-sm font-medium">{t(lang, "showcase")}</span>
              <span className="text-xs text-muted-foreground">Full 3D, particles, bloom, cinematic motion.</span>
            </button>
            <button
              onClick={() => setMode("device")}
              data-testid="mode-device"
              className={`flex flex-col items-start gap-1 p-4 rounded-2xl border text-left transition-colors duration-300 ${
                mode === "device" ? "border-primary bg-primary/8" : "border-border hover:bg-accent"
              }`}
            >
              <Cpu className="w-5 h-5 text-primary mb-1" />
              <span className="text-sm font-medium">{t(lang, "device")}</span>
              <span className="text-xs text-muted-foreground">Lightweight for Raspberry Pi. Same identity, higher speed.</span>
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
}

function STTDiagnosticCard({ defaultLang = "en" }) {
  const [selectedLang, setSelectedLang] = useState(defaultLang);
  const isSupported = isSpeechRecognitionSupported();

  const {
    isListening,
    transcript,
    interimTranscript,
    audioLevel,
    error,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechToText({
    lang: selectedLang,
    continuous: true,
    interimResults: true,
  });

  const handleToggle = async () => {
    if (isListening) {
      stopListening();
    } else {
      await startListening(selectedLang);
    }
  };

  const currentLangObj = SUPPORTED_STT_LANGUAGES[selectedLang] || {
    code: "en-IN",
    label: "English (India)",
  };

  return (
    <div className="p-4 md:p-5 rounded-3xl border border-border bg-card/60 space-y-4">
      {/* Header with browser capability status */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Browser-Native Speech-To-Text</h3>
            <p className="text-xs text-muted-foreground">
              Zero-latency on-device transcription with regional Indian accent modeling
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-border bg-background">
          {isSupported ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400">SpeechRecognition Active</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-amber-600 dark:text-amber-400">Server Audio Fallback Active</span>
            </>
          )}
        </div>
      </div>

      {/* Language Selector & Mic Test Button */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        <div className="sm:col-span-2 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Target Recognition Language:</label>
          <select
            value={selectedLang}
            onChange={(e) => {
              const newL = e.target.value;
              setSelectedLang(newL);
              if (isListening) {
                stopListening();
              }
            }}
            className="w-full text-xs p-2.5 rounded-xl border border-border bg-background outline-none font-medium"
          >
            {Object.entries(SUPPORTED_STT_LANGUAGES).map(([key, info]) => (
              <option key={key} value={key}>
                {info.label} ({info.code})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={handleToggle}
            className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              isListening
                ? "bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/30"
                : "bg-primary text-primary-foreground hover:opacity-90 shadow-xs"
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="w-3.5 h-3.5" />
                <span>Stop Listening</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5" />
                <span>Test Microphone</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Live Audio Level Meter */}
      {isListening && (
        <div className="p-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Microphone Live ({currentLangObj.code})
            </span>
            <span className="text-[11px] font-mono text-muted-foreground">
              Volume: {Math.round(audioLevel * 100)}%
            </span>
          </div>

          <div className="w-full bg-emerald-950/20 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-75"
              style={{ width: `${Math.max(5, Math.min(100, audioLevel * 100))}%` }}
            />
          </div>
        </div>
      )}

      {/* Transcription Results Box */}
      <div className="p-3.5 rounded-2xl border border-border bg-background/80 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-muted-foreground">Live Transcribed Text:</span>
          {(transcript || interimTranscript) && (
            <button
              onClick={resetTranscript}
              className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        <div className="min-h-[4rem] text-xs leading-relaxed p-2.5 rounded-xl border border-border/60 bg-card/40 font-medium text-foreground">
          {transcript ? (
            <span className="text-foreground">{transcript} </span>
          ) : null}
          {interimTranscript ? (
            <span className="text-emerald-600 dark:text-emerald-400 italic">
              {interimTranscript}
            </span>
          ) : null}
          {!transcript && !interimTranscript && (
            <span className="text-muted-foreground italic">
              {isListening
                ? `Listening in ${currentLangObj.label}... start speaking!`
                : "Tap 'Test Microphone' above and speak in Marathi, Hindi, or English to see real-time transcription."}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="text-xs text-rose-500 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-3">{title}</div>
      {children}
    </section>
  );
}
