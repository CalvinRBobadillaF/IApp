import { memo, useContext, useEffect, useRef, useState } from "react";
import { Context } from "../../Context/Context";
import { assets } from "../../assets/assets";
import Modal from "../Modal/Modal";
import RenderMessage, { UserMessage } from "../RenderMessage/RenderMessage";
import Icon from "./Icon";
import "./Chat.css";

const PROVIDERS = {
  Gemini: { name: "Gemini", icon: assets.gemini_icon },
  GPT: { name: "ChatGPT", icon: assets.chatgpt_icon },
  Claude: { name: "Claude", icon: assets.claude_icon },
};
const ACCEPTED_FILES = ".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.csv,.json,.html,.htm,.css,.js,.jsx,.ts,.tsx,.py,.xml,.yaml,.yml,.sql,.sh,.log,.c,.cpp,.h,.java,.go,.rs,.rb";
const SUGGESTIONS = [
  { icon: "file", title: "Understand a document", detail: "Attach a file and find what matters.", prompt: "Review the attached file. Summarize the key points and highlight anything I should double-check." },
  { icon: "code", title: "Work through some code", detail: "Explain, debug, or build something.", prompt: "Help me review this code for bugs and explain how to improve it:\n\n```\n\n```" },
  { icon: "chat", title: "Think it through", detail: "Turn an idea into a practical plan.", prompt: "Help me turn my idea into a practical plan. Start by asking me what I want to achieve." },
];

function displayName() {
  try {
    const stored = localStorage.getItem("User");
    if (!stored) return "there";
    try { return String(JSON.parse(stored)); } catch { return stored; }
  } catch { return "there"; }
}

function fileSize(size) {
  if (!size) return "";
  return size >= 1024 * 1024 ? `${(size / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(size / 1024)} KB`;
}

const ChatMessage = memo(function ChatMessage({ message, provider }) {
  const isUser = message.role === "user";
  return (
    <article className={`chat-message ${isUser ? "chat-message-user" : "chat-message-assistant"}`}>
      <img className="chat-avatar" src={isUser ? assets.user_icon : PROVIDERS[provider].icon} alt="" />
      <div className="chat-message-body">
        <div className="chat-message-author">{isUser ? "You" : PROVIDERS[provider].name}{message.mode === "image" && <span>Image creation</span>}</div>
        {isUser ? <UserMessage text={message.text || ""} /> : <RenderMessage text={message.text} tokens={message.tokens} images={message.images} />}
        {isUser && message.attachments?.length > 0 && (
          <ul className="chat-files chat-sent-files" aria-label="Attached files">
            {message.attachments.map((file, index) => <li className="chat-file" key={file.id || `${file.name}-${index}`}><Icon name="file" /><span title={file.name}>{file.name}</span></li>)}
          </ul>
        )}
      </div>
    </article>
  );
});

