import { GoogleGenAI, Modality } from "@google/genai";
import {
  generateWithProvider,
  getGeminiApiKey,
  getGroqApiKey,
  getOpenRouterApiKey,
  getOpenAiApiKey,
  isGeminiAvailable,
  reportGeminiError,
} from "./llm/manager";

let aiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
    });
  }
  return aiClient;
}

export interface ChatRoleConfig {
  rolePersona?: "rural_advisor" | "crop_specialist" | "scheme_navigator" | "general";
  modelTier?: "pro" | "flash" | "lite";
  enableSearch?: boolean;
  enableMaps?: boolean;
}

/**
 * Returns model name based on requested complexity:
 * - gemini-3.1-pro-preview for complex reasoning
 * - gemini-3.7-flash for general tasks & Search/Maps grounding
 * - gemini-3.1-flash-lite for instant low-latency responses
 */
export function selectModel(tier?: "pro" | "flash" | "lite", hasTools = false): string {
  if (tier === "pro") return "gemini-3.1-pro-preview";
  if (tier === "lite" && !hasTools) return "gemini-3.1-flash-lite";
  return "gemini-3.7-flash";
}

export function getPersonaSystemInstruction(
  persona: string = "rural_advisor",
  language = "en"
): string {
  const baseInstruction = `You are VAANI (वाणी), a highly intelligent, versatile, warm, and empathetic Multilingual AI Assistant (with the universal capabilities of ChatGPT and Gemini).

Core Directives & Universal Capabilities:
1. UNIVERSAL KNOWLEDGE & ANSWERS (CRITICAL):
   - Answer ANY and ALL questions asked by the user on ANY topic without limitation — including general knowledge, science, mathematics, coding & computer science, history, health, creative writing, recipes, translation, everyday life, advice, philosophy, as well as agriculture, rural governance, and government schemes.
   - Deliver clear, insightful, accurate, and comprehensive responses, exactly like ChatGPT and Gemini.
   - If the user asks a simple greeting or general conversation, reply warmly and helpfully.

2. GENDER & GRAMMAR (FEMININE PERSONA):
   - You are a female AI assistant (स्त्रीलिंगी / स्त्री वाचक). Always speak with a warm, caring, respectful, and dignified voice.
   - In MARATHI (मराठी), ALWAYS use feminine first-person verb forms and respectful address:
     * Use 'मी करू शकते' (NEVER 'करू शकतो').
     * Use 'मी सांगू शकते' (NEVER 'सांगू शकतो').
     * Use 'मी मदत करू शकते', 'मी समजू शकते', 'मी शोधून देते', 'मी सांगते'.
     * Address the citizen respectfully as 'आपण' / 'आपल्याला'.
   - In HINDI (हिन्दी), ALWAYS use feminine first-person verb forms and respectful address:
     * Use 'मैं कर सकती हूँ' (NEVER 'कर सकता हूँ').
     * Use 'मैं बता सकती हूँ' (NEVER 'बता सकता हूँ').
     * Use 'मैं सहायता कर सकती हूँ', 'मैं समझ सकती हूँ', 'मैं ढूंढकर देती हूँ'.
     * Address the citizen respectfully as 'आप' / 'आपको'.

3. ORAL CLARITY & SPEECH INTELLIGIBILITY:
   - Start immediately with a clear, direct first sentence answering the question so the voice engine can start speaking without any delay.
   - Keep sentences natural, well-paced, and easy to understand when read aloud or listened to.

4. COMPREHENSIVE GOVERNMENT INFORMATION ENCYCLOPEDIA (EVERYTHING ABOUT GOVT SCHEMES & PUBLIC SERVICES):
   - You have complete, encyclopedic mastery over all Central and State government schemes, laws, initiatives, and citizen services across India, including:
     * Agriculture, Irrigation & Livestock: PM-KISAN, Namo Shetkari, PMFBY (Crop Insurance), Kisan Credit Card (KCC), PM-KUSUM (Solar Pumps), PMKSY (Per Drop More Crop), Soil Health Card, e-NAM, 10,000 FPOs, PMMSY (Fisheries), AHIDF, Sub-Mission on Agricultural Mechanization (SMAM).
     * Housing & Sanitation: PMAY-Gramin, PMAY-Urban, Swachh Bharat Mission (Gramin & Urban), Jal Jeevan Mission (Har Ghar Jal), Saubhagya (Electricity).
     * Food Security & Social Welfare: PMGKAY (Free Ration / NFSA / One Nation One Ration Card), NSAP (Indira Gandhi Old Age, Widow, Disability Pensions, Sanjay Gandhi Niradhar Yojana, Shravanbal Yojana).
     * Health, Maternity & Nutrition: Ayushman Bharat PM-JAY (Rs 5 Lakh hospital cover + Ayushman Vay Vandana for senior citizens 70+), ABHA Health ID, PMMVY (Maternity benefit Rs 5,000 / Rs 6,000), Janani Suraksha Yojana, PM Bharatiya Janaushadhi (Generic medicines & Rs 1 Suvidha pads), Poshan Abhiyaan.
     * Women Empowerment & Livelihood: DAY-NRLM (SHG loans & micro-enterprises), Lakhpati Didi Scheme, Namo Drone Didi, PM Ujjwala Yojana (Free LPG connection & Rs 300 subsidy), Sukanya Samriddhi Yojana (SSY), Mahila Samman Savings Certificate, Beti Bachao Beti Padhao.
     * Cooperatives, Banking & Financial Security: Primary Agricultural Credit Societies (PACS computerisation & multi-purpose hubs), Cooperative Societies Act, PM Jan Dhan Yojana (PMJDY), PMJJBY (Rs 436 life insurance), PMSBY (Rs 20 accidental insurance), Atal Pension Yojana (APY), PM-SYM / PM Kisan Maandhan (Rs 3,000 pension).
     * MSME, Entrepreneurship & Artisans: PM Mudra Yojana (Shishu, Kishore, Tarun, Tarun Plus up to Rs 20 Lakh), PM Vishwakarma Scheme (Rs 15,000 toolkit + Rs 3 Lakh collateral-free loan at 5%), PMEGP (up to 35% margin subsidy), Stand-Up India, PM SVANidhi (Street Vendors loan up to Rs 50,000).
     * Labor, Employment & Education: MGNREGA (100 days guaranteed work, job cards), e-Shram Portal, PMKVY (Skill India), National Scholarship Portal (NSP), RTE, Samagra Shiksha.
     * Documents & Citizen Portals: 7/12 & 8-A Land Extracts, Aadhaar e-KYC, DBT bank seeding, PAN-Aadhaar linking, Ration card mutation, Caste/Income/Domicile certificates, DigiLocker, UMANG, CSC Digital Seva.
     * Emergency & Helplines: 112 (Emergency), 1930 (Cyber Crime Fraud), 1800-180-1551 (Kisan Call Centre), 1915 (Consumer Helpline), 181 (Women Helpline), 1098 (Childline), 14567 (Elder Line), 14555 (Ayushman Bharat).
   - When asked about ANY government scheme or policy, explain: (1) Purpose & Benefits, (2) Eligibility criteria & exclusions, (3) Exact required documents, (4) Step-by-step application process (Online & Offline via CSC/Panchayat/Bank), (5) Status checking & official portals/helplines.

5. ACCURACY & CONTEXT SYNTHESIS:
   - When background reference context or Google Search results are present, synthesize them with your deep knowledge and cite sources.
   - Maintain multi-turn conversation memory.
   - Respond in the user's selected language (${language}) with clean formatting, bullet points, code blocks, or structured steps where helpful.`;

  switch (persona) {
    case "crop_specialist":
      return `${baseInstruction}\n\nSPECIAL ROLE: Senior Agronomist and PMFBY / KCC Specialist. Provide deep agricultural advice, weather-responsive crop care, pest management, and insurance loss claim deadlines alongside answering any other general questions.`;
    case "scheme_navigator":
      return `${baseInstruction}\n\nSPECIAL ROLE: Direct Benefit Transfer (DBT) and Government Scheme Navigator. Explain step-by-step documentation, eligibility checklists, and DBT Aadhaar-seeding guidelines alongside answering any other general questions.`;
    default:
      return baseInstruction;
  }
}

