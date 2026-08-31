import { Citation, RetrievedChunk } from "./types";
import { db, StoredChunk } from "./db";
import { completeWithGemini, streamWithGemini } from "./gemini";

export const SUPPORTED_LANGS: Record<string, string> = {
  en: "English",
  hi: "हिन्दी",
  mr: "मराठी",
  gu: "ગુજરાતી",
  te: "తెలుగు",
  kn: "ಕನ್ನಡ",
  ta: "தமிழ்",
};

export const LANG_NAMES: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  mr: "Marathi",
  gu: "Gujarati",
  te: "Telugu",
  kn: "Kannada",
  ta: "Tamil",
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

// Instant multilingual query normalization (runs in 0ms without blocking LLM calls)
const REGIONAL_TERMS_MAP: Record<string, string[]> = {
  "शेतकरी": ["farmer", "kisan", "agriculture"],
  "योजना": ["scheme", "yojana", "subsidy", "benefit"],
  "कापूस": ["cotton", "kapas", "crop"],
  "सोयाबीन": ["soybean", "oilseed"],
  "पीक": ["crop", "harvest"],
  "विमा": ["insurance", "pmfby", "claim"],
  "कर्ज": ["loan", "kcc", "credit"],
  "अनुदान": ["subsidy", "grant"],
  "खत": ["fertilizer", "urea", "dap", "soil"],
  "पाणी": ["water", "irrigation", "pmksy"],
  "विहीर": ["well", "irrigation"],
  "सौर": ["solar", "kusum", "pump"],
  "पंप": ["pump", "motor"],
  "७/१२": ["7/12", "satbara", "land record"],
  "८-अ": ["8a", "land holding"],
  "पेंशन": ["pension", "nsap", "sanjay gandhi"],
  "घरकुल": ["pmay", "housing", "awas"],
  "रेशन": ["ration", "pmgkay", "food grain"],
  "आरोग्य": ["health", "ayushman", "pmjay", "hospital"],
};

