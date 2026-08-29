import { GoogleGenAI, Modality } from "@google/genai";
import { generateWithProvider } from "./llm/manager";

let aiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
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
 * - gemini-3.1-pro-preview for particularly complex tasks
 * - gemini-3.5-flash for general tasks (and Search/Maps grounding)
 * - gemini-3.1-flash-lite for tasks that should happen fast
 */
export function selectModel(tier?: "pro" | "flash" | "lite", hasTools = false): string {
  if (tier === "pro") return "gemini-3.1-pro-preview";
  if (tier === "lite" && !hasTools) return "gemini-3.1-flash-lite";
  return "gemini-3.5-flash";
}

export function getPersonaSystemInstruction(
  persona: string = "rural_advisor",
  language = "en"
): string {
  const baseInstruction = `You are VAANI (वाणी), a trust-first, highly empathetic, and strictly factual Multilingual Rural Intelligence Assistant designed for India's rural citizens, farmers, women self-help groups, and Gram Panchayat operators.
Core Directives:
1. Always maintain conversation context across turns.
2. Present scheme rules, subsidies, eligibility, application processes, and helpline numbers with maximum precision.
3. For agricultural or geographical queries (e.g. Krishi Vigyan Kendras, mandis, soil testing labs, PACS centres, CSC locations), give actionable location guidance.
4. When Google Search or Google Maps grounding is active, ground your answers directly in real-time information and cite your sources.
5. Answer in the requested language (${language}) using clear, dignified, and culturally accessible terms.`;

  switch (persona) {
    case "crop_specialist":
      return `${baseInstruction}\n\nSPECIAL ROLE: Senior Agronomist and PMFBY / KCC Specialist. Provide deep agricultural advice, weather-responsive crop care, pest management, and insurance loss claim deadlines.`;
    case "scheme_navigator":
      return `${baseInstruction}\n\nSPECIAL ROLE: Direct Benefit Transfer (DBT) and Government Scheme Navigator. Explain step-by-step documentation, eligibility checklists, and DBT Aadhaar-seeding guidelines.`;
    default:
      return baseInstruction;
  }
}

/**
 * Multi-turn Chat completion with Gemini supporting:
 * - Specific role system instructions
 * - Model tiers (gemini-3.1-pro-preview, gemini-3.5-flash, gemini-3.1-flash-lite)
 * - Google Search Grounding (googleSearch)
 * - Google Maps Grounding (googleMaps)
 */
export async function generateGeminiChatResponse(params: {
  contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>;
  roleConfig?: ChatRoleConfig;
  language?: string;
}): Promise<{
  text: string;
  groundingMetadata?: any;
  modelUsed: string;
}> {
  const { contents, roleConfig = {}, language = "en" } = params;
  const systemInstruction = getPersonaSystemInstruction(roleConfig.rolePersona, language);

  let fullText = "";
  try {
    for await (const chunk of generateWithProvider({
      contents,
      systemInstruction,
    })) {
      fullText += chunk;
    }
  } catch (err: any) {
    console.error("Provider manager error:", err);
    throw err;
  }

  return {
    text: fullText,
    modelUsed: "provider-manager",
  };
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

  try {
    for await (const chunk of generateWithProvider({
      contents,
      systemInstruction,
    })) {
      yield { delta: chunk, modelUsed: "provider-manager" };
    }
  } catch (err: any) {
    console.error("Provider manager error:", err);
    throw err;
  }
}

export async function completeWithGemini(
  systemInstruction: string,
  prompt: string
): Promise<string> {
  let fullText = "";
  try {
    for await (const chunk of generateWithProvider({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      systemInstruction,
    })) {
      fullText += chunk;
    }
  } catch (err: any) {
    console.error("Provider manager error:", err);
    return "";
  }
  return fullText.trim();
}

export async function* streamWithGemini(
  systemInstruction: string,
  prompt: string
): AsyncGenerator<string, void, unknown> {
  try {
    for await (const chunk of generateWithProvider({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      systemInstruction,
    })) {
      yield chunk;
    }
  } catch (err: any) {
    console.error("Provider manager error:", err);
  }
}

/**
 * Speech-To-Text (STT) using multi-provider fallback (Gemini Flash -> Groq Whisper -> OpenAI Whisper)
 */
export async function transcribeAudioWithGemini(
  audioBuffer: Buffer,
  mimeType = "audio/webm",
  hintLanguage?: string
): Promise<{ text: string; language?: string }> {
  // 1. Try Gemini Flash Multimodal Audio Transcription
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
        ? `You are an accurate speech recognition system for Indian languages and English (including Marathi, Hindi, English, Punjabi, Gujarati, Tamil, Telugu, Kannada, Bengali). Transcribe the spoken audio with exact precision into its native script or English. Expected language: ${hintLanguage}. Return ONLY the verbatim transcribed words. Do NOT include phrases like "The transcription is:" or quotation marks.`
        : `You are an accurate speech recognition system for Indian languages and English. Transcribe the spoken audio with exact precision into its native script (Marathi, Hindi, or English). Return ONLY the verbatim transcribed words. Do NOT include phrases like "The transcription is:" or quotation marks.`;

      // Try gemini-2.5-flash or gemini-2.0-flash
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
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
      console.warn("Gemini transcription fallback triggered:", geminiErr?.message || geminiErr);
    }
  }

  // 2. Fallback to Groq Whisper if available
  const groqKey = process.env.GROQ_API_KEY;
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
  const openaiKey = process.env.OPENAI_API_KEY;
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
  // Remove markdown code fences if any
  cleaned = cleaned.replace(/^```[a-z]*\s*/i, "").replace(/```$/, "").trim();
  // Remove common AI intro prefixes
  cleaned = cleaned.replace(/^(transcription|transcribed text|here is what was said):\s*/i, "");
  // Remove surrounding quotation marks
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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  return {
    model: "gemini-3.1-flash-live-preview",
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  };
}
