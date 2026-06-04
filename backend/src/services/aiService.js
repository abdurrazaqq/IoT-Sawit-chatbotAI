import { GoogleGenAI } from "@google/genai";
import {
  buildSensorPrompt,
  fallbackReply,
  sanitizeMessages
} from "../utils/aiUtils.js";

export async function chatWithAI({ messages, sensor }) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return fallbackReply(messages, sensor);
  }

  const ai = new GoogleGenAI({
    apiKey
  });

  const prompt = `
${buildSensorPrompt(sensor)}

Riwayat percakapan:
${sanitizeMessages(messages)
  .map((m) => `${m.role}: ${m.content}`)
  .join("\n")}
`;

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    contents: prompt
  });

  return response.text;
}