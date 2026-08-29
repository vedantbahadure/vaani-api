import { Citation, RetrievedChunk } from "./types";
import { db, StoredChunk } from "./db";
import { completeWithGemini, streamWithGemini } from "./gemini";

export const SUPPORTED_LANGS: Record<string, string> = {
  en: "English",
  hi: "हिन्दी",
  mr: "मराठी",
};

export const LANG_NAMES: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  mr: "Marathi",
};

export const RAG_TOP_K = 5;
export const RAG_SCORE_THRESHOLD = 0.28;

export function detectLanguage(text: string, fallback = "en"): string {
  const hasDeva = /[\u0900-\u097F]/.test(text);
  if (hasDeva) {
    // Check common Marathi-specific words
    if (/\b(आहे|नाही|कसा|काय|करावे|शेतकरी|योजना|पाहिजे|मिळेल)\b/i.test(text) && fallback === "mr") {
      return "mr";
    }
    return fallback in SUPPORTED_LANGS ? fallback : "hi";
  }
  return fallback in SUPPORTED_LANGS ? fallback : "en";
}

export async function translateQueryToEnglish(query: string, language: string): Promise<string> {
  const hasDeva = /[\u0900-\u097F]/.test(query);
  if (language === "en" && !hasDeva) {
    return query;
  }
  try {
    const system =
      "You translate the user's question to concise English for a document search. Output ONLY the English translation, no quotes, no extra words.";
    const translated = await completeWithGemini(system, query);
    return translated.trim() || query;
  } catch {
    return query;
  }
}

// Tokenize text into normalized word stems/tokens
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0900-\u097F]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

// BM25-like / TF-IDF semantic chunk search
export function searchChunks(
  query: string,
  k = RAG_TOP_K,
  where?: { domain?: string; document_id?: string }
): RetrievedChunk[] {
  const allChunks = db.chunks;
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return [];

  let candidates = allChunks;
  if (where?.domain) {
    candidates = candidates.filter(
      (c) => c.domain.toLowerCase() === where.domain?.toLowerCase()
    );
  }
  if (where?.document_id) {
    candidates = candidates.filter((c) => c.document_id === where.document_id);
  }

  const scored: Array<{ chunk: StoredChunk; score: number }> = [];

  for (const chunk of candidates) {
    const titleTokens = tokenize(chunk.title);
    const domainTokens = tokenize(chunk.domain);
    const bodyTokens = tokenize(chunk.text);

    let matchCount = 0;
    let titleBonus = 0;
    let exactPhraseBonus = 0;

    const fullText = (chunk.title + " " + chunk.text).toLowerCase();
    const qLower = query.toLowerCase().trim();

    if (fullText.includes(qLower) && qLower.length > 4) {
      exactPhraseBonus += 0.4;
    }

    for (const qt of qTokens) {
      let termWeight = 1.0;
      if (qt.length > 5) termWeight = 1.3;

      // Title matches are heavily weighted
      if (titleTokens.some((t) => t.includes(qt) || qt.includes(t))) {
        titleBonus += 0.25 * termWeight;
      }
      if (domainTokens.some((d) => d.includes(qt))) {
        titleBonus += 0.15 * termWeight;
      }

      // Body term frequencies
      const bodyMatches = bodyTokens.filter((b) => b === qt || b.startsWith(qt) || qt.startsWith(b)).length;
      if (bodyMatches > 0) {
        matchCount += Math.min(2.0, Math.log(1 + bodyMatches)) * termWeight;
      }
    }

    if (matchCount > 0 || titleBonus > 0 || exactPhraseBonus > 0) {
      const coverage = matchCount / Math.max(1, qTokens.length);
      const rawScore = 0.2 * coverage + 0.3 * titleBonus + 0.3 * exactPhraseBonus + 0.2 * Math.min(1.0, matchCount / 5);
      const normalizedScore = Math.min(0.98, Math.max(0.05, rawScore));
      scored.push({ chunk, score: normalizedScore });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, k).map(({ chunk, score }) => ({
    document_id: chunk.document_id,
    title: chunk.title,
    domain: chunk.domain,
    source: chunk.source,
    text: chunk.text,
    score: Math.round(score * 1000) / 1000,
    chunk_index: chunk.chunk_index,
  }));
}

export function computeConfidence(chunks: RetrievedChunk[], usedCount: number): number {
  if (!chunks || chunks.length === 0 || usedCount === 0) {
    return 0.0;
  }
  const top = chunks[0].score;
  const coverage = Math.min(1.0, usedCount / Math.max(1, RAG_TOP_K));
  const normTop = Math.min(1.0, top / 0.62);
  const conf = 0.15 + 0.7 * normTop + 0.15 * coverage;
  return Math.round(Math.max(0.0, Math.min(1.0, conf)) * 1000) / 1000;
}

export interface RagResult {
  chunks: RetrievedChunk[];
  grounded: boolean;
  confidence: number;
  citations: Citation[];
  language: string;
}

export function retrieve(query: string, language: string, domain?: string): RagResult {
  const chunks = searchChunks(query, RAG_TOP_K, domain ? { domain } : undefined);
  const kept = chunks.filter((c) => c.score >= RAG_SCORE_THRESHOLD);
  const grounded = kept.length > 0;
  const use = grounded ? kept : [];
  const confidence = grounded
    ? computeConfidence(chunks, use.length)
    : Math.round(((chunks[0]?.score || 0.0) * 0.4) * 1000) / 1000;

  const citations: Citation[] = use.map((c, i) => ({
    n: i + 1,
    document_id: c.document_id,
    title: c.title,
    domain: c.domain,
    source: c.source,
    snippet: c.text.length > 220 ? c.text.slice(0, 220) + "…" : c.text,
  }));

  return {
    chunks: use,
    grounded,
    confidence,
    citations,
    language,
  };
}

export function buildContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map((c, i) => `[${i + 1}] (source: ${c.title} — ${c.domain})\n${c.text}`)
    .join("\n\n");
}

