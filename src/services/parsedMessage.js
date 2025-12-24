export const parsedMessage = (input = "") => {
  if (!input || typeof input !== "string") return [];

  // 1️⃣ NORMALIZACIÓN INICIAL
  // Corregimos saltos de línea y eliminamos espacios excesivos al inicio/final
  let text = input.replace(/\r\n/g, "\n");

  /* ==========================================================
      2️⃣ BLOQUES DE CÓDIGO ``` (Captura de Lenguaje)
     ========================================================== */
  // Regex mejorada para capturar el lenguaje: ```javascript
  const codeRegex = /```(\w*)\n?([\s\S]*?)```/g;
  const tokens = [];
  let lastIndex = 0;
  let match;

  while ((match = codeRegex.exec(text)) !== null) {
    const preText = text.slice(lastIndex, match.index);
    
    if (preText) {
      tokens.push({ type: "text", content: preText });
    }

    tokens.push({
      type: "code",
      language: match[1] || "code", // Captura "python", "js", etc.
      content: match[2].trim(),    // Contenido puro del código
    });

    lastIndex = codeRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: "text", content: text.slice(lastIndex) });
  }

  /* ==========================================================
      3️⃣ PROCESAR TEXTO INTERNO (INLINE)
     ========================================================== */
  const finalTokens = [];
  // Agregamos soporte para no romper espacios naturales
  const inlineRegex = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(^#{1,6}\s.+)/gm;

  tokens.forEach((token) => {
    if (token.type !== "text") {
      finalTokens.push(token);
      return;
    }

    let last = 0;
    let m;

    while ((m = inlineRegex.exec(token.content)) !== null) {
      if (m.index > last) {
        finalTokens.push({
          type: "text",
          content: token.content.slice(last, m.index),
        });
      }

      const value = m[0];

      if (value.startsWith("`")) {
        finalTokens.push({ type: "inlineCode", content: value.slice(1, -1) });
      } 
      else if (value.startsWith("**")) {
        finalTokens.push({ type: "bold", content: value.slice(2, -2) });
      } 
      else if (value.startsWith("*")) {
        finalTokens.push({ type: "italic", content: value.slice(1, -1) });
      } 
      else if (value.startsWith("#")) {
        const level = value.match(/^#+/)[0].length;
        finalTokens.push({
          type: "heading",
          level,
          content: value.replace(/^#+\s*/, "").trim(),
        });
      }

      last = inlineRegex.lastIndex;
    }

    if (last < token.content.length) {
      finalTokens.push({
        type: "text",
        content: token.content.slice(last),
      });
    }
  });

  return finalTokens;
};