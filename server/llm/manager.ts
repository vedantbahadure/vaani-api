import { OpenAI } from "openai";
import { GoogleGenAI } from "@google/genai";

// Cooldown tracker for Gemini 429 rate limits
let geminiCooldownUntil = 0;

export function isGeminiAvailable(): boolean {
  if (!getGeminiApiKey()) return false;
  return Date.now() >= geminiCooldownUntil;
}

export function reportGeminiError(err: any): void {
  const msg = (err?.message || String(err)).toLowerCase();
  const status = err?.status || err?.code;
  if (
    status === 429 ||
    status === "RESOURCE_EXHAUSTED" ||
    msg.includes("429") ||
    msg.includes("resource_exhausted") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests")
  ) {
    let cooldownMs = 60000;
    const retryMatch = msg.match(/retry in\s+([0-9.]+)\s*s/i);
    if (retryMatch && parseFloat(retryMatch[1])) {
      cooldownMs = Math.ceil(parseFloat(retryMatch[1]) * 1000) + 2000;
    }
    geminiCooldownUntil = Date.now() + Math.max(cooldownMs, 30000);
    console.warn(`[LLM Manager] Gemini 429 quota reached. Routing directly to fallback models until ${new Date(geminiCooldownUntil).toLocaleTimeString()}`);
  }
}

// Resolve keys across potential environment variable naming conventions
export function getGeminiApiKey(): string | null {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GeminiAPI ||
    process.env.GEMINI_API ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    null
  );
}

export function getGroqApiKey(): string | null {
  return (
    process.env.GROQ_API_KEY ||
    process.env.Groq_API_Key ||
    process.env.Groq__API ||
    null
  );
}

export function getOpenRouterApiKey(): string | null {
  return (
    process.env.OPENROUTER_API_KEY ||
    process.env.OpenRouterAPi ||
    (process.env.OPENAI_API_KEY?.startsWith("sk-or-") ? process.env.OPENAI_API_KEY : null) ||
    null
  );
}

export function getOpenAiApiKey(): string | null {
  const key = process.env.OPENAI_API_KEY;
  if (key && !key.startsWith("sk-or-")) return key;
  return null;
}

