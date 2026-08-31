import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Mic,
  Square,
  Volume2,
  VolumeX,
  Volume1,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  SkipBack,
  Loader2,
  Bookmark,
  Plus,
  Sparkles,
  Languages,
  Wand2,
  Radio,
  Search,
  MapPin,
  Bot,
  SlidersHorizontal,
  ChevronDown,
  Layers,
  Zap,
  Gauge,
  Headphones,
  FileCheck,
  Cpu,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { Orb } from "../components/Orb";
import { Waveform } from "../components/Waveform";
import { ConfidenceBadge } from "../components/ConfidenceBadge";
import { CitationCard } from "../components/CitationCard";
import { RichText } from "../components/RichText";
import { useLang, useOrb, useAuth } from "../lib/contexts";
import { t, SUGGESTIONS, LANGS } from "../lib/i18n";
import { streamChat, getConversation, addBookmark, http } from "../lib/api";
import { analyzeClientNLP } from "../lib/nlp";
import { useVoiceRecorder } from "../lib/useVoice";
import { useSpeech } from "../lib/useSpeech";
import { useWakeWord } from "../lib/useWakeWord";
import { sfx } from "../lib/sound";
import { contextualActions } from "../lib/followups";
import { runDemo, DEMO_STEPS } from "../lib/demo";
import { LiveVoiceModal } from "../components/LiveVoiceModal";
import { db } from "../lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

const ROLE_PERSONAS = [
  { id: "rural_advisor", name: "Rural Intelligence Advisor", desc: "General government schemes, village panchayat guidelines & entitlements" },
  { id: "crop_specialist", name: "Senior Agronomist", desc: "PMFBY crop insurance, weather advisory, soil health & pest management" },
  { id: "scheme_navigator", name: "DBT & Scheme Navigator", desc: "Aadhaar seeding, PM-KISAN, KCC, Ration & documentation checklists" },
];

const MODEL_TIERS = [
  { id: "flash", name: "Gemini 3.5 Flash", badge: "Balanced & Grounded", desc: "Fast & thorough with Google Search/Maps" },
  { id: "pro", name: "Gemini 3.1 Pro Preview", badge: "Deep Analytical Reasoning", desc: "For highly complex legal & scheme appeals" },
  { id: "lite", name: "Gemini 3.1 Flash Lite", badge: "Ultra Fast", desc: "Instant low-latency responses" },
];

const SPEEDS = [
  { val: 0.85, label: "0.85x", desc: "Deliberate" },
  { val: 0.95, label: "0.95x", desc: "Normal" },
  { val: 1.15, label: "1.15x", desc: "Brisk" },
];

