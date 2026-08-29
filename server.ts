import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { db } from "./server/db";
import { getHardware } from "./server/hardware";
import {
  detectLanguage,
  retrieve,
  streamAnswer,
  translateQueryToEnglish,
  searchChunks,
  computeConfidence,
  SUPPORTED_LANGS,
  RAG_SCORE_THRESHOLD,
  RagResult,
} from "./server/rag";
import {
  completeWithGemini,
  transcribeAudioWithGemini,
  generateSpeechWithGemini,
  streamGeminiChatResponse,
  generateGeminiChatResponse,
  ChatRoleConfig,
  selectModel,
} from "./server/gemini";
import { Citation } from "./server/types";

const app = express();
const PORT = 3000;

// Multer memory storage for uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

app.use(cors());
app.use(express.json());

const api = express.Router();

// Helper for SSE event formatting
function formatSSE(event: string, data: any): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ---------------- Health & System ----------------
api.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "vaani",
    mode: process.env.VAANI_MODE || "showcase",
  });
});

api.get("/system/status", async (req: Request, res: Response) => {
  const hw = getHardware();
  const docCount = await db.documentCount();
  const domainCounts = await db.domainCounts();
  const vecCount = db.vectorCount();

  res.json({
    mode: process.env.VAANI_MODE || "showcase",
    subsystems: {
      llm: {
        provider: "gemini",
        models: ["gemini-3.1-pro-preview", "gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3.1-flash-live-preview"],
        active_model: "gemini-3.5-flash",
        status: "online",
      },
      stt: {
        model: "gemini-3.5-transcribe",
        status: "online",
      },
      tts: {
        model: "gemini-3.1-flash-tts-preview",
        voice: "Kore (warm & clear)",
        status: "online",
      },
      vector_store: {
        engine: "in-memory / chroma",
        vectors: vecCount,
        status: "online",
      },
      database: {
        engine: "Firebase Firestore / in-memory",
        status: "online",
      },
      grounding: {
        googleSearch: "enabled",
        googleMaps: "enabled",
      },
    },
    knowledge: {
      documents: docCount,
      domains: domainCounts,
      vectors: vecCount,
      rag_threshold: RAG_SCORE_THRESHOLD,
    },
    hardware: {
      adapter: hw.name,
      description: hw.description,
    },
    languages: SUPPORTED_LANGS,
  });
});

api.get("/hardware/capabilities", (req: Request, res: Response) => {
  const hw = getHardware();
  res.json({
    adapter: hw.name,
    description: hw.description,
    capabilities: hw.capabilities,
  });
});

