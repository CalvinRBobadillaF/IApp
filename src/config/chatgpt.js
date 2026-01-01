import OpenAI from "openai";

// Recuperamos la configuración del usuario
const rawKey = localStorage.getItem("GPT Key");
const apiKey = rawKey?.replace(/["\\]/g, "");

const userModel = localStorage.getItem('ModelGPT');
// Si no hay modelo guardado, usamos gpt-3.5-turbo o gpt-4 por defecto
const model = userModel ? userModel.replace(/["\\]/g, "") : "gpt-5";

/* ==========================================================================
   SYSTEM PROMPT: EL CEREBRO DE LA OPERACIÓN
   Aquí le enseñamos a la IA cómo comportarse y cómo usar tu generador de imágenes.
   ========================================================================== */
const SYSTEM_PROMPT = `
Eres un asistente útil y creativo integrado en una aplicación React.

CAPACIDAD VISUAL:
Si el usuario te pide una imagen, foto o dibujo:
1. NO uses etiquetas XML como <Image> o <tag>.
2. NO uses bloques de código.
3. TU RESPUESTA DEBE SER EXACTAMENTE ASÍ:



Ejemplo correcto:
"Aquí tienes: 

[Image of a red car]
"

Ejemplo INCORRECTO:
"<Image>[a red car]</Image>" (ESTO ESTÁ PROHIBIDO)
`;

export const MainGPT = async (prompt) => {
  // Validación básica de seguridad
  if (!apiKey) {
    console.error("Falta la API Key de OpenAI");
    return "Error: No se encontró la API Key de OpenAI. Por favor configúrala.";
  }

  const client = new OpenAI({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true 
  });

  try {
    // Usamos el endpoint estándar de CHAT (chat.completions)
    const response = await client.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT }, // Inyectamos la instrucción
        { role: "user", content: prompt }
      ],
      temperature: 1, // Creatividad equilibrada
    });

    // Devolvemos solo el contenido del mensaje
    return response.choices[0].message.content;

  } catch (error) {
    console.error("Error en MainGPT:", error);
    
    // Manejo de errores comunes
    if (error.status === 401) return "Error: API Key inválida.";
    if (error.status === 429) return "Error: Has excedido tu cuota de OpenAI.";
    
    return "Ocurrió un error al conectar con OpenAI.";
  }
};