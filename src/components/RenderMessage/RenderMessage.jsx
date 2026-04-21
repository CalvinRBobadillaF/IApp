import { useMemo, useState, useEffect } from "react";
import "./renderMessage.css";

/* ============================================================
   USER MESSAGE — formateo básico para mensajes del usuario
   Detecta `código inline` y saltos de línea
============================================================ */
export const UserMessage = ({ text }) => {
  if (!text) return null;

  // Dividir por saltos de línea preservando estructura
  const lines = text.split("\n");

  return (
    <div className="user-msg-content">
      {lines.map((line, i) => {
        // Detectar `código inline`
        const parts = line.split(/(`[^`]+`)/g);
        return (
          <span key={i} className="user-msg-line">
            {parts.map((part, j) => {
              if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
                return (
                  <code key={j} className="user-inline-code">
                    {part.slice(1, -1)}
                  </code>
                );
              }
              return <span key={j}>{part}</span>;
            })}
            {i < lines.length - 1 && <br />}
          </span>
        );
      })}
    </div>
  );
};

/* ============================================================
   AI MESSAGE RENDERER
============================================================ */
const RenderMessage = ({ tokens }) => {
  const normalized = useMemo(() => {
    if (!Array.isArray(tokens)) return [];
    const result = [];
    let currentParagraph = [];
    let currentList = [];

    const flushParagraph = () => {
      if (currentParagraph.length > 0) {
        result.push({ type: "paragraph", content: [...currentParagraph] });
        currentParagraph = [];
      }
    };

    const flushList = () => {
      if (currentList.length > 0) {
        result.push({ type: "list", items: [...currentList] });
        currentList = [];
      }
    };

    tokens.forEach((t) => {
      if (!t.content && t.type !== "image") return;

      if (["text", "bold", "italic", "inlineCode"].includes(t.type)) {
        flushList();
        currentParagraph.push(t);
      } else if (t.type === "listItem") {
        flushParagraph();
        currentList.push(t);
      } else {
        flushParagraph();
        flushList();
        result.push(t);
      }
    });

    flushParagraph();
    flushList();
    return result;
  }, [tokens]);

  return (
    <div className="rm-container">
      {normalized.map((t, i) => {
        switch (t.type) {
          case "paragraph":
            return (
              <p key={i} className="rm-paragraph">
                {t.content.map((child, j) => <TokenRenderer key={j} token={child} />)}
              </p>
            );

          case "heading":
            const Tag = `h${t.level || 3}`;
            return (
              <Tag key={i} className={`rm-heading rm-h${t.level || 3}`}>
                {t.content}
              </Tag>
            );

          case "list":
            return (
              <ul key={i} className="rm-list">
                {t.items.map((item, j) => (
                  <li key={j} className="rm-list-item">{item.content}</li>
                ))}
              </ul>
            );

          case "code":
            return <CodeBlock key={i} content={t.content} language={t.language} />;

          case "image":
            return <ImageRenderer key={i} prompt={t.content} alt={t.alt} />;

          default:
            return null;
        }
      })}
    </div>
  );
};

/* ── Inline token renderer ── */
const TokenRenderer = ({ token }) => {
  switch (token.type) {
    case "text":       return <span className="rm-text-span">{token.content}</span>;
    case "bold":       return <strong className="rm-bold">{token.content}</strong>;
    case "italic":     return <em className="rm-italic">{token.content}</em>;
    case "inlineCode": return <code className="rm-inline-code">{token.content}</code>;
    default:           return null;
  }
};

/* ── CodeBlock con animación de entrada ── */
const CodeBlock = ({ content, language }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = content;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="code-wrapper-gpt">
      <div className="code-header">
        <div className="code-header-left">
          <span className="code-dot red" />
          <span className="code-dot yellow" />
          <span className="code-dot green" />
          <span className="code-lang">{language || "code"}</span>
        </div>
        <button className={`copy-btn-gpt ${copied ? "copied" : ""}`} onClick={copy}>
          {copied ? "✓ Copied!" : "Copy"}
        </button>
      </div>
      <pre className="code-block">
        <code>{content}</code>
      </pre>
    </div>
  );
};

/* ── Image renderer ── */
const stringToSeed = (str) => {
  let hash = 0;
  if (!str) return 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 10_000_000;
};

const ImageRenderer = ({ prompt, alt }) => {
  const cleanPrompt = prompt?.trim() || "abstract art";
  const seed = useMemo(() => stringToSeed(cleanPrompt), [cleanPrompt]);
  const safePrompt = encodeURIComponent(cleanPrompt);
  const [imgSrc, setImgSrc] = useState(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setImgSrc(
      `https://gen.pollinations.ai/image/${safePrompt}?width=1024&height=1024&nologo=true&model=flux&seed=${seed}&key=pk_ASNnKAZ2SQ7YTZtX`
    );
    setHasError(false);
  }, [safePrompt, seed]);

  const handleError = () => {
    if (hasError) return;
    setHasError(true);
    setImgSrc(
      `https://gen.pollinations.ai/image/${safePrompt}?width=1024&height=1024&nologo=true&model=turbo&seed=${seed}`
    );
  };

  if (!imgSrc) return null;

  return (
    <div className="rm-image-container">
      <figure className="rm-image-figure">
        <img src={imgSrc} alt={alt || "Generating..."} className="rm-image"
          loading="lazy" onError={handleError} />
        <figcaption className="rm-image-caption">
          {cleanPrompt}{hasError ? " (Turbo mode)" : ""}
        </figcaption>
      </figure>
    </div>
  );
};

export default RenderMessage;