// ---------------- Chat (Multi-Turn + Grounding + RAG + SSE Streaming) ----------------
api.post("/chat/stream", async (req: Request, res: Response) => {
  const {
    message,
    conversation_id,
    language: reqLang,
    domain,
    history = [],
    rolePersona = "rural_advisor",
    modelTier = "flash",
    enableSearch = false,
    enableMaps = false,
  } = req.body || {};

  if (!message || typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "Message cannot be empty." });
    return;
  }

  const language =
    reqLang && reqLang in SUPPORTED_LANGS
      ? reqLang
      : detectLanguage(message);

  let conv = conversation_id ? await db.getConversation(conversation_id) : null;
  if (!conv) {
    conv = await db.createConversation(message.trim().slice(0, 60), language);
  }

  await db.addMessage({
    conversation_id: conv.id,
    role: "user",
    content: message,
    language,
  });

  const searchQuery = await translateQueryToEnglish(message, language);
  const ragResult = retrieve(searchQuery, language, domain);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const modelUsed = selectModel(modelTier, enableSearch || enableMaps);

  res.write(
    formatSSE("meta", {
      conversation_id: conv.id,
      language,
      grounded: ragResult.grounded || enableSearch || enableMaps,
      confidence: ragResult.confidence,
      retrieved: ragResult.chunks.length,
      citations: ragResult.citations,
      modelUsed,
      groundingFeatures: {
        googleSearch: enableSearch,
        googleMaps: enableMaps,
      },
    })
  );

  const fullAnswerTokens: string[] = [];
  let capturedGroundingMetadata: any = null;

  try {
    if (process.env.GEMINI_API_KEY) {
      // Format multi-turn conversation history for Gemini
      const formattedContents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

      // Include previous turns if available
      if (Array.isArray(history)) {
        for (const item of history.slice(-8)) {
          if (item.role === "user" || item.role === "assistant") {
            formattedContents.push({
              role: item.role === "assistant" ? "model" : "user",
              parts: [{ text: item.content || "" }],
            });
          }
        }
      }

      // Add RAG context snippet if available
      let userPromptWithContext = message;
      if (ragResult.chunks.length > 0) {
        const ragContextText = ragResult.chunks
          .map((c, i) => `[Source ${i + 1} - ${c.title} (${c.domain})]: ${c.text}`)
          .join("\n\n");
        userPromptWithContext = `Context from official rural governance databases:\n${ragContextText}\n\nUser Question:\n${message}`;
      }

      formattedContents.push({
        role: "user",
        parts: [{ text: userPromptWithContext }],
      });

      const roleConfig: ChatRoleConfig = {
        rolePersona,
        modelTier,
        enableSearch,
        enableMaps,
      };

      for await (const chunk of streamGeminiChatResponse({
        contents: formattedContents,
        roleConfig,
        language,
      })) {
        if (chunk.delta) {
          fullAnswerTokens.push(chunk.delta);
          res.write(formatSSE("token", { delta: chunk.delta }));
        }
        if (chunk.groundingMetadata) {
          capturedGroundingMetadata = chunk.groundingMetadata;
          res.write(formatSSE("grounding", chunk.groundingMetadata));
        }
      }
    } else {
      // Fallback in-memory RAG stream if GEMINI_API_KEY is not provided
      for await (const token of streamAnswer(message, ragResult)) {
        fullAnswerTokens.push(token);
        res.write(formatSSE("token", { delta: token }));
      }
    }

    const answer = fullAnswerTokens.join("").trim() || "…";
    const assistantMsg = await db.addMessage({
      conversation_id: conv.id,
      role: "assistant",
      content: answer,
      language,
      confidence: ragResult.confidence,
      grounded: ragResult.grounded || enableSearch || enableMaps,
      citations: ragResult.citations,
    });

    await db.touchConversation(conv.id);

    res.write(
      formatSSE("done", {
        message_id: assistantMsg.id,
        conversation_id: conv.id,
        groundingMetadata: capturedGroundingMetadata,
      })
    );
  } catch (err: any) {
    res.write(
      formatSSE("error", {
        message: `VAANI could not complete the response: ${err?.message || "Unknown error"}`,
      })
    );
  } finally {
    res.end();
  }
});

// ---------------- Conversations ----------------
api.get("/conversations", async (req: Request, res: Response) => {
  const convs = await db.listConversations();
  res.json(convs);
});

api.get("/conversations/search", async (req: Request, res: Response) => {
  const q = String(req.query.q || "");
  const results = await db.searchMessages(q);
  res.json(results);
});

api.get("/conversations/:id", async (req: Request, res: Response) => {
  const convId = req.params.id;
  const conv = await db.getConversation(convId);
  if (!conv) {
    res.status(404).json({ error: "Conversation not found." });
    return;
  }
  const messages = await db.listMessages(convId);
  res.json({ conversation: conv, messages });
});

api.delete("/conversations/:id", async (req: Request, res: Response) => {
  const convId = req.params.id;
  await db.deleteConversation(convId);
  res.json({ deleted: convId });
});

// ---------------- Voice & STT / TTS (Gemini Transcription & TTS) ----------------
api.post("/voice/transcribe", upload.single("audio") as any, async (req: Request, res: Response) => {
  const language = req.body?.language || "en";
  const file = req.file;

  if (!file || !file.buffer || file.buffer.length === 0) {
    res.status(400).json({ error: "No audio file provided for transcription." });
    return;
  }

  try {
    const mimeType = file.mimetype || "audio/webm";
    const result = await transcribeAudioWithGemini(file.buffer, mimeType, language);
    const transcribedText = result.text.trim();

    res.json({
      text: transcribedText,
      language: detectLanguage(transcribedText, language),
    });
  } catch (err: any) {
    console.error("Transcription error:", err?.message || err);
    res.status(500).json({
      error: "Transcription service unavailable",
      details: err?.message || "Failed to process audio.",
      text: "",
    });
  }
});

api.post("/translate", async (req: Request, res: Response) => {
  const { text, target } = req.body || {};
  if (!text || !text.trim()) {
    res.status(400).json({ error: "Text cannot be empty." });
    return;
  }
  const targetLang = SUPPORTED_LANGS[target] || "English";
  try {
    const system = `You are a precise translator for rural governance in India. Translate the user's text into ${targetLang}. Preserve meaning, numbers and scheme names. Output ONLY the translation, nothing else.`;
    const translated = await completeWithGemini(system, text);
    res.json({ text: translated || text, target: target || "en" });
  } catch (err: any) {
    res.json({ text, target: target || "en" });
  }
});

