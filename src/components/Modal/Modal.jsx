import { useContext, useEffect, useId, useRef } from "react";
import { Context } from "../../Context/context.js";
import Icon from "../Chat/Icon";
import "./Modal.css";

export default function Modal() {
  const {
    setOpenModal, modelFeature, selectedModels = {}, modelCatalog = {}, setSelectedModel,
    privacyMode, setPrivacyMode, saveHistory, setSaveHistory, instructions = "", setInstructions,
    clearHistory, loading, attachmentsLoading, storageWarning,
  } = useContext(Context);
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const labelId = useId();
  const descriptionId = useId();
  const privacyId = useId();
  const historyId = useId();
  const modelId = useId();
  const instructionsId = useId();
  const catalog = modelCatalog[modelFeature] || modelCatalog[modelFeature?.toLowerCase()];
  const selected = selectedModels[modelFeature] || catalog?.default_model || "";
  const busy = loading || attachmentsLoading;

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpenModal(false);
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]') || [])
        .filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [setOpenModal]);

  return (
    <div className="iapp-settings-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpenModal(false); }}>
      <section className="iapp-settings" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={labelId} aria-describedby={descriptionId}>
        <header className="settings-header">
          <div><div className="settings-eyebrow">MAKE IT YOURS</div><h2 id={labelId}>Settings</h2></div>
          <button ref={closeRef} type="button" className="settings-close" onClick={() => setOpenModal(false)} aria-label="Close settings"><Icon name="close" /></button>
        </header>
        <p id={descriptionId} className="settings-intro">Choose how your conversations work. Changes apply immediately.</p>

        <section className="settings-section">
          <label htmlFor={modelId} className="settings-label">{modelFeature === "GPT" ? "ChatGPT" : modelFeature} chat model</label>
          <select id={modelId} value={selected} disabled={busy || !catalog?.models?.length} onChange={(event) => setSelectedModel(modelFeature, event.target.value)}>
            {!catalog?.models?.length && <option value="">Loading available models…</option>}
            {catalog?.models?.map(({ value, label }) => <option value={value} key={value}>{label}</option>)}
          </select>
          <p className="settings-help">{catalog?.image_model ? "Create image mode uses the provider’s separate image model." : "Claude supports image analysis. Choose Gemini or ChatGPT for image creation."}</p>
        </section>

        <section className="settings-section">
          <div className="settings-toggle-row">
            <div><label htmlFor={privacyId} className="settings-label"><Icon name="lock" />Privacy mode</label><p className="settings-help">Send only your current message and its attachments.</p></div>
            <input id={privacyId} className="settings-switch" type="checkbox" role="switch" checked={Boolean(privacyMode)} disabled={busy} onChange={(event) => setPrivacyMode(event.target.checked)} />
          </div>
          <div className={`settings-privacy-info ${privacyMode ? "is-enabled" : ""}`}>
            <p>{privacyMode ? "On: previous messages and custom instructions are excluded. Private messages are kept in memory only and are never saved to browser history." : "Off: recent messages, available attachments, and your custom instructions provide context for replies."}</p>
            <p>Changing privacy mode starts a fresh chat and discards the private session. Earlier saved chats are not deleted.</p>
          </div>
          <p className="settings-retention">Your provider still processes your request; retention depends on the provider and your account. This is not zero data retention.</p>
        </section>

        <section className="settings-section">
          <div className="settings-toggle-row">
            <div><label htmlFor={historyId} className="settings-label">Save chat history on this device</label><p className="settings-help">{privacyMode ? "Private chats are never saved. Your history preference for regular chats is preserved." : "Turning this off removes saved chats from this browser. They remain available in memory until you reload."}</p></div>
            <input id={historyId} className="settings-switch" type="checkbox" role="switch" checked={!privacyMode && Boolean(saveHistory)} disabled={busy || privacyMode} onChange={(event) => setSaveHistory(event.target.checked)} />
          </div>
          <p className="settings-help">Attachments and generated images are not saved to browser storage. Download any generated images you want to keep.</p>
        </section>

        <section className="settings-section">
          <label htmlFor={instructionsId} className="settings-label">Custom instructions</label>
          <p className="settings-help" id={`${instructionsId}-help`}>Share useful background, a preferred language, or how you like answers. These instructions stay in memory until you reload and are excluded in privacy mode.</p>
          <textarea id={instructionsId} aria-describedby={`${instructionsId}-help`} rows={4} maxLength={4000} value={instructions} disabled={busy || privacyMode} onChange={(event) => setInstructions(event.target.value)} placeholder="For example: Explain in Spanish, be concise, and include practical examples." />
          <p className="settings-character-count">{instructions.length.toLocaleString()} / 4,000</p>
        </section>

        {storageWarning && <p className="settings-warning" role="status">{storageWarning}</p>}
        <footer className="settings-footer">
          <button type="button" className="settings-clear" disabled={busy} onClick={() => { if (window.confirm("Delete all IApp chats on this device, including the current session? This cannot be undone.")) clearHistory(); }}>Clear all chats</button>
          <button type="button" className="settings-done" onClick={() => setOpenModal(false)}>Done</button>
        </footer>
      </section>
    </div>
  );
}
