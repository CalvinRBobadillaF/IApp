import OpenAI from "openai";

const SYSTEM_PROMPT = `
Eres un asistente útil y creativo integrado en una aplicación React.

CAPACIDAD VISUAL:
Si el usuario te pide una imagen, foto o dibujo:
1. NO uses etiquetas XML como <Image> o <tag>.
2. NO uses bloques de código.
3. Usa exactamente este formato:

[Image of descripción detallada en inglés]

Ejemplo correcto: "Aquí tienes: [Image of a red sports car on a mountain road]"
Ejemplo INCORRECTO: "<Image>[a red car]</Image>"
`;

// ✅ Fix: export con el nombre que espera router.js
export const MainGPT = async (prompt) => {
  // ✅ Fix: leer DENTRO de la función, no a nivel de módulo
  const rawKey = localStorage.getItem("GPT Key");
  const apiKey = rawKey?.replace(/["\\]/g, "");

  const userModel = localStorage.getItem("ModelGPT");
  const model = userModel?.replace(/["\\]/g, "") || "gpt-5";

  if (!apiKey) {
    return "Error: No se encontró la API Key de OpenAI.";
  }

  const client = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 1,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error("Error en chatGPTService:", error);
    if (error.status === 401) return "Error: API Key de OpenAI inválida.";
    if (error.status === 429) return "Error: Has excedido tu cuota de OpenAI.";
    throw error;
  }
};