export default function Chat({ provider }) {
  const {
    currentChat, currentChatId, onSent, userPrompt, setUserPrompt, loading, cancelRequest,
    error, dismissError, attachments = [], addAttachments, removeAttachment, attachmentError,
    attachmentsLoading, mode = "chat", setMode, setModelFeature, selectedModels = {},
    modelCatalog = {}, privacyMode, openModal, setOpenModal, openSidebar, setOpenSidebar,
    storageWarning, contextNotice, saveHistory,
  } = useContext(Context);
  const [user] = useState(displayName);
  const [dragging, setDragging] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const followScroll = useRef(true);
  const config = PROVIDERS[provider];
  const catalog = modelCatalog[provider] || modelCatalog[provider.toLowerCase()];
  const selectedModel = selectedModels[provider] || catalog?.default_model;
  const modelLabel = catalog?.models?.find((model) => model.value === selectedModel)?.label || selectedModel || "Loading models…";
  const canCreateImages = provider !== "Claude" && Boolean(catalog?.image_model);
  const isImageMode = mode === "image";
  const canSend = !loading && !attachmentsLoading && (userPrompt.trim().length > 0 || (!isImageMode && attachments.length > 0));
  const canAttach = !loading && !attachmentsLoading && !isImageMode;
  const messages = currentChat?.messages || [];

  useEffect(() => {
    followScroll.current = true;
    const viewport = scrollRef.current;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [currentChatId]);

  useEffect(() => {
    const viewport = scrollRef.current;
    if (viewport && (followScroll.current || messages.at(-1)?.role === "user")) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    const input = inputRef.current;
    if (input) {
      input.style.height = "auto";
      input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
    }
  }, [userPrompt]);

  const submit = (event) => {
    event?.preventDefault();
    if (canSend) {
      followScroll.current = true;
      onSent();
    }
  };

  const chooseSuggestion = (prompt) => {
    setUserPrompt(prompt);
    inputRef.current?.focus();
  };

  const handleDrop = (event) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    setDragging(false);
    if (canAttach && event.dataTransfer.files.length) addAttachments(event.dataTransfer.files);
  };

  return (
    <main className={`iapp-chat iapp-chat-${provider.toLowerCase()}`}>
      <header className="chat-header">
        <div className="chat-header-left">
          <button type="button" className="chat-icon-button chat-mobile-menu" aria-label="Toggle chat history" aria-expanded={openSidebar} onClick={() => setOpenSidebar(!openSidebar)}><Icon name="menu" /></button>
          <img className="chat-provider-icon" src={config.icon} alt="" />
          <div className="chat-provider-picker">
            <label className="chat-sr-only" htmlFor="chat-provider">AI provider</label>
            <select id="chat-provider" value={provider} disabled={loading || attachmentsLoading} onChange={(event) => setModelFeature(event.target.value)}>
              <option value="Gemini">Gemini</option><option value="GPT">ChatGPT</option><option value="Claude">Claude</option>
            </select>
            <button type="button" className="chat-model-label" onClick={() => setOpenModal(true)} title="Choose model in settings">{isImageMode ? catalog?.image_model : modelLabel}</button>
          </div>
        </div>
        <div className="chat-header-actions">
          <button type="button" className={`chat-context-pill ${privacyMode ? "is-private" : ""}`} onClick={() => setOpenModal(true)}><Icon name={privacyMode ? "lock" : "chat"} /><span>{privacyMode ? "Private session" : "Context on"}</span></button>
          <button type="button" className="chat-icon-button" onClick={() => setOpenModal(true)} aria-label="Open settings" title="Settings"><Icon name="settings" /></button>
        </div>
      </header>

      <div className="chat-scroll" ref={scrollRef} onScroll={(event) => { const element = event.currentTarget; followScroll.current = element.scrollHeight - element.scrollTop - element.clientHeight < 100; }}>
        <div className="chat-content">
          {messages.length === 0 ? (
            <section className="chat-welcome">
              <div className="chat-eyebrow">YOUR AI WORKSPACE</div>
              <h1>Hello, <span>{user}.</span><br />What are we working on?</h1>
              <p>Bring a question, a document, or an idea. Let’s make sense of it together.</p>
              <div className="chat-suggestions">
                {SUGGESTIONS.map((suggestion) => <button key={suggestion.title} type="button" disabled={loading} onClick={() => chooseSuggestion(suggestion.prompt)}><Icon name={suggestion.icon} /><strong>{suggestion.title}</strong><span>{suggestion.detail}</span><Icon name="arrow" className="chat-suggestion-arrow" /></button>)}
              </div>
              {privacyMode && <div className="chat-private-intro"><Icon name="lock" /><p>Private session: each request stands alone. Messages stay in memory for this session and are not saved to this browser. Your provider still processes the request.</p></div>}
            </section>
          ) : <div className="chat-transcript" aria-label="Conversation">
            {messages.map((message, index) => <ChatMessage key={message.id || `${currentChatId}-${index}`} message={message} provider={provider} />)}
            {loading && <div className="chat-thinking" role="status"><span className="chat-thinking-dot" />{isImageMode ? "Creating your image…" : "Working on your request…"}<span>You can stop this request below.</span></div>}
          </div>}
        </div>
      </div>

      <div className="chat-composer-wrap">
        {storageWarning && <p className="chat-notice" role="status">{storageWarning}</p>}
        {contextNotice && <p className="chat-notice" role="status">{contextNotice}</p>}
        {error && <div className="chat-error" role="alert"><p>{typeof error === "string" ? error : error.message}</p><button type="button" className="chat-icon-button" onClick={dismissError} aria-label="Dismiss error"><Icon name="close" /></button></div>}
        <form className={`chat-composer ${dragging ? "is-dragging" : ""}`} onSubmit={submit} onDrop={handleDrop} onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); event.dataTransfer.dropEffect = canAttach ? "copy" : "none"; setDragging(canAttach); } }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}>
          <div className="chat-mode-bar" aria-label="Request type">
            <button type="button" className={mode === "chat" ? "active" : ""} aria-pressed={mode === "chat"} disabled={loading || attachmentsLoading} onClick={() => setMode("chat")}><Icon name="chat" />Chat</button>
            <button type="button" className={isImageMode ? "active" : ""} aria-pressed={isImageMode} disabled={!canCreateImages || loading || attachmentsLoading} title={canCreateImages ? "Generate a new image from a text description" : "Image generation is available with supported Gemini and GPT models"} onClick={() => setMode("image")}><Icon name="image" />Create image</button>
            {provider === "Claude" && <span className="chat-mode-hint">Claude can analyze images; use GPT or Gemini to create them.</span>}
          </div>
          {isImageMode && <p className="chat-composer-note">Describe a new image to create. Attachments and image editing are not supported in this mode.</p>}
          {attachments.length > 0 && <ul className="chat-files" aria-label="Files ready to send">{attachments.map((file) => <li key={file.id} className="chat-file"><Icon name="file" /><span title={file.name}>{file.name}<small>{fileSize(file.size)}</small></span><button type="button" onClick={() => removeAttachment(file.id)} disabled={loading || attachmentsLoading} aria-label={`Remove ${file.name}`}><Icon name="close" /></button></li>)}</ul>}
          {attachmentError && <p className="chat-attachment-error" role="alert">{attachmentError}</p>}
          <label htmlFor="chat-prompt" className="chat-sr-only">{isImageMode ? "Describe the image to create" : `Message ${config.name}`}</label>
          <textarea id="chat-prompt" ref={inputRef} rows={2} value={userPrompt} maxLength={60000} placeholder={isImageMode ? "Describe the image you want to create…" : `Message ${config.name}, or drop a file here…`} onChange={(event) => setUserPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) submit(event); }} />
          <div className="chat-composer-actions">
            <div className="chat-attachment-control">
              <input type="file" multiple accept={ACCEPTED_FILES} ref={fileRef} className="chat-file-input" disabled={!canAttach} onChange={(event) => { if (event.target.files?.length) addAttachments(event.target.files); event.target.value = ""; }} />
              <button type="button" className="chat-icon-button" disabled={!canAttach} onClick={() => fileRef.current?.click()} aria-label="Attach files" title="Attach PDF, image, text, CSV, or code files"><Icon name="attach" /></button>
              <span className="chat-file-help">{attachmentsLoading ? "Reading files…" : isImageMode ? "Text to image" : "PDF, images & text · 4 files · 5 MB each / 12 MB total"}</span>
            </div>
            {loading ? <button type="button" className="chat-stop-button" onClick={cancelRequest}><span aria-hidden="true">■</span> Stop</button> : <button type="submit" className="chat-send-button" disabled={!canSend} aria-label={isImageMode ? "Create image" : "Send message"}><Icon name="send" /></button>}
          </div>
        </form>
        <p className="chat-footer-note">{privacyMode ? "Private: no conversation context or saved history. Provider retention still applies." : `${saveHistory === false ? "History is not saved to this browser. " : ""}Recent messages provide context. File contents remain in memory until you reload.`} <span>Check important information.</span></p>
      </div>
      {openModal && <Modal />}
    </main>
  );
}
