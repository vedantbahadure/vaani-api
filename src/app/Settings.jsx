import React, { useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, Volume2, Cpu, Sparkles, Music, Mic, Play, Square, Loader2 } from "lucide-react";
import { useLang, useMode } from "../lib/contexts";
import { t, LANGS } from "../lib/i18n";
import { Switch } from "../components/ui/switch";
import { sfx } from "../lib/sound";
import { useSpeech } from "../lib/useSpeech";

const TTS_VOICES = [
  { id: "Kore", label: "Kore (Female · Warm & Natural)", desc: "Clear, conversational, and gentle tone" },
  { id: "Puck", label: "Puck (Male · Friendly)", desc: "Upbeat, energetic, and engaging" },
  { id: "Zephyr", label: "Zephyr (Female · Soft)", desc: "Calm, soothing, and empathetic" },
  { id: "Fenrir", label: "Fenrir (Male · Deep)", desc: "Authoritative and grounded delivery" },
  { id: "Charon", label: "Charon (Male · Resonant)", desc: "Classic, poised, and articulate" },
];

export default function Settings() {
  const { lang, setLang } = useLang();
  const { mode, setMode } = useMode();
  const { theme, setTheme } = useTheme();
  const speech = useSpeech();
  const [autoVoice, setAutoVoice] = useState(localStorage.getItem("vaani-voice-reply") === "1");
  const [sfxOn, setSfxOn] = useState(sfx.isEnabled());
  const [wakeOn, setWakeOn] = useState(localStorage.getItem("vaani-wakeword") === "1");

  const toggleVoice = (v) => {
    setAutoVoice(v);
    localStorage.setItem("vaani-voice-reply", v ? "1" : "0");
  };
  const toggleSfx = (v) => {
    setSfxOn(v);
    sfx.setEnabled(v);
    if (v) sfx.success();
  };
  const toggleWake = (v) => {
    setWakeOn(v);
    localStorage.setItem("vaani-wakeword", v ? "1" : "0");
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

    speech.play(sampleText, `test-${voiceId}`, lang, voiceId);
  };

  return (
    <div className="px-5 md:px-10 py-8 max-w-2xl mx-auto">
      <h1 className="font-head text-3xl md:text-4xl font-light tracking-tight">{t(lang, "settings_title")}</h1>

      <div className="mt-8 space-y-6">
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

        <Section title={t(lang, "voice")}>
          <div className="space-y-3">
            <label className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-border bg-card/40">
              <span className="flex items-center gap-3 text-sm">
                <Volume2 className="w-5 h-5 text-primary" />
                {t(lang, "voice_reply")}
              </span>
              <Switch checked={autoVoice} onCheckedChange={toggleVoice} data-testid="auto-voice-switch" />
            </label>
            <label className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-border bg-card/40">
              <span className="flex items-center gap-3 text-sm">
                <Mic className="w-5 h-5 text-primary" />
                {lang === "hi" ? "वेक-वर्ड ‘वाणी’ (Wake Word)" : lang === "mr" ? "वेक-वर्ड ‘वाणी’ (Wake Word)" : "Wake word “VAANI”"}
              </span>
              <Switch checked={wakeOn} onCheckedChange={toggleWake} data-testid="wakeword-switch" />
            </label>
            <label className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-border bg-card/40">
              <span className="flex items-center gap-3 text-sm">
                <Music className="w-5 h-5 text-primary" />
                {lang === "hi" ? "ध्वनि प्रभाव" : lang === "mr" ? "ध्वनी प्रभाव" : "Sound effects"}
              </span>
              <Switch checked={sfxOn} onCheckedChange={toggleSfx} data-testid="sfx-switch" />
            </label>

            {/* Neural Voice Persona Selector */}
            <div className="p-4 rounded-2xl border border-border bg-card/40 space-y-3">
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold">
                {lang === "hi" ? "टेक्स्ट-टू-स्पीच आवाज़ (TTS Voice)" : lang === "mr" ? "टेक्स्ट-टू-स्पीच आवाज (TTS Voice)" : "Text-To-Speech Neural Voice"}
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
                      <button
                        onClick={() => speech.setVoice(v.id)}
                        className="flex-1 text-left"
                      >
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
          </div>
        </Section>

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

function Section({ title, children }) {
  return (
    <section>
      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-3">{title}</div>
      {children}
    </section>
  );
}