api.post("/voice/speak", async (req: Request, res: Response) => {
  const { text, voice } = req.body || {};
  if (!text || typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "Text cannot be empty." });
    return;
  }

  try {
    const { buffer, mimeType } = await generateSpeechWithGemini(text, voice || "Kore");
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (err: any) {
    console.error("TTS generation error:", err?.message || err);
    res.status(503).json({
      error: "TTS service unavailable",
      message: err?.message || "Could not generate speech",
    });
  }
});

// ---------------- Knowledge Base ----------------
api.get("/knowledge", async (req: Request, res: Response) => {
  const domain = req.query.domain as string | undefined;
  const docs = await db.listDocuments(domain);
  res.json(docs);
});

api.get("/knowledge/domains", async (req: Request, res: Response) => {
  const counts = await db.domainCounts();
  res.json(counts);
});

api.get("/knowledge/search", async (req: Request, res: Response) => {
  const q = String(req.query.q || "");
  const domain = req.query.domain as string | undefined;
  const chunks = searchChunks(q, 6, domain ? { domain } : undefined);
  res.json(chunks);
});

// ---------------- Documents ----------------
api.get("/documents", async (req: Request, res: Response) => {
  const docs = await db.listDocuments();
  const uploads = docs.filter((d) => d.origin === "upload");
  res.json(uploads);
});

api.delete("/documents/:id", async (req: Request, res: Response) => {
  const docId = req.params.id;
  const doc = await db.getDocument(docId);
  if (!doc) {
    res.status(404).json({ error: "Document not found." });
    return;
  }
  await db.deleteDocument(docId);
  res.json({ deleted: docId });
});

api.post("/documents/upload", upload.single("file") as any, async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "No file uploaded." });
    return;
  }
  const domain = req.body.domain || "faq";
  const language = req.body.language || "en";
  const filename = file.originalname || "document.txt";
  const textContent = file.buffer.toString("utf-8");

  if (!textContent.trim()) {
    res.status(400).json({ error: "Could not extract any text from the file." });
    return;
  }

  const title = filename.replace(/\.[^/.]+$/, "");
  const doc = await db.addDocument(title, domain, textContent, filename, language, "upload");
  res.json(doc);
});

api.post("/documents/:id/ask", async (req: Request, res: Response) => {
  const docId = req.params.id;
  const doc = await db.getDocument(docId);
  if (!doc) {
    res.status(404).json({ error: "Document not found." });
    return;
  }

  const { message, language: reqLang } = req.body || {};
  if (!message || !message.trim()) {
    res.status(400).json({ error: "Message cannot be empty." });
    return;
  }

  const language = reqLang && reqLang in SUPPORTED_LANGS ? reqLang : detectLanguage(message);
  const searchQuery = await translateQueryToEnglish(message, language);
  const chunks = searchChunks(searchQuery, 5, { document_id: docId });
  const kept = chunks.filter((c) => c.score >= RAG_SCORE_THRESHOLD) || chunks.slice(0, 3);

  const citations: Citation[] = kept.map((c, i) => ({
    n: i + 1,
    document_id: c.document_id,
    title: c.title,
    domain: c.domain,
    source: c.source,
    snippet: c.text.slice(0, 220),
  }));

  const result: RagResult = {
    chunks: kept,
    grounded: kept.length > 0,
    confidence: computeConfidence(chunks, kept.length),
    citations,
    language,
  };

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  res.write(
    formatSSE("meta", {
      grounded: result.grounded,
      confidence: result.confidence,
      language,
      citations: result.citations,
    })
  );

  try {
    for await (const token of streamAnswer(message, result)) {
      res.write(formatSSE("token", { delta: token }));
    }
    res.write(formatSSE("done", {}));
  } catch (err: any) {
    res.write(formatSSE("error", { message: err?.message || "Stream failed" }));
  } finally {
    res.end();
  }
});

// ---------------- Bookmarks ----------------
api.post("/bookmarks", async (req: Request, res: Response) => {
  const { message_id, conversation_id, note, content } = req.body || {};
  if (!message_id || !conversation_id) {
    res.status(400).json({ error: "message_id and conversation_id required." });
    return;
  }
  const bm = await db.addBookmark({ message_id, conversation_id, note, content });
  res.json(bm);
});

api.get("/bookmarks", async (req: Request, res: Response) => {
  const list = await db.listBookmarks();
  res.json(list);
});

api.delete("/bookmarks/:id", async (req: Request, res: Response) => {
  const id = req.params.id;
  await db.deleteBookmark(id);
  res.json({ deleted: id });
});

// Mount API router
app.use("/api", api);

// Vite middleware / static serving
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`VAANI Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
