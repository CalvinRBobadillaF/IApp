// services/MainGPT.js
import OpenAI from "openai";
import Main from "../components/Main/Main";

const client = new OpenAI({
  apiKey: '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', 
  // o process.env.OPENAI_API_KEY si no usas Vite
});

export const MainGPT = async (prompt) => {
  try {
    const response = await client.responses.create({
      model: "gpt-5.2",
      input: prompt,
    });

    return response.output_text;
  } catch (error) {
    console.error("Error en MainGPT:", error);
    return "Error al generar la respuesta";
  }
};

MainGPT('Cuentame un dato curioso.')

