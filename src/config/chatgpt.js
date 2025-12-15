// services/MainGPT.js
import OpenAI from "openai";

const rawKey = localStorage.getItem("GPT Key");
const apiKey = rawKey?.replace(/["\\]/g, "");

const userModel = localStorage.getItem('ModelGPT')
const model = userModel?.replace(/["\\]/g, "")

const client = new OpenAI({
  apiKey: apiKey, 
  dangerouslyAllowBrowser: true
  // o process.env.OPENAI_API_KEY si no usas Vite
});

export const MainGPT = async (prompt) => {
  try {
    const response = await client.responses.create({
      model: model,
      input: prompt,
    });

    return response.output_text;
  } catch (error) {
    console.error("Error en MainGPT:", error);
    return "Error al generar la respuesta";
  }
};

MainGPT('Cuentame un dato curioso.')