export default function Chat() {
  const { lang, setLang } = useLang();
  const { setOrbState } = useOrb();
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [convId, setConvId] = useState(id || null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [translations, setTranslations] = useState({});
  const [translatingId, setTranslatingId] = useState(null);
  const [nlpOpenId, setNlpOpenId] = useState(null);

  // Gemini Role, Model Tier & Grounding toggles
  const [rolePersona, setRolePersona] = useState("rural_advisor");
  const [modelTier, setModelTier] = useState("flash");
  const [enableSearch, setEnableSearch] = useState(true);
  const [enableMaps, setEnableMaps] = useState(false);
  const [liveVoiceOpen, setLiveVoiceOpen] = useState(false);

  const scrollRef = useRef(null);
  const { recording, transcribing, interimText, start, stop, getAnalyser } = useVoiceRecorder(lang);
  const speech = useSpeech();

  // Auto-Speak mode: "always" | "voice_only" | "off"
  const autoSpeakMode = speech.autoSpeakMode || "always";

  const handleSetAutoSpeakMode = useCallback((mode) => {
    speech.setAutoSpeakMode(mode);
    if (mode === "always") {
      toast.success(lang === "mr" ? "नेहमी ऑडिओ उत्तर (Auto-Speak चालू)" : lang === "hi" ? "हमेशा बोलकर उत्तर (Auto-Speak चालू)" : "Auto-Speak: Always Speak Enabled");
    } else if (mode === "voice_only") {
      toast.success(lang === "mr" ? "केवळ आवाजाने विचारल्यावर ऑडिओ" : lang === "hi" ? "केवल बोलकर पूछने पर ऑडिओ" : "Auto-Speak: Voice Queries Only");
    } else {
      toast.info(lang === "mr" ? "ऑडिओ म्यूट केला" : lang === "hi" ? "ऑडियो म्यूट किया गया" : "Auto-Speak: Muted");
      speech.stop();
    }
  }, [lang, speech]);

  const streamingRef = useRef(false);
  useEffect(() => { streamingRef.current = streaming; }, [streaming]);
  const demoCancel = useRef(false);
  const [demo, setDemo] = useState({ running: false, step: 0, total: DEMO_STEPS });

  useEffect(() => {
    if (id) {
      getConversation(id).then((d) => {
        setConvId(id);
        setMessages(d.messages.map((m) => ({ ...m, done: true })));
      }).catch(() => {});
    } else {
      setMessages([]); setConvId(null);
      const pending = sessionStorage.getItem("vaani-pending-q");
      if (pending) {
        sessionStorage.removeItem("vaani-pending-q");
        setTimeout(() => send(pending), 50);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const playTTS = useCallback((text, msgId, customOptions = {}) => {
    const targetLang = customOptions.lang || lang;
    speech.play(text, msgId, targetLang, customOptions);
  }, [speech, lang]);

  useEffect(() => {
    if (speech.playingId && !speech.isPaused) {
      setOrbState("speaking");
    } else if (!streaming && !recording) {
      setOrbState("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.playingId, speech.isPaused, streaming, recording]);

  const translateMsg = useCallback(async (m) => {
    if (translatingId) return;
    if (translations[m.id]) { setTranslations((t) => ({ ...t, [m.id]: null })); return; }
    const target = lang === "en" ? "hi" : "en";
    setTranslatingId(m.id);
    try {
      const { data } = await http.post("/translate", { text: m.content, target });
      setTranslations((t) => ({ ...t, [m.id]: { text: data.text, target } }));
    } catch { toast.error("Translation failed"); }
    finally { setTranslatingId(null); }
  }, [lang, translations, translatingId]);

  // Persist message to Firebase Firestore if user is authenticated
  const persistMessageToFirestore = async (messageData, conversationId) => {
    if (!user) return;
    try {
      const convRef = doc(db, "conversations", conversationId);
      await setDoc(
        convRef,
        {
          id: conversationId,
          userId: user.uid,
          updatedAt: serverTimestamp(),
          rolePersona,
          modelTier,
        },
        { merge: true }
      );

      const msgDocRef = doc(db, "messages", messageData.id);
      await setDoc(msgDocRef, {
        ...messageData,
        userId: user.uid,
        conversationId,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn("Firestore sync non-blocking error:", err);
    }
  };

  // Helper to accurately detect standalone greetings without hijacking complex questions
  const isGreeting = (text) => {
    if (!text) return false;
    const clean = text.toLowerCase().trim().replace(/[.,!?:;।]/g, "").trim();
    const singleWordGreetings = new Set([
      "hi", "hello", "hey", "namaste", "namaskar", "namaskaram",
      "नमस्कार", "नमस्ते", "हेल्लो", "हॅलो", "हाय", "राम राम", "जय हरी", "प्रणाम"
    ]);
    const phraseGreetings = [
      "hi vaani", "hello vaani", "hey vaani", "namaste vaani", "namaskar vaani",
      "नमस्कार वाणी", "नमस्ते वाणी", "हॅलो वाणी", "हाय वाणी", "वाणी दीदी", "वाणी ताई",
      "good morning", "good evening", "good afternoon", "शुभ प्रभात", "शुभ सकाळ", "शुभ संध्याकाळ"
    ];
    if (singleWordGreetings.has(clean) || phraseGreetings.includes(clean)) {
      return true;
    }
    const words = clean.split(/\s+/);
    if (words.length <= 3 && words.every((w) => singleWordGreetings.has(w) || ["vaani", "vani", "वाणी", "ji", "जी", "दीदी", "didi", "tai", "ताई", "there"].includes(w))) {
      return true;
    }
    return false;
  };

  const getGreetingResponse = () => {
    const greetings = {
      en: "Hello! I am Vaani. How can I help you today? Feel free to ask me anything about government schemes, agriculture, or rural services.",
      hi: "नमस्ते! मैं वाणी हूँ। मैं आज आपकी क्या सहायता कर सकती हूँ? आप मुझसे सरकारी योजनाओं, खेती या किसी भी विषय पर पूछ सकते हैं।",
      mr: "नमस्कार! मी वाणी आहे. मी आपल्याला आज कशी मदत करू शकते? आपण मला शेती, सरकारी योजना किंवा इतर कोणत्याही विषयावर विचारू शकता.",
    };
    return greetings[lang] || greetings.en;
  };

  const send = useCallback(async (text, langOverride, isVoiceQuery = false) => {
    const msg = (text ?? input).trim();
    if (!msg || streaming) return;
    const useLangCode = langOverride || lang;
    speech.stop();
    sfx.send();
    setInput("");

    // Check for greeting
    if (isGreeting(msg)) {
        const userMsgId = `u-${Date.now()}`;
        const aId = `a-${Date.now()}`;
        const userMsg = { id: userMsgId, role: "user", content: msg, done: true, language: useLangCode, isVoice: isVoiceQuery };
        const assistantMsg = { id: aId, role: "assistant", content: getGreetingResponse(), done: true, language: useLangCode, fromVoiceQuery: isVoiceQuery };
        
        setMessages((m) => [...m, userMsg, assistantMsg]);
        persistMessageToFirestore(userMsg, convId || `conv-${Date.now()}`);
        persistMessageToFirestore(assistantMsg, convId || `conv-${Date.now()}`);
        const shouldSpeakGreeting = autoSpeakMode === "always" || (autoSpeakMode === "voice_only" && isVoiceQuery);
        if (shouldSpeakGreeting) playTTS(assistantMsg.content, aId);
        return;
    }

    const currentConvId = convId || `conv-${Date.now()}`;
    if (!convId) setConvId(currentConvId);

    const userMsgId = `u-${Date.now()}`;
    const userMsg = {
      id: userMsgId,
      role: "user",
      content: msg,
      done: true,
      language: useLangCode,
      isVoice: isVoiceQuery,
    };
    const aId = `a-${Date.now()}`;

    // Prepare multi-turn history snapshot
    const historyPayload = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((m) => [
      ...m,
      userMsg,
      {
        id: aId,
        role: "assistant",
        content: "",
        citations: [],
        confidence: 0,
        grounded: false,
        done: false,
        modelUsed: modelTier,
        fromVoiceQuery: isVoiceQuery,
      },
    ]);
    setStreaming(true);
    setOrbState("thinking");

    // Sync user message to Firestore
    persistMessageToFirestore(userMsg, currentConvId);

    // Initialize Partial Text Streaming TTS for auto-speak mode
    const shouldStreamTTS = autoSpeakMode === "always" || (autoSpeakMode === "voice_only" && isVoiceQuery);
    const streamTTS = shouldStreamTTS
      ? speech.startStreamTTS(aId, useLangCode)
      : null;

    let finalText = "";
    let capturedGrounding = null;
    let modelReported = "";

    await streamChat(
      {
        message: msg,
        conversation_id: currentConvId,
        language: useLangCode,
        history: historyPayload,
        rolePersona,
        modelTier,
        enableSearch,
        enableMaps,
      },
      {
        onMeta: (meta) => {
          if (meta.conversation_id && !convId) setConvId(meta.conversation_id);
          modelReported = meta.modelUsed || "";
          setMessages((m) =>
            m.map((x) =>
              x.id === aId
                ? {
                    ...x,
                    citations: meta.citations || [],
                    confidence: meta.confidence,
                    grounded: meta.grounded,
                    modelUsed: meta.modelUsed,
                  }
                : x
            )
          );
        },
        onToken: (delta) => {
          finalText += delta;
          setMessages((m) => m.map((x) => (x.id === aId ? { ...x, content: x.content + delta } : x)));
          // Stream partial token chunk directly into speech synthesis queue
          if (streamTTS) {
            streamTTS.feed(delta);
          }
        },
        onGrounding: (gData) => {
          capturedGrounding = gData;
          setMessages((m) => m.map((x) => (x.id === aId ? { ...x, groundingMetadata: gData } : x)));
        },
        onDone: (d) => {
          setStreaming(false);
          setOrbState("success");
          sfx.success();
          setTimeout(() => setOrbState("idle"), 1400);

          // Flush any final un-spoken text buffer to speech queue
          if (streamTTS) {
            streamTTS.finish();
          }

          const finalAssistantMsg = {
            id: aId,
            role: "assistant",
            content: finalText,
            done: true,
            dbId: d.message_id,
            groundingMetadata: d.groundingMetadata || capturedGrounding,
            modelUsed: modelReported || modelTier,
            language: useLangCode,
            fromVoiceQuery: isVoiceQuery,
          };

          setMessages((m) => m.map((x) => (x.id === aId ? { ...x, ...finalAssistantMsg } : x)));

          // Sync assistant message to Firestore
          persistMessageToFirestore(finalAssistantMsg, d.conversation_id || currentConvId);

          if (d.conversation_id && !id) navigate(`/app/chat/${d.conversation_id}`, { replace: true });
        },
        onError: (e) => {
          if (streamTTS) {
            streamTTS.cancel();
          }
          setStreaming(false);
          setOrbState("warning");
          setTimeout(() => setOrbState("idle"), 2000);
          setMessages((m) =>
            m.map((x) =>
              x.id === aId ? { ...x, content: (x.content || "") + `\n\n_${e.message}_`, done: true } : x
            )
          );
        },
      }
    );
  }, [
    input,
    streaming,
    convId,
    lang,
    navigate,
    id,
    autoSpeakMode,
    playTTS,
    setOrbState,
    speech,
    messages,
    rolePersona,
    modelTier,
    enableSearch,
    enableMaps,
    user,
  ]);


  const startDemo = useCallback(async () => {
    if (demo.running) {
      demoCancel.current = true;
      setDemo({ running: false, step: 0, total: DEMO_STEPS });
      return;
    }
    demoCancel.current = false;
    setDemo({ running: true, step: 0, total: DEMO_STEPS });
    sfx.start();
    await runDemo({
      send: (q, l) => send(q, l),
      setLang,
      isCancelled: () => demoCancel.current,
      onStep: (s, total) => setDemo({ running: s < total, step: s, total }),
      waitIdle: () =>
        new Promise((res) => {
          const iv = setInterval(() => {
            if (!streamingRef.current || demoCancel.current) {
              clearInterval(iv);
              res();
            }
          }, 300);
        }),
    });
    setDemo({ running: false, step: 0, total: DEMO_STEPS });
  }, [demo.running, send, setLang]);

  const toggleMic = async () => {
    speech.stop();
    if (recording) {
      setOrbState("thinking");
      const currentInterim = interimText;
      const text = await stop();
      setOrbState("idle");
      const finalRecorded = (text || currentInterim || "").trim();
      if (finalRecorded) {
        send(finalRecorded, lang, true);
        setInput("");
      } else {
        toast("No speech detected. Please speak clearly into your mic.");
      }
    } else {
      try {
        sfx.listen();
        setOrbState("listening");
        await start(input);
      } catch {
        setOrbState("idle");
        toast.error("Microphone access denied. Please allow microphone permissions in your browser.");
      }
    }
  };

  const wakeEnabled = localStorage.getItem("vaani-wakeword") === "1";
  useWakeWord({
    enabled: wakeEnabled,
    paused: recording || streaming || !!speech.playingId,
    onWake: () => {
      if (!recording && !streaming) toggleMic();
    },
  });

  const bookmark = async (m) => {
    try {
      await addBookmark({ message_id: m.dbId || m.id, conversation_id: convId, content: m.content });
      if (user) {
        const bmDocRef = doc(db, "savedBookmarks", m.dbId || m.id);
        await setDoc(bmDocRef, {
          id: m.dbId || m.id,
          userId: user.uid,
          messageId: m.dbId || m.id,
          conversationId: convId,
          content: m.content,
          createdAt: serverTimestamp(),
        });
      }
      toast.success(t(lang, "bookmarked"));
    } catch {
      toast.error("Failed to bookmark");
    }
  };

  const deva = lang !== "en";
  const empty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Top Configuration Bar */}
      <div className="px-4 md:px-10 py-2.5 border-b border-border/70 bg-card/40 backdrop-blur-md flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Persona selector */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-background/80">
            <Bot className="w-3.5 h-3.5 text-primary" />
            <select
              value={rolePersona}
              onChange={(e) => setRolePersona(e.target.value)}
              className="bg-transparent outline-none font-medium cursor-pointer"
            >
              {ROLE_PERSONAS.map((p) => (
                <option key={p.id} value={p.id} className="bg-popover text-foreground">
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Model tier selector */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-background/80">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <select
              value={modelTier}
              onChange={(e) => setModelTier(e.target.value)}
              className="bg-transparent outline-none font-medium cursor-pointer"
            >
              {MODEL_TIERS.map((m) => (
                <option key={m.id} value={m.id} className="bg-popover text-foreground">
                  {m.name} ({m.badge})
                </option>
              ))}
            </select>
          </div>

          {/* Auto-Speak Multi-Mode Selector in Header */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-background/80">
            {autoSpeakMode === "always" ? (
              <Volume2 className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            ) : autoSpeakMode === "voice_only" ? (
              <Volume1 className="w-3.5 h-3.5 text-blue-500" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-muted-foreground" />
            )}
            <select
              value={autoSpeakMode}
              onChange={(e) => handleSetAutoSpeakMode(e.target.value)}
              data-testid="auto-speak-mode-select"
              className="bg-transparent outline-none font-medium text-xs cursor-pointer"
              title="Configure Voice Speech Playback behavior"
            >
              <option value="always" className="bg-popover text-foreground">
                Auto-Speak: Always
              </option>
              <option value="voice_only" className="bg-popover text-foreground">
                Auto-Speak: Voice Only
              </option>
              <option value="off" className="bg-popover text-foreground">
                Auto-Speak: Muted
              </option>
            </select>
          </div>

          {/* Grounding tools toggles */}
          <button
            onClick={() => setEnableSearch(!enableSearch)}
            data-testid="search-grounding-toggle"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full border transition-colors ${
              enableSearch
                ? "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium"
                : "border-border text-muted-foreground hover:bg-accent"
            }`}
            title="Google Search Grounding via Gemini 3.5 Flash"
          >
            <Search className="w-3 h-3" />
            <span>Search Grounding</span>
          </button>

          <button
            onClick={() => setEnableMaps(!enableMaps)}
            data-testid="maps-grounding-toggle"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full border transition-colors ${
              enableMaps
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium"
                : "border-border text-muted-foreground hover:bg-accent"
            }`}
            title="Google Maps Grounding for locations & centres"
          >
            <MapPin className="w-3 h-3" />
            <span>Maps Grounding</span>
          </button>
        </div>

        {/* Live Voice API Button */}
        <button
          onClick={() => setLiveVoiceOpen(true)}
          data-testid="live-voice-btn"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-linear-to-r from-cyan-500 to-blue-600 text-white font-medium shadow-xs hover:opacity-90 transition-opacity shrink-0"
        >
          <Radio className="w-3.5 h-3.5 animate-pulse text-cyan-200" />
          <span>Live Voice API</span>
        </button>
      </div>

      {/* Message Scroll Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-10 py-6">
        <div className="max-w-3xl mx-auto">
          {empty ? (
            <div className="flex flex-col items-center text-center pt-8 md:pt-12" data-testid="chat-empty">
              <Orb state="idle" size={110} />
              <h1 className="font-head text-3xl md:text-4xl font-light tracking-tight mt-6">
                {t(lang, "ask_anything")}
              </h1>
              <p className={`text-muted-foreground mt-2 max-w-md ${deva ? "font-deva" : ""}`}>
                {t(lang, "home_sub")}
              </p>

              {/* Large Voice-First Start Button */}
              <div className="mt-6 flex flex-col items-center gap-3">
                <button
                  onClick={toggleMic}
                  data-testid="voice-first-start-btn"
                  className="flex items-center gap-3 px-7 py-3.5 rounded-full bg-linear-to-r from-emerald-500 to-teal-600 text-white font-semibold shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all"
                >
                  <Mic className="w-5 h-5 animate-bounce" />
                  <span>
                    {lang === "hi"
                      ? "बोलकर पूछें (आवाज़ में उत्तर पाएँ)"
                      : lang === "mr"
                      ? "आवाजाने विचारा (ऑडिओ उत्तर मिळवा)"
                      : "Ask by Voice (Get Spoken Audio Response)"}
                  </span>
                </button>

                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <Headphones className="w-3.5 h-3.5 text-primary" />
                  <span>Integrated with Web Speech API for natural Hindi, Marathi & English speech</span>
                </div>
              </div>

              {/* Role badge indicator */}
              <div className="mt-4 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary font-medium">
                Active Role: {ROLE_PERSONAS.find((p) => p.id === rolePersona)?.name} ·{" "}
                {MODEL_TIERS.find((m) => m.id === modelTier)?.name}
              </div>

              <div className="grid sm:grid-cols-2 gap-3 mt-8 w-full max-w-2xl">
                {(SUGGESTIONS[lang] || SUGGESTIONS.en).map((s, i) => (
                  <button
                    key={i}
                    onClick={() => send(s)}
                    data-testid={`suggestion-${i}`}
                    className={`text-left p-4 rounded-2xl border border-border bg-card/50 hover:bg-accent hover:-translate-y-0.5 transition-transform duration-300 text-sm ${
                      deva ? "font-deva" : ""
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-primary mb-2" />
                    {s}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={startDemo}
                  data-testid="demo-mode-btn"
                  className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/5 text-primary px-5 py-2.5 text-sm font-medium hover:bg-primary/10 transition-colors duration-300"
                >
                  <Wand2 className="w-4 h-4" />{" "}
                  {demo.running ? `Demo running… (${demo.step}/${demo.total})` : "Play Demo Mode"}
                </button>
                <button
                  onClick={() => navigate("/app/forms")}
                  className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-5 py-2.5 text-sm font-medium hover:bg-amber-500/20 transition-colors"
                >
                  <FileCheck className="w-4 h-4" /> Auto Form Filler
                </button>
                <button
                  onClick={() => setLiveVoiceOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-5 py-2.5 text-sm font-medium hover:bg-cyan-500/20 transition-colors"
                >
                  <Radio className="w-4 h-4 animate-pulse" /> Live Voice Conversation
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <AnimatePresence initial={false}>
                {messages.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                    data-testid={`msg-${m.role}`}
                  >
                    {m.role === "assistant" && (
                      <div className="shrink-0 mt-1">
                        <Orb
                          state={
                            speech.playingId === m.id && !speech.isPaused
                              ? "speaking"
                              : !m.done && streaming
                              ? "thinking"
                              : "idle"
                          }
                          size={34}
                        />
                      </div>
                    )}
                    <div className={`max-w-[85%] ${m.role === "user" ? "order-1" : ""}`}>
                      <div
                        className={`px-4 py-3 rounded-3xl ${
                          m.role === "user"
                            ? "bg-primary text-primary-foreground rounded-br-lg"
                            : "bg-card border border-border rounded-bl-lg"
                        }`}
                      >
                        {m.role === "assistant" ? (
                          m.content ? (
                            <>
                              <RichText
                                text={m.content}
                                deva={deva}
                                highlightProgress={speech.playingId === m.id ? speech.progress : -1}
                              />
                              {translations[m.id] && (
                                <div className="mt-3 pt-3 border-t border-border/60 text-sm text-muted-foreground">
                                  <div className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-1 flex items-center gap-1">
                                    <Languages className="w-3 h-3" />{" "}
                                    {LANGS.find((l) => l.code === translations[m.id].target)?.native}
                                  </div>
                                  <RichText
                                    text={translations[m.id].text}
                                    deva={translations[m.id].target !== "en"}
                                  />
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="inline-flex items-center gap-2 text-muted-foreground text-sm">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              {t(lang, "thinking")}
                            </span>
                          )
                        ) : (
                          <div>
                            <p className={deva ? "font-deva" : ""}>{m.content}</p>
                            {m.isVoice && (
                              <div className="mt-1 flex items-center gap-1 text-[10px] text-primary-foreground/80 font-medium">
                                <Mic className="w-2.5 h-2.5" />
                                <span>{t(lang, "voice_query")}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Interactive Web Speech Audio Player Bar when actively speaking */}
                      {m.role === "assistant" && speech.playingId === m.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-2.5 p-3.5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 text-xs space-y-2.5 shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-300">
                              <Volume2 className="w-4 h-4 animate-pulse text-emerald-500" />
                              <span>
                                {speech.isPaused
                                  ? t(lang, "audio_paused")
                                  : t(lang, "audio_playing")}
                              </span>
                              {speech.sentenceInfo?.total > 1 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 font-mono font-semibold">
                                  Sentence {speech.sentenceInfo.index} of {speech.sentenceInfo.total}
                                </span>
                              )}
                            </div>

                            {/* Speed Selector Pills */}
                            <div className="flex items-center gap-1 bg-background/90 p-0.5 rounded-lg border border-border">
                              {SPEEDS.map((sp) => (
                                <button
                                  key={sp.val}
                                  onClick={() => {
                                    speech.setRate(sp.val);
                                    playTTS(m.content, m.id, { rate: sp.val });
                                  }}
                                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                                    Math.abs(speech.rate - sp.val) < 0.05
                                      ? "bg-emerald-600 text-white shadow-xs"
                                      : "text-muted-foreground hover:text-foreground"
                                  }`}
                                  title={`Speed ${sp.label}`}
                                >
                                  {sp.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Live Spoken Sentence display with animated acoustic pulse */}
                          {speech.currentSentence && (
                            <div className="p-2.5 rounded-xl bg-background/80 border border-border/60 text-[12px] text-foreground font-medium flex items-start gap-2 shadow-xs">
                              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping mt-1 shrink-0" />
                              <span className={deva ? "font-deva" : ""}>"{speech.currentSentence}"</span>
                            </div>
                          )}

                          {/* Controls Row: Skip back, Play/Pause, Skip forward, Replay, Stop, Progress */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => speech.prevSentence()}
                              className="p-1.5 rounded-full border border-border bg-background hover:bg-accent transition-colors"
                              title="Previous sentence"
                            >
                              <SkipBack className="w-3.5 h-3.5 text-foreground" />
                            </button>

                            <button
                              onClick={() => speech.togglePause()}
                              className="p-2 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs"
                              title={speech.isPaused ? "Resume" : "Pause"}
                            >
                              {speech.isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                            </button>

                            <button
                              onClick={() => speech.skipSentence()}
                              className="p-1.5 rounded-full border border-border bg-background hover:bg-accent transition-colors"
                              title="Next sentence (Skip)"
                            >
                              <SkipForward className="w-3.5 h-3.5 text-foreground" />
                            </button>

                            <button
                              onClick={() => playTTS(m.content, m.id)}
                              className="p-1.5 rounded-full border border-border bg-background hover:bg-accent transition-colors"
                              title="Replay entire response"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>

                            <button
                              onClick={() => speech.stop()}
                              className="p-1.5 rounded-full border border-rose-500/40 text-rose-500 bg-background hover:bg-rose-500/10 transition-colors"
                              title="Stop audio"
                            >
                              <Square className="w-3.5 h-3.5" />
                            </button>

                            {/* Progress bar */}
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden ml-1">
                              <div
                                className="h-full bg-emerald-500 transition-all duration-150 rounded-full"
                                style={{ width: `${Math.max(4, Math.round(speech.progress * 100))}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                              {Math.round(speech.progress * 100)}%
                            </span>
                          </div>
                        </motion.div>
                      )}

                      {/* Assistant Tools & Metadata */}
                      {m.role === "assistant" && m.done && (
                        <div className="mt-2.5 space-y-2.5">
                          <div className="flex items-center gap-3 flex-wrap">
                            <ConfidenceBadge
                              confidence={m.confidence}
                              grounded={m.grounded ?? m.citations?.length > 0}
                            />
                            {m.modelUsed && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full border border-border/60 text-muted-foreground font-mono">
                                {m.modelUsed}
                              </span>
                            )}
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => playTTS(m.content, m.id)}
                                data-testid="play-tts"
                                className={`grid place-items-center w-8 h-8 rounded-full border transition-colors duration-300 ${
                                  speech.playingId === m.id
                                    ? "border-emerald-500 bg-emerald-500 text-white"
                                    : "border-border hover:bg-accent text-foreground"
                                }`}
                                title={speech.playingId === m.id ? t(lang, "stop") : t(lang, "play")}
                              >
                                {speech.playingId === m.id ? (
                                  <Square className="w-3.5 h-3.5" />
                                ) : (
                                  <Volume2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() => translateMsg(m)}
                                disabled={translatingId === m.id}
                                data-testid="translate-msg"
                                className="grid place-items-center w-8 h-8 rounded-full border border-border hover:bg-accent transition-colors duration-300 disabled:opacity-50"
                                title="Translate"
                              >
                                {translatingId === m.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Languages className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() => bookmark(m)}
                                data-testid="bookmark-msg"
                                className="grid place-items-center w-8 h-8 rounded-full border border-border hover:bg-accent transition-colors duration-300"
                                title={t(lang, "bookmark")}
                              >
                                <Bookmark className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setNlpOpenId(nlpOpenId === m.id ? null : m.id)}
                                data-testid="nlp-inspect-msg"
                                className={`grid place-items-center w-8 h-8 rounded-full border transition-colors duration-300 ${
                                  nlpOpenId === m.id
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border hover:bg-accent text-foreground"
                                }`}
                                title="Inspect NLP Intent & Entities"
                              >
                                <Cpu className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Collapsible NLP Insight Panel */}
                          {nlpOpenId === m.id && (
                            (() => {
                              const nlpData = analyzeClientNLP(m.content, lang);
                              return (
                                <motion.div
                                  initial={{ opacity: 0, y: -4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="p-3.5 rounded-2xl border border-primary/30 bg-primary/5 text-xs space-y-2.5 shadow-sm"
                                  data-testid="nlp-msg-drawer"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 font-bold text-primary">
                                      <Cpu className="w-3.5 h-3.5" />
                                      <span>VAANI NLP & Intent Engine</span>
                                    </div>
                                    <button
                                      onClick={() => navigate(`/app/nlp`)}
                                      className="text-[11px] text-primary underline hover:opacity-80 font-medium"
                                    >
                                      Open NLP Studio →
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="p-2 rounded-xl bg-background/80 border border-border">
                                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">Detected Intent</div>
                                      <div className="font-semibold text-foreground mt-0.5 truncate">{nlpData.intent.name}</div>
                                    </div>
                                    <div className="p-2 rounded-xl bg-background/80 border border-border">
                                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">Sentiment & Urgency</div>
                                      <div className="font-semibold text-foreground mt-0.5 capitalize">{nlpData.sentiment.polarity} ({nlpData.sentiment.urgency})</div>
                                    </div>
                                  </div>

                                  {nlpData.entities.length > 0 && (
                                    <div className="space-y-1">
                                      <div className="text-[10px] uppercase font-semibold text-muted-foreground">Extracted Rural Entities:</div>
                                      <div className="flex flex-wrap gap-1.5">
                                        {nlpData.entities.map((ent, ei) => (
                                          <span
                                            key={ei}
                                            className="px-2 py-0.5 rounded-full bg-accent text-[11px] font-mono text-foreground border border-border flex items-center gap-1"
                                          >
                                            <Tag className="w-2.5 h-2.5 text-primary" />
                                            <span>{ent.label}: {ent.value}</span>
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </motion.div>
                              );
                            })()
                          )}

                          {/* Grounding Web / Maps Searches */}
                          {m.groundingMetadata?.groundingChunks?.length > 0 && (
                            <div className="p-3 rounded-2xl border border-blue-500/20 bg-blue-500/5 text-xs space-y-1.5">
                              <div className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                                <Search className="w-3.5 h-3.5" /> Google Search & Maps Grounding
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {m.groundingMetadata.groundingChunks.slice(0, 4).map((gc, gci) => (
                                  <a
                                    key={gci}
                                    href={gc.web?.uri || "#"}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2.5 py-1 rounded-lg border border-blue-500/20 bg-card/80 hover:underline text-foreground truncate max-w-[260px] inline-block"
                                  >
                                    {gc.web?.title || gc.web?.uri || `Source ${gci + 1}`}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Citations from official documents */}
                          {m.citations?.length > 0 && (
                            <div>
                              <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-2">
                                {t(lang, "sources")}
                              </div>
                              <div className="grid sm:grid-cols-2 gap-2">
                                {m.citations.map((c) => (
                                  <CitationCard key={c.n} citation={c} />
                                ))}
                              </div>
                            </div>
                          )}

                          {!streaming && m.id === messages[messages.length - 1]?.id && (
                            <div className="flex flex-wrap gap-2 pt-1" data-testid="quick-actions">
                              {contextualActions(m.citations, lang)
                                .filter(
                                  (q) =>
                                    q.toLowerCase() !==
                                    (
                                      messages.filter((x) => x.role === "user").slice(-1)[0]?.content || ""
                                    ).toLowerCase()
                                )
                                .map((q, qi) => (
                                  <button
                                    key={qi}
                                    onClick={() => send(q)}
                                    data-testid={`quick-action-${qi}`}
                                    className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-3 py-1.5 text-xs hover:bg-accent hover:-translate-y-0.5 transition-transform duration-300 ${
                                      deva ? "font-deva" : ""
                                    }`}
                                  >
                                    <Wand2 className="w-3 h-3 text-primary" /> {q}
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="px-4 md:px-10 pb-24 md:pb-6 pt-2">
        <div className="max-w-3xl mx-auto">
          {/* Active Listening Waveform Banner */}
          <AnimatePresence>
            {recording && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                className="mb-3 p-3.5 rounded-3xl glass space-y-2 border border-emerald-500/30"
                data-testid="listening-panel"
              >
                <div className="flex items-center gap-4">
                  <Orb state="listening" size={38} />
                  <div className="flex-1 h-10 text-emerald-500 dark:text-emerald-300">
                    <Waveform getAnalyser={getAnalyser} active={recording} />
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-mono font-medium">
                      {lang.toUpperCase()}
                    </span>
                    <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold">
                      {t(lang, "listening")}
                    </span>
                  </div>
                </div>
                <div className="text-sm px-2 text-foreground/90 font-medium italic border-t border-border/40 pt-2 animate-pulse flex items-center justify-between">
                  <span>“{interimText || t(lang, "listening_speak_now")}”</span>
                  <span className="text-[11px] text-muted-foreground font-normal">Tap square when done</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {demo.running && (
            <div
              className="mb-3 flex items-center justify-between gap-3 p-3 rounded-2xl border border-primary/30 bg-primary/5"
              data-testid="demo-banner"
            >
              <span className="text-sm text-primary inline-flex items-center gap-2">
                <Wand2 className="w-4 h-4" /> Demo Mode · {demo.step}/{demo.total}
              </span>
              <button
                onClick={startDemo}
                className="text-xs rounded-full border border-border px-3 py-1 hover:bg-accent transition-colors duration-300"
              >
                Stop
              </button>
            </div>
          )}

          {!empty && (
            <div className="mb-3 flex items-center justify-between">
              <button
                onClick={() => navigate("/app/chat")}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors duration-300"
                data-testid="new-chat"
              >
                <Plus className="w-3.5 h-3.5" /> {t(lang, "new_chat")}
              </button>

              {/* Quick Audio auto-speak indicator */}
              <button
                onClick={() => handleSetAutoSpeakMode(autoSpeakMode === "off" ? "always" : "off")}
                className={`inline-flex items-center gap-1 text-[11px] transition-colors ${
                  autoSpeakMode !== "off" ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground"
                }`}
                title="Toggle Auto-Speak audio playback"
              >
                {autoSpeakMode !== "off" ? <Volume2 className="w-3 h-3 text-emerald-500" /> : <VolumeX className="w-3 h-3" />}
                <span>
                  {autoSpeakMode === "always"
                    ? "Auto-Speak: All"
                    : autoSpeakMode === "voice_only"
                    ? "Auto-Speak: Voice"
                    : "Auto-Speak: Muted"}
                </span>
              </button>
            </div>
          )}

          <div className="flex items-end gap-2 p-2 rounded-3xl border border-border bg-card/70 backdrop-blur-xl shadow-sm">
            <button
              onClick={toggleMic}
              disabled={transcribing || streaming}
              data-testid="voice-button"
              className={`grid place-items-center w-11 h-11 rounded-full shrink-0 transition-all duration-300 ${
                recording
                  ? "bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/30"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              }`}
              title={recording ? "Stop listening & send" : "Tap to speak in your language"}
            >
              {transcribing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : recording ? (
                <Square className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder={recording ? t(lang, "listening") : t(lang, "ask_placeholder")}
              data-testid="chat-input"
              className={`flex-1 resize-none bg-transparent outline-none py-2.5 px-2 max-h-32 text-[15px] placeholder:text-muted-foreground ${
                deva ? "font-deva" : ""
              }`}
            />

            <button
              onClick={() => send()}
              disabled={!input.trim() || streaming}
              data-testid="send-button"
              className="grid place-items-center w-11 h-11 rounded-full shrink-0 bg-primary text-primary-foreground disabled:opacity-40 transition-transform duration-300 hover:scale-105 active:scale-95"
            >
              {streaming ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Live Voice API Conversation Dialog */}
      <LiveVoiceModal
        open={liveVoiceOpen}
        onClose={() => setLiveVoiceOpen(false)}
        rolePersona={rolePersona}
        language={lang}
      />
    </div>
  );
}