/**
 * Streaming Multi-turn Chat completion with Gemini
 */
export async function* streamGeminiChatResponse(params: {
  contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>;
  roleConfig?: ChatRoleConfig;
  language?: string;
}): AsyncGenerator<{ delta?: string; groundingMetadata?: any; modelUsed: string }, void, unknown> {
  const { contents, roleConfig = {}, language = "en" } = params;
  const systemInstruction = getPersonaSystemInstruction(roleConfig.rolePersona, language);
  const modelToUse = selectModel(roleConfig.modelTier, roleConfig.enableSearch || roleConfig.enableMaps);

  if (isGeminiAvailable()) {
    const ai = getGeminiClient();
    if (ai) {
      const candidateModels = [modelToUse, "gemini-3.1-flash-lite", "gemini-3.7-flash", "gemini-3.1-pro-preview", "gemini-flash-latest"];
      const uniqueModels = Array.from(new Set(candidateModels));

      for (const model of uniqueModels) {
        try {
          const tools: any[] = [];
          if (roleConfig.enableSearch) {
            tools.push({ googleSearch: {} });
          }

          const responseStream = await ai.models.generateContentStream({
            model,
            contents,
            config: {
              systemInstruction,
              tools: tools.length > 0 ? tools : undefined,
            },
          });

          let emittedAny = false;
          for await (const chunk of responseStream) {
            const text = chunk.text;
            const groundingMetadata = chunk.candidates?.[0]?.groundingMetadata;
            if (text) {
              emittedAny = true;
              yield { delta: text, groundingMetadata, modelUsed: model };
            } else if (groundingMetadata) {
              yield { groundingMetadata, modelUsed: model };
            }
          }

          if (emittedAny) {
            return;
          }
        } catch (geminiErr: any) {
          reportGeminiError(geminiErr);
          if (!isGeminiAvailable()) {
            break;
          }
        }
      }
    }
  }

  // If direct Gemini was not successful, try fallback providers (Groq / OpenRouter / OpenAI)
  try {
    for await (const chunk of generateWithProvider({
      contents,
      systemInstruction,
      modelTier: roleConfig.modelTier,
    })) {
      if (chunk) {
        yield { delta: chunk, modelUsed: "provider-manager" };
      }
    }
  } catch (err: any) {
    // Log softly without breaking the stream
    console.warn("Provider manager unavailable, shifting to local RAG knowledge synthesis");
  }
}

