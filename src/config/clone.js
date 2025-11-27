// gemini.js
// Nota: ahora el cliente llama a tu proxy server en /api/gemini/generate
// Asegúrate de tener el servidor/proxy implementado y corriendo.
// Mantengo la exportación default y la firma main(prompt) para que no tengas que cambiar otros archivos.

//const apiKey = import.meta.env.VITE_GEMINI_API_KEY; // ya no se usa en cliente — dejar por ahora evita romper imports

// Antes usábamos el SDK; ahora hacemos fetch al proxy server
// import { GoogleGenAI } from "@google/genai";

async function main(prompt) {
  try {
    // Normalizar prompt a string o array como lo espera el proxy
    const body = { prompt };

    const res = await fetch('/api/gemini/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      // intentar leer cuerpo de error para debug
      let errBody = {};
      try { errBody = await res.json(); } catch(e) { errBody = { message: await res.text().catch(()=>res.statusText) }; }
      console.error('Gemini proxy returned error', res.status, errBody);
      throw new Error(`Proxy error: ${res.status} ${JSON.stringify(errBody)}`);
    }

    const data = await res.json();

    // Intentamos extraer el texto principal de la respuesta de manera defensiva,
    // para mantener la compatibilidad con el antiguo comportamiento (retornar string).
    if (!data) return '';

    if (typeof data === 'string') return data;
    if (data.text && typeof data.text === 'string') return data.text;

    // Estructura tipo SDK: data.output[0].content -> buscar primer .text
    if (Array.isArray(data.output)) {
      for (const out of data.output) {
        if (out?.content && Array.isArray(out.content)) {
          const contentItem = out.content.find(c => typeof c?.text === 'string');
          if (contentItem) return contentItem.text;
        }
      }
    }

    // Otros formatos: buscar recursivamente la primer propiedad 'text'
    function findText(obj) {
      if (!obj || typeof obj !== 'object') return null;
      if (typeof obj.text === 'string') return obj.text;
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (typeof v === 'string' && k.toLowerCase().includes('text')) return v;
        if (typeof v === 'object') {
          const f = findText(v);
          if (f) return f;
        }
      }
      return null;
    }

    const found = findText(data);
    if (found) return found;

    // Fallback: stringify (útil en debugging; devuelve string para compatibilidad)
    return JSON.stringify(data);
  } catch (error) {
    console.error("Error generating content via proxy:", error);
    // Mantengo comportamiento previo (retornabas undefined si fallaba). Aquí lanzo error
    // para que el caller lo pueda capturar; si prefieres, puedes return undefined en lugar de throw.
    throw error;
  }
}

export default main;