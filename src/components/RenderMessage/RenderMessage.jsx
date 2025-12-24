import { useMemo, useState } from "react";
import "./renderMessage.css";

const RenderMessage = ({ tokens }) => {
  const normalized = useMemo(() => {
    if (!Array.isArray(tokens)) return [];

    const result = [];
    let currentParagraph = [];

    tokens.forEach((t) => {
      // Si el contenido es nulo o indefinido, lo saltamos
      if (t.content === null || t.content === undefined) return;

      // Agrupamos elementos inline (texto, negrita, etc.)
      if (["text", "bold", "italic", "inlineCode"].includes(t.type)) {
        currentParagraph.push(t);
      } else {
        // Cerramos párrafo previo si existe
        if (currentParagraph.length > 0) {
          // Solo guardamos el párrafo si tiene texto real (no solo saltos de línea)
          if (currentParagraph.some(item => String(item.content).trim().length > 0)) {
            result.push({ type: "paragraph", content: [...currentParagraph] });
          }
          currentParagraph = [];
        }
        result.push(t);
      }
    });

    if (currentParagraph.length > 0) {
      if (currentParagraph.some(item => String(item.content).trim().length > 0)) {
        result.push({ type: "paragraph", content: currentParagraph });
      }
    }

    return result;
  }, [tokens]);

  return (
    <div className="rm-container">
      {normalized.map((t, i) => {
        switch (t.type) {
          case "paragraph":
            return (
              <p key={i} className="rm-paragraph">
                {t.content.map((child, j) => (
                  <TokenRenderer key={j} token={child} />
                ))}
              </p>
            );

          case "heading":
            const Tag = `h${t.level || 3}`;
            return <Tag key={i} className="rm-heading">{t.content}</Tag>;

          case "code":
            // Renderiza el bloque de código (el que viste que fallaba)
            return <CodeBlock key={i} content={t.content} language={t.language} />;

          default:
            return null;
        }
      })}
    </div>
  );
};

const TokenRenderer = ({ token }) => {
  // IMPORTANTE: Renderizamos el contenido tal cual para no perder espacios
  switch (token.type) {
    case "text":
      return <span className="rm-text-span">{token.content}</span>;
    case "bold":
      return <strong className="rm-bold">{token.content}</strong>;
    case "italic":
      return <em className="rm-italic">{token.content}</em>;
    case "inlineCode":
      return <code className="rm-inline-code">{token.content}</code>;
    default:
      return null;
  }
};

const CodeBlock = ({ content, language }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="code-wrapper-gpt">
      <div className="code-header">
        <span className="code-lang">{language || "code"}</span>
        <button className="copy-btn-gpt" onClick={copy}>
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <pre className="code-block">
        <code>{content}</code>
      </pre>
    </div>
  );
};

export default RenderMessage;