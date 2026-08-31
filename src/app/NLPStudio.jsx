import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Cpu,
  Volume2,
  AlertTriangle,
  CheckCircle2,
  PhoneCall,
  ArrowRight,
  RefreshCw,
  Copy,
  Check,
  Layers,
  FileCode,
  Mic,
  MicOff,
  Zap,
  Tag,
  Gauge,
  HelpCircle,
} from "lucide-react";
import { useLang } from "../lib/contexts";
import { t, LANGS } from "../lib/i18n";
import { analyzeClientNLP, NLP_PROMPT_PRESETS, RURAL_INTENT_CATEGORIES } from "../lib/nlp";
import { analyzeNLPQuery } from "../lib/api";
import { useVoiceRecorder } from "../lib/useVoice";
import { useSpeech } from "../lib/useSpeech";
import { useNavigate } from "react-router-dom";

export default function NLPStudio() {
  const { lang } = useLang();
  const { isSpeaking, speakText, stopSpeaking } = useSpeech();
  const navigate = useNavigate();

  const [query, setQuery] = useState(NLP_PROMPT_PRESETS[0].text);
  const [activeLang, setActiveLang] = useState(NLP_PROMPT_PRESETS[0].lang || lang);
  const [useDeepLLM, setUseDeepLLM] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState(() => analyzeClientNLP(NLP_PROMPT_PRESETS[0].text, NLP_PROMPT_PRESETS[0].lang));
  const [copiedJSON, setCopiedJSON] = useState(false);
  const [activeTab, setActiveTab] = useState("overview"); // overview | entities | speech | raw

  const voice = useVoiceRecorder(activeLang);

  const toggleMic = async () => {
    if (voice.recording) {
      const text = await voice.stop();
      if (text) {
        setQuery(text);
      }
    } else {
      await voice.start();
    }
  };

  // Run analysis when query, activeLang, or useDeepLLM changes
  useEffect(() => {
    let isCancelled = false;

    async function runAnalysis() {
      if (!query.trim()) return;
      setIsLoading(true);

      // 1. Instant local baseline (0ms)
      const localResult = analyzeClientNLP(query, activeLang);
      setAnalysis(localResult);

      // 2. If deep LLM analysis requested, fetch rich semantic breakdown
      if (useDeepLLM) {
        try {
          const deepResult = await analyzeNLPQuery({
            query,
            language: activeLang,
            useDeepAnalysis: true,
          });
          if (!isCancelled && deepResult) {
            setAnalysis({
              ...localResult,
              ...deepResult,
              speechNormalization: localResult.speechNormalization,
            });
          }
        } catch (err) {
          console.warn("Deep NLP fetch failed, using local NLP analysis:", err);
        }
      }
      setIsLoading(false);
    }

    const timer = setTimeout(runAnalysis, useDeepLLM ? 350 : 50);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [query, activeLang, useDeepLLM]);

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(analysis, null, 2));
    setCopiedJSON(true);
    setTimeout(() => setCopiedJSON(false), 2000);
  };

  const handlePlaySpoken = () => {
    if (isSpeaking) {
      stopSpeaking();
    } else {
      const textToSpeak = analysis?.speechNormalization?.spokenText || query;
      speakText(textToSpeak, activeLang);
    }
  };

  const getUrgencyBadge = (urgency) => {
    switch (urgency) {
      case "critical":
        return "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30";
      case "high":
        return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
      case "medium":
        return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30";
      default:
        return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 animate-fade-in" data-testid="nlp-studio-view">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <Cpu className="w-6 h-6" />
            </span>
            <h1 className="text-2xl md:text-3xl font-display font-bold">
              VAANI NLP & NLU Studio
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">
            Real-time Natural Language Understanding, Rural Named Entity Recognition (NER), Sentiment & Distress Detection, and Spoken Phonetics Engine.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setUseDeepLLM(!useDeepLLM)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
              useDeepLLM
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-accent/50 text-muted-foreground border-border hover:bg-accent"
            }`}
            data-testid="toggle-deep-llm-nlp"
          >
            <Zap className={`w-3.5 h-3.5 ${useDeepLLM ? "fill-current" : ""}`} />
            {useDeepLLM ? "Gemini Deep Semantic NLU" : "Fast Local Rule NLU"}
          </button>

          <button
            onClick={handleCopyJSON}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border border-border hover:bg-accent text-muted-foreground transition-colors"
          >
            {copiedJSON ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedJSON ? "Copied JSON" : "Export JSON"}
          </button>
        </div>
      </div>

      {/* Preset Prompts Carousel */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          <span>Rural Test Presets (मराठी, हिन्दी & English)</span>
          <span>{NLP_PROMPT_PRESETS.length} Scenarios</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {NLP_PROMPT_PRESETS.map((p, idx) => (
            <button
              key={idx}
              onClick={() => {
                setQuery(p.text);
                setActiveLang(p.lang);
              }}
              className={`p-2.5 text-left rounded-xl border text-xs transition-all ${
                query === p.text
                  ? "border-primary bg-primary/5 font-semibold text-primary shadow-sm"
                  : "border-border hover:border-primary/40 bg-card text-card-foreground"
              }`}
            >
              <div className="text-[10px] text-muted-foreground mb-1 flex items-center justify-between">
                <span>{p.category}</span>
                <span className="uppercase font-mono px-1 py-0.5 rounded bg-muted text-[9px]">{p.lang}</span>
              </div>
              <div className="line-clamp-2">{p.title}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Query Input Box */}
      <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-4">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Live Query Input for NLP Processing
          </label>
          <div className="flex items-center gap-2">
            <select
              value={activeLang}
              onChange={(e) => setActiveLang(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground"
            >
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label} ({l.native})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="relative">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={3}
            placeholder="Type or speak a rural governance / farming query in Marathi, Hindi, or English..."
            className="w-full p-3.5 pr-14 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
            data-testid="nlp-query-input"
          />

          <button
            type="button"
            onClick={toggleMic}
            className={`absolute right-3 bottom-4 p-2 rounded-xl transition-all ${
              voice.recording
                ? "bg-red-500 text-white animate-pulse"
                : "bg-accent hover:bg-primary/20 text-muted-foreground hover:text-foreground"
            }`}
            title={voice.recording ? "Stop Listening" : "Voice Dictate Query"}
          >
            {voice.recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            {isLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" />}
            <span>{query.length} characters • {query.split(/\s+/).filter(Boolean).length} tokens</span>
          </div>

          <button
            onClick={() => navigate(`/app/chat?q=${encodeURIComponent(query)}`)}
            className="flex items-center gap-1.5 text-primary hover:underline font-medium"
          >
            <span>Ask in Live Chat</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Distress & Urgent Hotline Banner */}
      {analysis?.sentiment?.distressSignal && analysis?.sentiment?.recommendedHelpline && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-shake">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
                <span>Farmer Distress / Urgent Emergency Signal Detected</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-600 dark:text-red-300 font-mono uppercase">
                  {analysis.sentiment.urgency}
                </span>
              </div>
              <p className="text-xs text-red-600/90 dark:text-red-400/90 mt-0.5">
                {analysis.sentiment.recommendedHelpline.description}
              </p>
            </div>
          </div>

          <a
            href={`tel:${analysis.sentiment.recommendedHelpline.number}`}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-sm transition"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Call {analysis.sentiment.recommendedHelpline.name} ({analysis.sentiment.recommendedHelpline.number})</span>
          </a>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-1">
        {[
          { id: "overview", label: "Semantic NLU Overview", icon: Gauge },
          { id: "entities", label: `Extracted Entities (${analysis?.entities?.length || 0})`, icon: Tag },
          { id: "speech", label: "Speech Phonetics Normalizer", icon: Volume2 },
          { id: "raw", label: "Raw JSON AST", icon: FileCode },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition ${
              activeTab === tab.id
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Intent Card */}
          <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Intent Classification
              </span>
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {Math.round((analysis?.intent?.confidence || 0.8) * 100)}% Confidence
              </span>
            </div>

            <div>
              <div className="text-base font-bold text-foreground">
                {analysis?.intent?.name || "General Inquiry"}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Category: <span className="font-semibold text-foreground">{analysis?.intent?.category || "General"}</span>
              </div>
            </div>

            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.round((analysis?.intent?.confidence || 0.8) * 100)}%` }}
              />
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {analysis?.intent?.description || "Categorized based on rural governance keywords and Devanagari semantics."}
            </p>
          </div>

          {/* Sentiment & Urgency Card */}
          <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Sentiment & Urgency
            </span>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-accent/40 border border-border">
                <div className="text-[10px] text-muted-foreground uppercase">Sentiment</div>
                <div className="text-sm font-bold capitalize mt-0.5 text-foreground">
                  {analysis?.sentiment?.polarity || "Neutral"}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-accent/40 border border-border">
                <div className="text-[10px] text-muted-foreground uppercase">Urgency</div>
                <div className={`text-xs font-bold uppercase mt-0.5 px-2 py-0.5 rounded-full inline-block border ${getUrgencyBadge(analysis?.sentiment?.urgency)}`}>
                  {analysis?.sentiment?.urgency || "Medium"}
                </div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              Semantic Score: <span className="font-mono font-semibold">{analysis?.sentiment?.score?.toFixed(2) || "0.00"}</span> (-1.0 to +1.0)
            </div>
          </div>

          {/* Citizen Executive Summary */}
          <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Executive Key Takeaways
            </span>

            <ul className="space-y-2">
              {(analysis?.summary || []).map((point, i) => (
                <li key={i} className="text-xs text-foreground flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Suggested Follow-Ups */}
          <div className="md:col-span-3 p-5 rounded-2xl border border-border bg-card shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Recommended Citizen Follow-Up Questions (NLU Grounding)</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {(analysis?.suggestedFollowUps || []).map((f, i) => (
                <button
                  key={i}
                  onClick={() => navigate(`/app/chat?q=${encodeURIComponent(f)}`)}
                  className="px-3 py-2 rounded-xl bg-accent/60 hover:bg-accent border border-border text-xs text-foreground text-left transition flex items-center gap-2 group"
                >
                  <span>{f}</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground group-hover:text-primary transition" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Entities (NER) */}
      {activeTab === "entities" && (
        <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground">
                Extracted Rural Entities ({analysis?.entities?.length || 0})
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Automatically identified crops, land holdings, citizen names, schemes, Aadhaar numbers, and financial sums.
              </p>
            </div>
          </div>

          {(!analysis?.entities || analysis.entities.length === 0) ? (
            <div className="text-center py-12 text-muted-foreground text-xs">
              No specific named entities detected in this query. Try a preset with land size, crop names, or scheme details.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {analysis.entities.map((ent, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-border bg-accent/30 flex items-start justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {ent.type || ent.label}
                      </span>
                      {ent.confidence && (
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {Math.round(ent.confidence * 100)}%
                        </span>
                      )}
                    </div>

                    <div className="text-sm font-semibold text-foreground pt-1">
                      {ent.value}
                    </div>

                    {ent.normalized && ent.normalized !== ent.value && (
                      <div className="text-[11px] text-muted-foreground font-mono">
                        Standardized: {ent.normalized}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Speech Phonetics Normalizer */}
      {activeTab === "speech" && (
        <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground">
                Spoken Phonetics Normalizer (TTS Audio Pipeline)
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Converts raw symbols, currency signs, Devanagari numbers, and acronyms into natural, cadence-paced spoken words.
              </p>
            </div>

            <button
              onClick={handlePlaySpoken}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-sm hover:opacity-90 transition"
              data-testid="listen-normalized-speech"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>{isSpeaking ? "Stop Voice" : "Listen to Spoken Phonetics"}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Raw Written Input */}
            <div className="p-4 rounded-xl border border-border bg-background space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                1. Raw Written Text (Visual View)
              </span>
              <div className="text-sm font-mono text-foreground leading-relaxed p-3 bg-muted/30 rounded-lg min-h-[100px]">
                {query}
              </div>
            </div>

            {/* Spoken Phonetic Output */}
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                2. Spoken Phonetic Expansion (TTS Output)
              </span>
              <div className="text-sm font-mono text-emerald-950 dark:text-emerald-100 leading-relaxed p-3 bg-emerald-500/10 rounded-lg min-h-[100px]">
                {analysis?.speechNormalization?.spokenText || query}
              </div>
            </div>
          </div>

          {/* Transformations List */}
          <div className="space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Applied Phonetic Transformations ({analysis?.speechNormalization?.transformations?.length || 0})
            </span>

            {(!analysis?.speechNormalization?.transformations || analysis.speechNormalization.transformations.length === 0) ? (
              <div className="text-xs text-muted-foreground italic">
                Text is already in clean phonetic format.
              </div>
            ) : (
              <div className="space-y-2">
                {analysis.speechNormalization.transformations.map((t, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-border bg-accent/20 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-rose-500 line-through">{t.original}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{t.spoken}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      {t.rule}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Raw JSON AST */}
      {activeTab === "raw" && (
        <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Full Structured NLP Payload (JSON AST)
            </span>
            <button
              onClick={handleCopyJSON}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              {copiedJSON ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              {copiedJSON ? "Copied" : "Copy Payload"}
            </button>
          </div>

          <pre className="p-4 rounded-xl bg-muted/60 text-foreground font-mono text-xs overflow-x-auto max-h-[480px]">
            {JSON.stringify(analysis, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
