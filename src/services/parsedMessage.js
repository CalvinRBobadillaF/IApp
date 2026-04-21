export const parsedMessage = (input = "") => {
  if (!input || typeof input !== "string") return [];

  const text = input.replace(/\r\n/g, "\n");
  const tokens = [];

  // ── 1. DIVIDIR POR BLOQUES DE CÓDIGO (tienen prioridad absoluta) ──
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      processText(text.slice(lastIndex, match.index), tokens);
    }
    tokens.push({
      type: "code",
      language: match[1] || "code",
      content: match[2].trimEnd(),
    });
    lastIndex = codeBlockRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    processText(text.slice(lastIndex), tokens);
  }

  return tokens;
};

/* ── 2. PROCESAR TEXTO: imágenes → bloques de línea → inline ── */
function processText(text, tokens) {
  const imageRegex = /\[Image of (.*?)\]/g;
  let last = 0;
  let m;
  const parts = [];

  while ((m = imageRegex.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: "rawText", content: text.slice(last, m.index) });
    const prompt = m[1] ? m[1].trim() : "";
    parts.push({ type: "image", content: prompt, alt: prompt });
    last = imageRegex.lastIndex;
  }
  if (last < text.length) parts.push({ type: "rawText", content: text.slice(last) });

  for (const part of parts) {
    if (part.type !== "rawText") { tokens.push(part); continue; }
    processLines(part.content, tokens);
  }
}

/* ── 3. PROCESAR LÍNEA A LÍNEA (headings, listas) ── */
function processLines(text, tokens) {
  const lines = text.split("\n");
  let pendingText = "";

  const flushPending = () => {
    if (pendingText.trim()) parseInline(pendingText, tokens);
    pendingText = "";
  };

  for (const line of lines) {
    // Heading: ## Título
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      flushPending();
      tokens.push({
        type: "heading",
        level: headingMatch[1].length,
        content: headingMatch[2].trim(),
      });
      continue;
    }

    // Lista con viñeta: - item  |  * item
    const bulletMatch = line.match(/^\s*[-*]\s+(.+)/);
    if (bulletMatch) {
      flushPending();
      tokens.push({ type: "listItem", content: bulletMatch[1].trim() });
      continue;
    }

    // Lista numerada: 1. item
    const numberedMatch = line.match(/^\s*\d+\.\s+(.+)/);
    if (numberedMatch) {
      flushPending();
      tokens.push({ type: "listItem", content: numberedMatch[1].trim() });
      continue;
    }

    pendingText += line + "\n";
  }

  flushPending();
}

/* ── 4. PARSEO INLINE (bold, italic, inlineCode) ── */
function parseInline(text, tokens) {
  // Orden importa: inlineCode antes que bold/italic para evitar conflictos
  const inlineRegex = /(`[^`\n]+`)|(\*\*[\s\S]+?\*\*)|(\*[^*\n]+\*)/g;
  let last = 0;
  let m;

  while ((m = inlineRegex.exec(text)) !== null) {
    if (m.index > last) {
      const chunk = text.slice(last, m.index);
      if (chunk) tokens.push({ type: "text", content: chunk });
    }

    const value = m[0];
    if (value.startsWith("`")) {
      tokens.push({ type: "inlineCode", content: value.slice(1, -1) });
    } else if (value.startsWith("**")) {
      tokens.push({ type: "bold", content: value.slice(2, -2) });
    } else if (value.startsWith("*")) {
      tokens.push({ type: "italic", content: value.slice(1, -1) });
    }

    last = inlineRegex.lastIndex;
  }

  if (last < text.length) {
    const remaining = text.slice(last);
    if (remaining) tokens.push({ type: "text", content: remaining });
  }
}