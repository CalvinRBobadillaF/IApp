import { useMemo, useState, useEffect } from "react";
import "./renderMessage.css";

const RenderMessage = ({ tokens }) => {
  const normalized = useMemo(() => {
    if (!Array.isArray(tokens)) return [];
    const result = [];
    let currentParagraph = [];

    tokens.forEach((t) => {
      if (!t.content && t.type !== "image") return;

      if (["text", "bold", "italic", "inlineCode"].includes(t.type)) {
        currentParagraph.push(t);
      } else {
        if (currentParagraph.length > 0) {
          result.push({ type: "paragraph", content: [...currentParagraph] });
          currentParagraph = [];
        }
        result.push(t);
      }
    });

    if (currentParagraph.length > 0) {
      result.push({ type: "paragraph", content: currentParagraph });
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
                {t.content.map((child, j) => <TokenRenderer key={j} token={child} />)}
              </p>
            );
          case "heading":
            const Tag = `h${t.level || 3}`;
            return <Tag key={i} className="rm-heading">{t.content}</Tag>;
          
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

/* --- SUBCOMPONENTES --- */

const TokenRenderer = ({ token }) => {
  switch (token.type) {
    case "text": return <span className="rm-text-span">{token.content}</span>;
    case "bold": return <strong className="rm-bold">{token.content}</strong>;
    case "italic": return <em className="rm-italic">{token.content}</em>;
    case "inlineCode": return <code className="rm-inline-code">{token.content}</code>;
    default: return null;
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
        <button className="copy-btn-gpt" onClick={copy}>{copied ? "Copied ✓" : "Copy"}</button>
      </div>
      <pre className="code-block"><code>{content}</code></pre>
    </div>
  );
};

/* --- FUNCIÓN AUXILIAR PARA GENERAR SEMILLA FIJA --- */
const stringToSeed = (str) => {
  let hash = 0;
  if (!str) return 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; 
  }
  // Mantenemos el número positivo y manejable
  return Math.abs(hash) % 10000000; 
};

/* --- RENDERIZADOR DE IMAGEN MEJORADO --- */
const ImageRenderer = ({ prompt, alt }) => {
  const [imgSrc, setImgSrc] = useState(null);
  const [hasError, setHasError] = useState(false);

  // 1. Limpieza y generación de Semilla
  const cleanPrompt = prompt ? prompt.trim() : "abstract art";
  const seed = useMemo(() => stringToSeed(cleanPrompt), [cleanPrompt]);
  const safePrompt = encodeURIComponent(cleanPrompt);
  const apiKey = "pk_ASNnKAZ2SQ7YTZtX"; 

  // 2. Establecer URL inicial (Flux) al montar o cambiar el prompt
  useEffect(() => {
    const fluxUrl = `https://gen.pollinations.ai/image/${safePrompt}?width=1024&height=1024&nologo=true&model=flux&seed=${seed}&key=${apiKey}`;
    setImgSrc(fluxUrl);
    setHasError(false);
  }, [safePrompt, seed]);

  // 3. Manejador de errores (Fallback a Turbo)
  const handleError = () => {
    if (hasError) return; // Evitar bucle infinito si Turbo también falla
    
    console.warn("Flux falló (posible límite de API), cambiando a Turbo...");
    setHasError(true);

    // URL de respaldo: Modelo Turbo, SIN KEY (para evitar límites), misma semilla
    const turboUrl = `https://gen.pollinations.ai/image/${safePrompt}?width=1024&height=1024&nologo=true&model=turbo&seed=${seed}`;
    setImgSrc(turboUrl);
  };

  if (!imgSrc) return null;

  return (
    <div className="rm-image-container">
      <figure className="rm-image-figure">
        <img 
          src={imgSrc} 
          alt={alt || "Generando imagen..."} 
          className="rm-image" 
          loading="lazy"
          onError={handleError}
        />
        <figcaption className="rm-image-caption">
           Generado: {cleanPrompt} {hasError && "(Modo Turbo)"}
        </figcaption>
      </figure>
    </div>
  );
};

export default RenderMessage;