import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Mic,
  Square,
  Volume2,
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

  // Gemini Role, Model Tier & Grounding toggles
  const [rolePersona, setRolePersona] = useState("rural_advisor");
  const [modelTier, setModelTier] = useState("flash");
  const [enableSearch, setEnableSearch] = useState(true);
  const [enableMaps, setEnableMaps] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [liveVoiceOpen, setLiveVoiceOpen] = useState(false);

  const scrollRef = useRef(null);
  const { recording, transcribing, interimText, speechConfig, start, stop, getAnalyser } = useVoiceRecorder(lang);
  const speech = useSpeech();
  const autoVoice = localStorage.getItem("vaani-voice-reply") === "1";
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

  const playTTS = useCallback((text, msgId) => {
    speech.play(text, msgId, lang);
  }, [speech, lang]);

  useEffect(() => {
    if (speech.playingId) setOrbState("speaking");
    else if (!streaming && !recording) setOrbState("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.playingId]);

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

  const send = useCallback(async (text, langOverride) => {
    const msg = (text ?? input).trim();
    if (!msg || streaming) return;
    const useLangCode = langOverride || lang;
    speech.stop();
    sfx.send();
    setInput("");

    const currentConvId = convId || `conv-${Date.now()}`;
    if (!convId) setConvId(currentConvId);

    const userMsgId = `u-${Date.now()}`;
    const userMsg = { id: userMsgId, role: "user", content: msg, done: true, language: useLangCode };
    const aId = `a-${Date.now()}`;

    // Prepare multi-turn history snapshot
    const historyPayload = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((m) => [
      ...m,
      userMsg,
      { id: aId, role: "assistant", content: "", citations: [], confidence: 0, grounded: false, done: false, modelUsed: modelTier },
    ]);
    setStreaming(true);
    setOrbState("thinking");

    // Sync user message to Firestore
    persistMessageToFirestore(userMsg, currentConvId);

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

          const finalAssistantMsg = {
            id: aId,
            role: "assistant",
            content: finalText,
            done: true,
            dbId: d.message_id,
            groundingMetadata: d.groundingMetadata || capturedGrounding,
            modelUsed: modelReported || modelTier,
            language: useLangCode,
          };

          setMessages((m) => m.map((x) => (x.id === aId ? { ...x, ...finalAssistantMsg } : x)));

          // Sync assistant message to Firestore
          persistMessageToFirestore(finalAssistantMsg, d.conversation_id || currentConvId);

          if (d.conversation_id && !id) navigate(`/app/chat/${d.conversation_id}`, { replace: true });
          if (autoVoice && finalText) playTTS(finalText, aId);
        },
        onError: (e) => {
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
    autoVoice,
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
        send(finalRecorded);
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
      {/* Top Configuration & Real-Time Live API Bar */}
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
                        <Orb state={!m.done && streaming ? "thinking" : "idle"} size={34} />
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
                          <p className={deva ? "font-deva" : ""}>{m.content}</p>
                        )}
                      </div>

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
                                className="grid place-items-center w-8 h-8 rounded-full border border-border hover:bg-accent transition-colors duration-300"
                                title={t(lang, "play")}
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
                            </div>
                          </div>

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
          <AnimatePresence>
            {recording && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                className="mb-3 p-3.5 rounded-3xl glass space-y-2"
                data-testid="listening-panel"
              >
                <div className="flex items-center gap-4">
                  <Orb state="listening" size={38} />
                  <div className="flex-1 h-10 text-cyan-500 dark:text-cyan-300">
                    <Waveform getAnalyser={getAnalyser} active={recording} />
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-mono font-medium">
                      {speechConfig?.nativeName || speechConfig?.displayName || lang.toUpperCase()}
                    </span>
                    <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold">
                      {t(lang, "listening")}
                    </span>
                  </div>
                </div>
                {interimText && (
                  <div className="text-sm px-2 text-foreground/80 font-medium italic border-t border-border/40 pt-2 animate-pulse">
                    “{interimText}”
                  </div>
                )}
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
            <button
              onClick={() => navigate("/app/chat")}
              className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors duration-300"
              data-testid="new-chat"
            >
              <Plus className="w-3.5 h-3.5" /> {t(lang, "new_chat")}
            </button>
          )}

          <div className="flex items-end gap-2 p-2 rounded-3xl border border-border bg-card/70 backdrop-blur-xl shadow-sm">
            <button
              onClick={toggleMic}
              disabled={transcribing || streaming}
              data-testid="voice-button"
              className={`grid place-items-center w-11 h-11 rounded-full shrink-0 transition-colors duration-300 ${
                recording ? "bg-rose-500 text-white animate-pulse" : "bg-muted text-foreground hover:bg-accent"
              }`}
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