export function getSystemPrompt(lang: string, grounded: boolean): string {
  const langName = LANG_NAMES[lang] || "English";
  if (grounded) {
    return (
      "You are VAANI, a trustworthy AI assistant for rural governance in India, helping " +
      "farmers, cooperative members and rural citizens understand government schemes, " +
      "cooperative law, PACS, crop insurance, agriculture and financial literacy.\n\n" +
      "STRICT RULES:\n" +
      "1. Answer ONLY using the CONTEXT below. Do NOT use outside knowledge.\n" +
      "2. Cite every fact with bracketed numbers like [1], [2] matching the context blocks.\n" +
      "3. If the context does not contain the answer, say so honestly.\n" +
      "4. Be warm, clear and simple — the reader may be new to government processes.\n" +
      `5. Reply ENTIRELY in ${langName}.\n` +
      "6. Use short paragraphs and, where useful, simple numbered steps."
    );
  }
  return (
    "You are VAANI, a trustworthy AI assistant for rural governance in India. " +
    "You have NO verified document for this question. Do not invent specific facts, " +
    "figures, eligibility rules or scheme names. Gently explain that you don't have " +
    "verified information on this yet, suggest the closest relevant official topic, and " +
    `offer to help with a related question. Reply ENTIRELY in ${langName}.`
  );
}

export async function* streamAnswer(
  query: string,
  result: RagResult
): AsyncGenerator<string, void, unknown> {
  const system = getSystemPrompt(result.language, result.grounded);
  const prompt = result.grounded
    ? `CONTEXT:\n${buildContext(result.chunks)}\n\nQUESTION: ${query}\n\nAnswer using only the context, with citations.`
    : `QUESTION: ${query}`;

  try {
    for await (const token of streamWithGemini(system, prompt)) {
      yield token;
    }
  } catch (err) {
    // If Gemini key is not configured or fails, generate a clean local grounded response
    const fallbackAnswer = generateLocalAnswer(query, result);
    // Stream fallback in word tokens
    const words = fallbackAnswer.split(/(\s+)/);
    for (const w of words) {
      yield w;
    }
  }
}

function generateLocalAnswer(query: string, result: RagResult): string {
  const lang = result.language;
  if (result.grounded && result.chunks.length > 0) {
    const c = result.chunks[0];
    if (lang === "hi") {
      return `सत्यापित जानकारी के अनुसार, **${c.title}** [1] के तहत: \n\n${c.text.slice(0, 350)}… [1]\n\nअधिक जानकारी और सहायता के लिए आप अपने नजदीकी सीएससी (CSC) या संबंधित कार्यालय से संपर्क कर सकते हैं।`;
    }
    if (lang === "mr") {
      return `सत्यापित माहितीनुसार, **${c.title}** [1] अंतर्गत: \n\n${c.text.slice(0, 350)}… [1]\n\nअधिक माहितीसाठी आपण आपल्या जवळच्या सीएससी (CSC) केंद्राशी किंवा कार्यालयाशी संपर्क साधू शकता.`;
    }
    return `Based on verified documents for **${c.title}** [1]:\n\n${c.text.slice(0, 350)}… [1]\n\nFor official application or inquiries, visit the official portal or your local Common Service Centre (CSC).`;
  }

  if (lang === "hi") {
    return "VAANI के पास इस विशिष्ट प्रश्न के लिए अभी सत्यापित सरकारी दस्तावेज उपलब्ध नहीं है। कृपया PM-KISAN, PMFBY फसल बीमा, PACS सहकारी समिति, या किसान क्रेडिट कार्ड (KCC) से संबंधित प्रश्न पूछें।";
  }
  if (lang === "mr") {
    return "VAANI कडे या विशिष्ट प्रश्नासाठी सध्या सत्यापित शासकीय दस्तऐवज उपलब्ध नाही. कृपया PM-KISAN, PMFBY पीक विमा, PACS किंवा किसान क्रेडिट कार्ड (KCC) विषयी प्रश्न विचारा.";
  }
  return "VAANI does not have a verified document for this specific question yet. You may ask about PM-KISAN, PMFBY Crop Insurance, PACS cooperative credit, Soil Health Cards, or Kisan Credit Cards.";
}