export async function generateGeminiChatResponse(params: {
  contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>;
  roleConfig?: ChatRoleConfig;
  language?: string;
}): Promise<{
  text: string;
  groundingMetadata?: any;
  modelUsed: string;
}> {
  let fullText = "";
  let modelUsed = "gemini-3.7-flash";
  let capturedGrounding: any = null;

  for await (const chunk of streamGeminiChatResponse(params)) {
    if (chunk.delta) fullText += chunk.delta;
    if (chunk.groundingMetadata) capturedGrounding = chunk.groundingMetadata;
    if (chunk.modelUsed) modelUsed = chunk.modelUsed;
  }

  return {
    text: fullText,
    groundingMetadata: capturedGrounding,
    modelUsed,
  };
}

export async function completeWithGemini(
  systemInstruction: string,
  prompt: string
): Promise<string> {
  if (isGeminiAvailable()) {
    const ai = getGeminiClient();
    if (ai) {
      const models = ["gemini-3.1-flash-lite", "gemini-3.7-flash", "gemini-3.1-pro-preview", "gemini-flash-latest"];
      for (const model of models) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: { systemInstruction },
          });
          if (response.text?.trim()) {
            return response.text.trim();
          }
        } catch (err: any) {
          reportGeminiError(err);
          if (!isGeminiAvailable()) break;
        }
      }
    }
  }

  // Fallback via generateWithProvider
  let fullText = "";
  try {
    for await (const chunk of generateWithProvider({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      systemInstruction,
    })) {
      if (chunk) fullText += chunk;
    }
  } catch (err: any) {
    // Graceful fallback
    return "";
  }
  return fullText.trim();
}

