const imageMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const maxImageBase64Length = 28 * 1024 * 1024;

// Restrict generated images to actual raster image bytes. Never accept a URL,
// SVG, HTML, or an arbitrary data URL returned in model-generated text.
export function generatedImageDataUrl(image) {
  if (!image || !imageMimeTypes.has(image.mime_type) || typeof image.data !== "string") return null;
  const data = image.data;
  if (!data || data.length > maxImageBase64Length || data.length % 4 !== 0
    || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return null;
  try {
    const header = atob(data.slice(0, 32));
    const validHeader = image.mime_type === "image/png" ? header.startsWith("\x89PNG\r\n\x1a\n")
      : image.mime_type === "image/jpeg" ? header.startsWith("\xff\xd8\xff")
        : header.startsWith("RIFF") && header.slice(8, 12) === "WEBP";
    return validHeader ? `data:${image.mime_type};base64,${data}` : null;
  } catch {
    return null;
  }
}

function backtickFence(content, minimum) {
  const runs = content.match(/`+/g) || [];
  return "`".repeat(runs.reduce((longest, run) => Math.max(longest, run.length + 1), minimum));
}

function inlineCode(content) {
  const fence = backtickFence(content, 1);
  const padding = /^[` ]|[` ]$/.test(content) ? " " : "";
  return `${fence}${padding}${content}${padding}${fence}`;
}

// Read old local chat history without re-parsing new responses into lossy
// tokens. Numbered lists already flattened by the old parser cannot be
// recovered, but code languages, inline formatting and content are preserved.
export function legacyTokensToText(tokens) {
  if (typeof tokens === "string") return tokens;
  if (!Array.isArray(tokens)) return "";
  const blocks = [];
  let paragraph = "";
  let list = [];
  const flushParagraph = () => {
    if (paragraph.trim()) blocks.push(paragraph.trimEnd());
    paragraph = "";
  };
  const flushList = () => {
    if (list.length) blocks.push(list.join("\n"));
    list = [];
  };

  for (const token of tokens) {
    if (!token || typeof token !== "object") continue;
    const content = typeof token.content === "string" ? token.content : "";
    if (["text", "rawText", "bold", "italic", "inlineCode"].includes(token.type)) {
      flushList();
      paragraph += token.type === "bold" ? `**${content}**`
        : token.type === "italic" ? `*${content}*`
          : token.type === "inlineCode" ? inlineCode(content) : content;
      continue;
    }
    flushParagraph();
    if (token.type === "listItem") {
      const marker = token.ordered ? `${list.length + 1}.` : "-";
      list.push(`${marker} ${content}`);
      continue;
    }
    flushList();
    if (token.type === "heading") {
      const level = Number.isInteger(token.level) ? Math.max(1, Math.min(6, token.level)) : 3;
      blocks.push(`${"#".repeat(level)} ${content}`);
    } else if (token.type === "code") {
      const fence = backtickFence(content, 3);
      const language = typeof token.language === "string" ? token.language.replace(/[^\w+#.-]/g, "") : "";
      blocks.push(`${fence}${language}\n${content}\n${fence}`);
    } else if (token.type === "image") {
      const description = typeof token.alt === "string" ? token.alt : content;
      blocks.push(`[Image description: ${description || "Image"}]`);
    } else if (token.type === "paragraph" && Array.isArray(token.content)) {
      blocks.push(legacyTokensToText(token.content));
    } else if (token.type === "list" && Array.isArray(token.items)) {
      blocks.push(legacyTokensToText(token.items.map((item) => ({ ...item, type: "listItem" }))));
    } else if (content) {
      blocks.push(content);
    }
  }
  flushParagraph();
  flushList();
  return blocks.join("\n\n");
}
