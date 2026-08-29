import { OpenAI } from "openai";
import { GoogleGenAI, Modality } from "@google/genai";

// Initialize Clients
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

const getOpenAIClient = (apiKey: string, baseURL: string) => {
  return new OpenAI({ apiKey, baseURL });
};

export async function* generateWithProvider(params: {
  contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>;
  systemInstruction: string;
}) {
  const { contents, systemInstruction } = params;

  // 1. Try Gemini
  const gemini = getGeminiClient();
  if (gemini) {
    try {
      const responseStream = await gemini.models.generateContentStream({
        model: "gemini-3.5-flash",
        contents,
        config: { systemInstruction },
      });
      for await (const chunk of responseStream) {
        if (chunk.text) yield chunk.text;
      }
      return;
    } catch (err: any) {
      console.warn("Gemini failed, trying Groq...", err?.message);
    }
  }

  // 2. Try Groq (OpenAI-compatible)
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const groq = getOpenAIClient(groqKey, "https://api.groq.com/openai/v1");
      const stream = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemInstruction },
          ...contents.map((c) => ({
            role: c.role === "model" ? "assistant" : "user",
            content: c.parts[0].text,
          })),
        ] as any,
        stream: true,
      });
      for await (const chunk of stream) {
        if (chunk.choices[0]?.delta?.content) yield chunk.choices[0].delta.content;
      }
      return;
    } catch (err: any) {
      console.warn("Groq failed, trying OpenRouter...", err?.message);
    }
  }

  // 3. Try OpenRouter (OpenAI-compatible)
  const openRouterKey = process.env.OPENAI_API_KEY; // Using OPENAI_API_KEY as fallback for OpenRouter based on user's env file
  if (openRouterKey) {
    try {
      const openRouter = getOpenAIClient(openRouterKey, "https://openrouter.ai/api/v1");
      const stream = await openRouter.chat.completions.create({
        model: "google/gemini-2.0-flash-001",
        messages: [
          { role: "system", content: systemInstruction },
          ...contents.map((c) => ({
            role: c.role === "model" ? "assistant" : "user",
            content: c.parts[0].text,
          })),
        ] as any,
        stream: true,
      });
      for await (const chunk of stream) {
        if (chunk.choices[0]?.delta?.content) yield chunk.choices[0].delta.content;
      }
      return;
    } catch (err: any) {
      console.error("All providers failed:", err?.message);
      throw new Error("VAANI is temporarily unavailable. Please try again later.");
    }
  }

  throw new Error("No LLM provider configured.");
}
