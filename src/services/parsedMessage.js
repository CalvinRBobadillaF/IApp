export const parsedMessage = (input = "") => {
  if (!input || typeof input !== "string") return [];

  let text = input.replace(/\r\n/g, "\n");

  /* ==========================================================
     2️⃣ BLOQUES DE CÓDIGO
     ========================================================== */
  const codeRegex = /```(\w*)\n?([\s\S]*?)```/g;
  const tokens = [];
  let lastIndex = 0;
  let match;

  while ((match = codeRegex.exec(text)) !== null) {
    const preText = text.slice(lastIndex, match.index);
    if (preText) tokens.push({ type: "text", content: preText });

    tokens.push({
      type: "code",
      language: match[1] || "code",
      content: match[2].trim(),
    });
    lastIndex = codeRegex.lastIndex;
  }
  if (lastIndex < text.length) tokens.push({ type: "text", content: text.slice(lastIndex) });

  /* ==========================================================
     3️ DETECCIÓN DE IMÁGENES 

[Image of X]

     ========================================================== */
  const tokensWithImages = [];
  

  const open = "\\" + String.fromCharCode(91); 
  const close = "\\" + String.fromCharCode(93);
  const imageRegex = new RegExp(open + "Image of (.*?)" + close, "g");

  tokens.forEach((token) => {
    if (token.type !== "text") {
      tokensWithImages.push(token);
      return;
    }

    let lastImgIndex = 0;
    let imgMatch;
    imageRegex.lastIndex = 0;

    while ((imgMatch = imageRegex.exec(token.content)) !== null) {
      if (imgMatch.index > lastImgIndex) {
        tokensWithImages.push({
          type: "text",
          content: token.content.slice(lastImgIndex, imgMatch.index),
        });
      }

      // ✅ PROTECCIÓN DE TRIM:
      // Usamos (imgMatch[1] || "") para asegurar que nunca sea undefined
      const imgPrompt = imgMatch[1] ? imgMatch[1].trim() : "";

      tokensWithImages.push({
        type: "image",
        content: imgPrompt,
        alt: imgPrompt
      });

      lastImgIndex = imageRegex.lastIndex;
    }

    if (lastImgIndex < token.content.length) {
      tokensWithImages.push({
        type: "text",
        content: token.content.slice(lastImgIndex),
      });
    }
  });

  /* ==========================================================
     4️⃣ PROCESAR TEXTO INTERNO (INLINE)
     ========================================================== */
  const finalTokens = [];
  const inlineRegex = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(^#{1,6}\s.+)/gm;

  tokensWithImages.forEach((token) => {
    if (token.type !== "text") {
      finalTokens.push(token);
      return;
    }

    let last = 0;
    let m;
    inlineRegex.lastIndex = 0;

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
      finalTokens.push({ type: "text", content: token.content.slice(last) });
    }
  });

  return finalTokens;
};