// Initialize Clients
const getGeminiClient = () => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export async function* generateWithProvider(params: {
  contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>;
  systemInstruction: string;
  modelTier?: "pro" | "flash" | "lite";
}) {
  const { contents, systemInstruction, modelTier } = params;

  // 1. Try Gemini if not in rate-limit cooldown
  if (isGeminiAvailable()) {
    const gemini = getGeminiClient();
    if (gemini) {
      const candidateModels = [
        modelTier === "pro" ? "gemini-3.1-pro-preview" : modelTier === "lite" ? "gemini-3.1-flash-lite" : "gemini-3.7-flash",
        "gemini-3.1-flash-lite",
        "gemini-3.7-flash",
        "gemini-3.1-pro-preview",
        "gemini-flash-latest",
      ];
      const uniqueCandidates = Array.from(new Set(candidateModels));

      for (const model of uniqueCandidates) {
        try {
          const responseStream = await gemini.models.generateContentStream({
            model,
            contents,
            config: { systemInstruction },
          });
          let yielded = false;
          for await (const chunk of responseStream) {
            if (chunk.text) {
              yielded = true;
              yield chunk.text;
            }
          }
          if (yielded) return;
        } catch (err: any) {
          reportGeminiError(err);
          // If rate limit / quota exhausted, stop hammering Gemini models and switch to Groq immediately
          if (!isGeminiAvailable()) {
            break;
          }
        }
      }
    }
  }

  // 2. Try Groq with active ultra-fast models
  const groqKey = getGroqApiKey();
  if (groqKey && groqKey.trim() !== "") {
    const groqModels = [
      "openai/gpt-oss-120b",
      "qwen/qwen3.8-27b",
      "openai/gpt-oss-20b",
      "qwen/qwen3.6-27b",
      "groq/compound",
      "groq/compound-mini",
    ];
    const groq = new OpenAI({
      apiKey: groqKey,
      baseURL: "https://api.groq.com/openai/v1",
    });

    for (const model of groqModels) {
      try {
        const stream = await groq.chat.completions.create({
          model,
          messages: [
            { role: "system", content: systemInstruction },
            ...contents.map((c) => ({
              role: c.role === "model" ? "assistant" : "user",
              content: c.parts[0]?.text || "",
            })),
          ] as any,
          stream: true,
        });
        let yielded = false;
        for await (const chunk of stream) {
          if (chunk.choices[0]?.delta?.content) {
            yielded = true;
            yield chunk.choices[0].delta.content;
          }
        }
        if (yielded) return;
      } catch (err: any) {
        console.warn(`Groq model ${model} failed, trying next:`, err?.message || err);
      }
    }
  }

  // 3. Try OpenRouter if configured
  const openRouterKey = getOpenRouterApiKey();
  if (openRouterKey && openRouterKey.trim() !== "") {
    const openRouter = new OpenAI({
      apiKey: openRouterKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://vaani.ai",
        "X-Title": "VAANI Rural AI",
      },
    });
    const routerModels = [
      "google/gemini-2.0-flash-001",
      "meta-llama/llama-3.1-8b-instruct",
      "mistralai/mistral-7b-instruct",
    ];
    for (const model of routerModels) {
      try {
        const stream = await openRouter.chat.completions.create({
          model,
          messages: [
            { role: "system", content: systemInstruction },
            ...contents.map((c) => ({
              role: c.role === "model" ? "assistant" : "user",
              content: c.parts[0]?.text || "",
            })),
          ] as any,
          max_tokens: 1500,
          stream: true,
        });
        let yielded = false;
        for await (const chunk of stream) {
          if (chunk.choices[0]?.delta?.content) {
            yielded = true;
            yield chunk.choices[0].delta.content;
          }
        }
        if (yielded) return;
      } catch (err: any) {
        console.warn(`OpenRouter model ${model} failed:`, err?.message || err);
      }
    }
  }

  // 4. Try standard OpenAI if configured
  const openaiKey = getOpenAiApiKey();
  if (openaiKey && openaiKey.trim() !== "") {
    try {
      const openai = new OpenAI({ apiKey: openaiKey });
      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemInstruction },
          ...contents.map((c) => ({
            role: c.role === "model" ? "assistant" : "user",
            content: c.parts[0]?.text || "",
          })),
        ] as any,
        stream: true,
      });
      let yielded = false;
      for await (const chunk of stream) {
        if (chunk.choices[0]?.delta?.content) {
          yielded = true;
          yield chunk.choices[0].delta.content;
        }
      }
      if (yielded) return;
    } catch (err: any) {
      console.warn("OpenAI fallback failed:", err?.message || err);
    }
  }

  // Gracefully yield without crashing when offline / local RAG fallback is used
  return;
}

/**
 * Generate Structured JSON with multi-provider fallback
 */
export async function generateJsonWithProvider(params: {
  systemInstruction: string;
  prompt: string;
}): Promise<Record<string, any> | null> {
  const { systemInstruction, prompt } = params;

  // 1. Try Gemini if available
  if (isGeminiAvailable()) {
    const gemini = getGeminiClient();
    if (gemini) {
      try {
        const response = await gemini.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            systemInstruction,
            responseMimeType: "application/json",
          },
        });
        if (response.text) {
          return JSON.parse(response.text);
        }
      } catch (err: any) {
        reportGeminiError(err);
      }
    }
  }

  // 2. Try Groq
  const groqKey = getGroqApiKey();
  if (groqKey) {
    const groq = new OpenAI({ apiKey: groqKey, baseURL: "https://api.groq.com/openai/v1" });
    const models = ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"];
    for (const model of models) {
      try {
        const res = await groq.chat.completions.create({
          model,
          messages: [
            { role: "system", content: `${systemInstruction}\nOutput valid JSON only. Do not include markdown formatting or extra text.` },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        });
        const text = res.choices[0]?.message?.content?.trim();
        if (text) {
          return JSON.parse(text);
        }
      } catch (err: any) {
        // Continue
      }
    }
  }

  // 3. Try OpenRouter / OpenAI
  const openRouterKey = getOpenRouterApiKey();
  if (openRouterKey) {
    try {
      const openRouter = new OpenAI({
        apiKey: openRouterKey,
        baseURL: "https://openrouter.ai/api/v1",
      });
      const res = await openRouter.chat.completions.create({
        model: "google/gemini-2.0-flash-001",
        messages: [
          { role: "system", content: `${systemInstruction}\nOutput valid JSON only.` },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      });
      const text = res.choices[0]?.message?.content?.trim();
      if (text) {
        return JSON.parse(text);
      }
    } catch (err) {}
  }

  return null;
}