export async function translateQueryToEnglish(query: string, language: string): Promise<string> {
  if (!query) return "";
  let enriched = query.toLowerCase();
  
  // Fast bilingual keyword enrichment
  for (const [term, equivalents] of Object.entries(REGIONAL_TERMS_MAP)) {
    if (query.includes(term)) {
      enriched += " " + equivalents.join(" ");
    }
  }
  return enriched;
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
  const feminineGuideline =
    "PERSONA & GENDER (FEMININE):\n" +
    "You are VAANI (वाणी), a warm, female AI assistant (स्त्रीलिंगी / स्त्री वाचक). Always use feminine first-person grammatical forms:\n" +
    "- In Marathi: Use 'मी करू शकते' (never 'करू शकतो'), 'मी सांगू शकते', 'मी मदत करू शकते', 'मी समजू शकते'.\n" +
    "- In Hindi: Use 'मैं कर सकती हूँ' (never 'कर सकता हूँ'), 'मैं बता सकती हूँ', 'मैं सहायता कर सकती हूँ'.\n" +
    "Speak with warmth, respect, and natural human empathy. Keep the first sentence direct and clear for oral voice playback. Use simple, clear language.\n\n";

  if (grounded) {
    return (
      "You are VAANI (वाणी), a highly capable, versatile, and helpful AI assistant (like ChatGPT and Gemini) with specialized knowledge in rural governance, agriculture, government schemes, and general intelligence.\n\n" +
      feminineGuideline +
      "GUIDELINES:\n" +
      "1. Answer ANY and EVERY question asked by the user clearly, thoroughly, and helpfully.\n" +
      "2. When relevant context from verified official records is provided below, incorporate it and cite bracketed numbers like [1], [2].\n" +
      "3. Also feel free to use your full world knowledge whenever helpful to explain concepts, give examples, or answer broader questions.\n" +
      "4. Be warm, clear and simple.\n" +
      `5. Reply ENTIRELY in ${langName}.\n` +
      "6. Use structured formatting (paragraphs, bullet points, numbered steps) for readability."
    );
  }
  return (
    "You are VAANI (वाणी), a highly capable, versatile, warm, and helpful AI assistant (like ChatGPT and Gemini).\n\n" +
    feminineGuideline +
    "GUIDELINES:\n" +
    "1. Answer ANY and ALL questions asked by the user on any topic (including general knowledge, science, mathematics, coding, history, daily life, language, agriculture, schemes, storytelling, etc.) with high intelligence, accuracy, and clarity.\n" +
    "2. Provide direct, comprehensive, and helpful answers exactly like ChatGPT and Gemini.\n" +
    `3. Reply ENTIRELY in ${langName}.\n` +
    "4. Use clean formatting with clear paragraphs, bullet points, or step-by-step instructions where appropriate."
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

  let tokenCount = 0;
  try {
    for await (const token of streamWithGemini(system, prompt)) {
      if (token) {
        tokenCount++;
        yield token;
      }
    }
  } catch (err) {
    console.warn("streamWithGemini in streamAnswer error:", err);
  }

  // If no tokens were emitted (e.g. Gemini quota/network/key issue), stream local verified knowledge
  if (tokenCount === 0) {
    const fallbackAnswer = generateLocalAnswer(query, result);
    // Split into natural word chunks for smooth simulated streaming
    const words = fallbackAnswer.split(/(\s+)/);
    for (const w of words) {
      yield w;
    }
  }
}

export function generateLocalAnswer(query: string, result: RagResult): string {
  const lang = result.language;
  const qLower = query.toLowerCase();

  if (result.grounded && result.chunks.length > 0) {
    const c1 = result.chunks[0];
    const otherChunks = result.chunks.slice(1, 3);
    const domainName = c1.domain ? c1.domain.toUpperCase() : "GOVERNANCE";

    if (lang === "hi") {
      let ans = `### 📋 **${c1.title}** [1]\n\n`;
      ans += `${c1.text}\n\n`;
      if (otherChunks.length > 0) {
        ans += `**संबंधित महत्वपूर्ण विवरण:**\n`;
        otherChunks.forEach((c, idx) => {
          ans += `- **${c.title}** [${idx + 2}]: ${c.text.slice(0, 220)}… [${idx + 2}]\n`;
        });
        ans += "\n";
      }
      ans += `\n> 💡 **सहायता व आवेदन:** आप अपने नजदीकी **ग्राम पंचायत सीएससी (CSC) केंद्र** या आधिकारिक पोर्टल पर जाकर सीधे पंजीकरण/जांच कर सकते हैं।`;
      return ans;
    }

    if (lang === "mr") {
      let ans = `### 📋 **${c1.title}** [1]\n\n`;
      ans += `${c1.text}\n\n`;
      if (otherChunks.length > 0) {
        ans += `**संबंधित महत्त्वाचे मुद्दे:**\n`;
        otherChunks.forEach((c, idx) => {
          ans += `- **${c.title}** [${idx + 2}]: ${c.text.slice(0, 220)}… [${idx + 2}]\n`;
        });
        ans += "\n";
      }
      ans += `\n> 💡 **मदत व अर्ज प्रक्रिया:** आपण आपल्या गावातील **ग्रामपंचायत सीएससी (CSC) केंद्र** किंवा अधिकृत सरकारी संकेतस्थळाला भेट देऊन माहिती पडताळू शकता.`;
      return ans;
    }

    let ans = `### 📋 **${c1.title}** [1]\n\n`;
    ans += `${c1.text}\n\n`;
    if (otherChunks.length > 0) {
      ans += `**Key Additional Details:**\n`;
      otherChunks.forEach((c, idx) => {
        ans += `- **${c.title}** [${idx + 2}]: ${c.text.slice(0, 220)}… [${idx + 2}]\n`;
      });
      ans += "\n";
    }
    ans += `\n> 💡 **Actionable Guidance:** Visit your nearest **Gram Panchayat CSC (Common Service Centre)** or the official national portal for Aadhaar e-KYC and DBT status verification.`;
    return ans;
  }

  // Domain-specific smart local fallback
  if (qLower.includes("kisan") || qLower.includes("pmkisan") || qLower.includes("किस्त") || qLower.includes("हप्ता") || qLower.includes("सन्मान")) {
    if (lang === "hi") {
      return `### 🌾 **प्रधानमंत्री किसान सम्मान निधि (PM-KISAN)**\n\n- **वित्तीय लाभ:** पात्र किसान परिवारों को प्रति वर्ष ₹6,000 की प्रत्यक्ष वित्तीय सहायता ₹2,000 की 3 समान किस्तों में दी जाती है।\n- **अनिवार्य आवश्यकताएं:**\n  1. आधार ई-केवाईसी (Aadhaar e-KYC) पूर्ण होना।\n  2. बैंक खाता आधार और डीबीटी (DBT) से जुड़ा होना।\n  3. भूमि अभिलेख (Land Seeding) पोर्टल पर सत्यापित होना।\n- **हेल्पलाइन:** 155261 / 1800-115-526\n\n> 📌 *स्थिति जांच के लिए pmkisan.gov.in पर 'Know Your Status' विकल्प देखें।*`;
    }
    if (lang === "mr") {
      return `### 🌾 **पंतप्रधान किसान सन्मान निधी (PM-KISAN)**\n\n- **आर्थिक लाभ:** पात्र शेतकरी कुटुंबांना दरवर्षी ₹६,००० चा लाभ ₹२,००० च्या ३ हप्त्यांमध्ये थेट बँक खात्यात दिला जातो.\n- **आवश्यक बाबी:**\n  1. आधार ई-केवायसी (e-KYC) पूर्ण असणे आवश्यक.\n  2. बँक खाते आधार व DBT शी जोडलेले असावे.\n  3. जमिनीची नोंद (Land Seeding) पोर्टलवर अद्ययावत असणे.\n- **हेल्पलाइन:** १५५२६१ / १८००-११५-५२६\n\n> 📌 *आपल्या हप्त्याची स्थिती pmkisan.gov.in वर 'Know Your Status' द्वारे तपासा.*`;
    }
    return `### 🌾 **PM-KISAN Samman Nidhi Scheme**\n\n- **Benefit:** ₹6,000 per year provided in 3 equal four-monthly installments of ₹2,000 directly via DBT.\n- **Mandatory Requirements:**\n  1. Active Aadhaar e-KYC on the portal.\n  2. Bank account seeded with Aadhaar for DBT payments.\n  3. Land records seeding verified by local Patwari/Tehsil.\n- **Official Helpline:** 155261 / 1800-115-526`;
  }

  if (lang === "hi") {
    return `### 🌾 **वाणी (VAANI) ग्रामीण मार्गदर्शक**\n\nआपके प्रश्न के लिए स्थानीय ज्ञानकोश में जानकारी खोजी गई। कृपया निम्नलिखित प्रमुख विषयों पर विशिष्ट प्रश्न पूछें:\n\n1. **कृषि व फसल:** PM-KISAN, PMFBY फसल बीमा, किसान क्रेडिट कार्ड (KCC), मृदा स्वास्थ्य कार्ड\n2. **सहकारिता:** पैक्स (PACS) ऋण, महिला स्वयं सहायता समूह (SHG) योजनाएं\n3. **राशन व आजीविका:** वन नेशन वन राशन कार्ड (NFSA), मनरेगा (MGNREGA)\n\n> 💬 *कृपया अपनी योजना या समस्या का नाम लिखकर पुनः पूछें।*`;
  }
  if (lang === "mr") {
    return `### 🌾 **वाणी (VAANI) ग्रामीण मार्गदर्शक**\n\nआपल्या प्रश्नासाठी माहिती तपासण्यात आली आहे. कृपया खालील प्रमुख योजनांविषयी अधिक माहितीसाठी प्रश्न विचारा:\n\n1. **कृषी व शेती:** PM-KISAN हप्ते, PMFBY पीक विमा, किसान क्रेडिट कार्ड (KCC), मृदा आरोग्य पत्रिका\n2. **सहकार व वित्त:** PACS सोसायटी कर्ज, महिला बचत गट (SHG) योजना\n3. **रेशन व रोजगार:** NFSA रेशन कार्ड, मनरेगा (MGNREGA) रोजगार\n\n> 💬 *कृपया योजनेचे नाव नमूद करून प्रश्न विचारावा.*`;
  }
  return `### 🌾 **VAANI Rural Intelligence Guide**\n\nI have searched our rural governance and agricultural repository. To give you the most accurate entitlement details, please specify your query around:\n\n1. **Agriculture & Schemes:** PM-KISAN DBT installments, PMFBY Crop Insurance claim windows, Kisan Credit Card (KCC) interest subvention, Soil Health Cards.\n2. **Cooperatives & SHGs:** Primary Agricultural Credit Societies (PACS), NRLM Women SHG bank loans.\n3. **Entitlements & Food Security:** NFSA Ration Cards, MGNREGA job cards.\n\n> 💬 *Feel free to type or speak your query with the scheme name.*`;
}
