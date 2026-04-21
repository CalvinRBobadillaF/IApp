import { GoogleGenAI } from "@google/genai";

export async function main(prompt) {
  // ✅ Fix: leer DENTRO de la función, no a nivel de módulo
  const rawKey = localStorage.getItem("Gemini Key");
  const apiKey = rawKey?.replace(/["\\]/g, "");

  const userModel = localStorage.getItem("Model");
  const model = userModel?.replace(/["\\]/g, "") || "gemini-2.5-flash";

  if (!apiKey) {
    return "Error: No se encontró la API Key de Gemini.";
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error("Error en GeminiService:", error);
    if (error.status === 401 || error.status === 403) return "Error: API Key de Gemini inválida.";
    if (error.status === 429) return "Error: Has excedido tu cuota de Gemini.";
    throw error;
  }
}

export default main;