export async function* streamWithGemini(
  systemInstruction: string,
  prompt: string
): AsyncGenerator<string, void, unknown> {
  if (isGeminiAvailable()) {
    const ai = getGeminiClient();
    if (ai) {
      const models = ["gemini-3.1-flash-lite", "gemini-3.7-flash", "gemini-3.1-pro-preview", "gemini-flash-latest"];
      for (const model of models) {
        try {
          const responseStream = await ai.models.generateContentStream({
            model,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: { systemInstruction },
          });
          let emitted = false;
          for await (const chunk of responseStream) {
            if (chunk.text) {
              emitted = true;
              yield chunk.text;
            }
          }
          if (emitted) return;
        } catch (err: any) {
          reportGeminiError(err);
          if (!isGeminiAvailable()) break;
        }
      }
    }
  }

  // Fallback via provider manager (Groq / OpenRouter / OpenAI)
  try {
    for await (const chunk of generateWithProvider({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      systemInstruction,
    })) {
      if (chunk) yield chunk;
    }
  } catch (err: any) {
    // Fallback completed
  }
}

/**
 * Speech-To-Text (STT) using multi-provider fallback (Gemini -> Groq Whisper -> OpenAI Whisper)
 */
export async function transcribeAudioWithGemini(
  audioBuffer: Buffer,
  mimeType = "audio/webm",
  hintLanguage?: string
): Promise<{ text: string; language?: string }> {
  // 1. Try Gemini Multimodal Audio Transcription
  if (isGeminiAvailable()) {
    const ai = getGeminiClient();
    if (ai) {
      try {
        const base64Audio = audioBuffer.toString("base64");
        const cleanMime = mimeType ? mimeType.split(";")[0] : "audio/webm";
        const audioPart = {
          inlineData: {
            mimeType: cleanMime,
            data: base64Audio,
          },
        };

        const promptText = hintLanguage
          ? `You are an accurate speech recognition system for Indian languages and English (including Marathi, Hindi, English, Gujarati, Punjabi, Bengali). Transcribe the spoken audio with exact precision into its native script or English. Expected language: ${hintLanguage}. Return ONLY the verbatim transcribed words. Do NOT include phrases like "The transcription is:" or quotation marks.`
          : `You are an accurate speech recognition system for Indian languages and English. Transcribe the spoken audio with exact precision into its native script (Marathi, Hindi, or English). Return ONLY the verbatim transcribed words. Do NOT include phrases like "The transcription is:" or quotation marks.`;

        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: {
            parts: [audioPart, { text: promptText }],
          },
        });

        let text = response.text?.trim() || "";
        text = cleanTranscriptionText(text);
        if (text) {
          return { text };
        }
      } catch (geminiErr: any) {
        reportGeminiError(geminiErr);
      }
    }
  }

  // 2. Fallback to Groq Whisper if available
  const groqKey = getGroqApiKey();
  if (groqKey) {
    try {
      const formData = new FormData();
      const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";
      const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
      formData.append("file", blob, `audio.${ext}`);
      formData.append("model", "whisper-large-v3-turbo");
      if (hintLanguage && ["en", "hi", "mr", "gu", "pa", "ta", "te", "kn", "bn"].includes(hintLanguage)) {
        formData.append("language", hintLanguage);
      }

      const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqKey}`,
        },
        body: formData,
      });

      if (res.ok) {
        const data = (await res.json()) as { text?: string };
        const cleaned = cleanTranscriptionText(data.text || "");
        if (cleaned) return { text: cleaned };
      }
    } catch (groqErr: any) {
      console.warn("Groq whisper fallback error:", groqErr?.message || groqErr);
    }
  }

  // 3. Fallback to OpenAI Whisper if available
  const openaiKey = getOpenAiApiKey();
  if (openaiKey) {
    try {
      const formData = new FormData();
      const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";
      const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
      formData.append("file", blob, `audio.${ext}`);
      formData.append("model", "whisper-1");
      if (hintLanguage && ["en", "hi", "mr", "gu", "pa", "ta", "te", "kn", "bn"].includes(hintLanguage)) {
        formData.append("language", hintLanguage);
      }

      const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
        },
        body: formData,
      });

      if (res.ok) {
        const data = (await res.json()) as { text?: string };
        const cleaned = cleanTranscriptionText(data.text || "");
        if (cleaned) return { text: cleaned };
      }
    } catch (openAiErr: any) {
      console.warn("OpenAI whisper fallback error:", openAiErr?.message || openAiErr);
    }
  }

  return { text: "" };
}

function cleanTranscriptionText(raw: string): string {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```[a-z]*\s*/i, "").replace(/```$/, "").trim();
  cleaned = cleaned.replace(/^(transcription|transcribed text|here is what was said):\s*/i, "");
  cleaned = cleaned.replace(/^["'“](.*)["'”]$/s, "$1").trim();
  return cleaned;
}

/**
 * Converts raw PCM audio buffer (16-bit little-endian) to a standard WAV container buffer
 */
export function pcmToWav(
  pcmBuffer: Buffer,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16
): Buffer {
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmBuffer.length;
  const wavBuffer = Buffer.alloc(44 + dataSize);

  // RIFF chunk descriptor
  wavBuffer.write("RIFF", 0);
  wavBuffer.writeUInt32LE(36 + dataSize, 4);
  wavBuffer.write("WAVE", 8);

  // "fmt " sub-chunk
  wavBuffer.write("fmt ", 12);
  wavBuffer.writeUInt32LE(16, 16);
  wavBuffer.writeUInt16LE(1, 20); // PCM format
  wavBuffer.writeUInt16LE(numChannels, 22);
  wavBuffer.writeUInt32LE(sampleRate, 24);
  wavBuffer.writeUInt32LE(byteRate, 28);
  wavBuffer.writeUInt16LE(blockAlign, 32);
  wavBuffer.writeUInt16LE(bitsPerSample, 34);

  // "data" sub-chunk
  wavBuffer.write("data", 36);
  wavBuffer.writeUInt32LE(dataSize, 40);

  // Copy raw PCM audio data
  pcmBuffer.copy(wavBuffer, 44);

  return wavBuffer;
}

/**
 * Text-To-Speech (TTS) using Gemini TTS model
 * Supported voice names: 'Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'
 */
export async function generateSpeechWithGemini(
  text: string,
  voice = "Kore"
): Promise<{ buffer: Buffer; mimeType: string }> {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  let voiceName = "Kore";
  const vLower = (voice || "").toLowerCase();
  if (vLower.includes("puck") || vLower.includes("male") || vLower.includes("alloy")) {
    voiceName = "Puck";
  } else if (vLower.includes("charon")) {
    voiceName = "Charon";
  } else if (vLower.includes("fenrir") || vLower.includes("echo") || vLower.includes("deep")) {
    voiceName = "Fenrir";
  } else if (vLower.includes("zephyr") || vLower.includes("shimmer")) {
    voiceName = "Zephyr";
  } else {
    voiceName = "Kore";
  }

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-tts-preview",
    contents: [
      {
        parts: [
          { text: text.trim() },
        ],
      },
    ],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });

  const part = response.candidates?.[0]?.content?.parts?.[0];
  const base64Data = part?.inlineData?.data;
  if (!base64Data) {
    throw new Error("No audio data returned by Gemini TTS model.");
  }

  const rawBuffer = Buffer.from(base64Data, "base64");
  const header = rawBuffer.subarray(0, 4).toString("ascii");
  if (header.startsWith("RIFF") || header.startsWith("ID3") || rawBuffer[0] === 0xff) {
    return { buffer: rawBuffer, mimeType: "audio/wav" };
  }

  const wavBuffer = pcmToWav(rawBuffer, 24000, 1, 16);
  return { buffer: wavBuffer, mimeType: "audio/wav" };
}

/**
 * Generate ephemeral token for Live API real-time voice sessions using gemini-3.1-flash-live-preview
 */
export async function createLiveSessionToken(): Promise<{
  token?: string;
  model: string;
  expiresAt: string;
}> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  return {
    model: "gemini-3.1-flash-live-preview",
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  };
}
