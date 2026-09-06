import { memo, useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { generatedImageDataUrl, legacyTokensToText } from "../../services/messageFormat";
import "./renderMessage.css";

function CodeBlock({ content, language }) {
  const [copyState, setCopyState] = useState("idle");
  const timeoutRef = useRef(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const copy = async () => {
    window.clearTimeout(timeoutRef.current);
    setCopyState("copying");
    let success = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
        success = true;
      }
    } catch {
      // Older browsers or denied clipboard permissions may still allow a
      // user-initiated copy from a selected textarea.
    }

    if (!mountedRef.current) return;
    if (!success) {
      const previousFocus = document.activeElement;
      const field = document.createElement("textarea");
      field.value = content;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      try {
        success = document.execCommand("copy") === true;
      } catch {
        success = false;
      } finally {
        field.remove();
        previousFocus?.focus?.({ preventScroll: true });
      }
    }

    setCopyState(success ? "copied" : "failed");
    timeoutRef.current = window.setTimeout(() => setCopyState("idle"), 2200);
  };

  const copyLabel = {
    idle: "Copy code",
    copying: "Copying…",
    copied: "Copied!",
    failed: "Copy failed",
  }[copyState];

  return (
    <div className="code-wrapper-gpt">
      <div className="code-header">
        <span className="code-lang">{language || "text"}</span>
        <button type="button" className={`copy-btn-gpt ${copyState}`}
          onClick={copy} disabled={copyState === "copying"} aria-live="polite">
          {copyLabel}
        </button>
      </div>
      <pre className="code-block" tabIndex={0} aria-label={`${language || "Text"} code block`}>
        <code>{content}</code>
      </pre>
    </div>
  );
}

function MarkdownPre({ node, children }) {
  const codeNode = node?.children?.find((child) => child.tagName === "code");
  if (!codeNode) return <pre className="code-block">{children}</pre>;
  const content = codeNode.children.map((child) => child.value || "").join("");
  const classes = codeNode.properties?.className || [];
  const language = classes.find((value) => value.startsWith("language-"))?.slice(9);
  return <CodeBlock content={content} language={language} />;
}

function MarkdownLink({ href, children, title }) {
  if (!href || !/^(https?:\/\/|mailto:|#)/i.test(href)) {
    return <span>{children}</span>;
  }
  return <a href={href} title={title} target={href.startsWith("#") ? undefined : "_blank"}
    rel="noopener noreferrer">{children}</a>;
}

function OmittedImage({ alt }) {
  // A model can return an arbitrary tracking URL in Markdown. Only native
  // image bytes returned by our backend are ever loaded automatically.
  return <span className="rm-image-omitted">[External image omitted{alt ? `: ${alt}` : ""}]</span>;
}

function MarkdownTable({ children }) {
  return <div className="rm-table-scroll" tabIndex={0} role="region" aria-label="Table">
    <table>{children}</table>
  </div>;
}

const markdownComponents = {
  pre: MarkdownPre,
  a: MarkdownLink,
  img: OmittedImage,
  table: MarkdownTable,
};
const markdownPlugins = [remarkGfm];

const MessageMarkdown = memo(function MessageMarkdown({ text }) {
  return <Markdown components={markdownComponents} remarkPlugins={markdownPlugins}>{text}</Markdown>;
});

export const UserMessage = memo(function UserMessage({ text }) {
  if (typeof text !== "string" || !text) return null;
  return <div className="user-msg-content rm-markdown"><MessageMarkdown text={text} /></div>;
});

const NativeImage = memo(function NativeImage({ image, index }) {
  const source = useMemo(() => generatedImageDataUrl(image), [image]);
  const [failedSource, setFailedSource] = useState(null);
  if (!source || source === failedSource) {
    return <p className="rm-image-error" role="status">This generated image could not be displayed.</p>;
  }

  const extension = image.mime_type === "image/jpeg" ? "jpg" : image.mime_type.split("/")[1];
  const alt = typeof image.alt === "string" && image.alt.trim() ? image.alt : `Generated image ${index + 1}`;
  return (
    <figure className="rm-image-figure">
      <img src={source} alt={alt} className="rm-image" loading="lazy" decoding="async"
        onError={() => setFailedSource(source)} />
      <figcaption className="rm-image-caption">
        <span>{alt}</span>
        <a href={source} download={`iapp-image-${index + 1}.${extension}`}>Download image</a>
      </figcaption>
    </figure>
  );
});

const RenderMessage = memo(function RenderMessage({ text, tokens, images }) {
  const markdown = useMemo(() => typeof text === "string" ? text : legacyTokensToText(tokens), [text, tokens]);
  return (
    <div className="rm-container rm-markdown">
      {markdown && <MessageMarkdown text={markdown} />}
      {Array.isArray(images) && images.length > 0 && <div className="rm-image-container">
        {images.map((image, index) => <NativeImage key={index} image={image} index={index} />)}
      </div>}
    </div>
  );
});

export default RenderMessage;
