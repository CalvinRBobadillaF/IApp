import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Icon from '../../components/Chat/Icon.jsx';
import { LANGUAGES } from './languages.js';
import { sentenceSearchDraft, splitTranslationSentences } from './sentenceSearch.js';

export default function SentenceSearch({ translation, language, provider, privacyMode, busy, onClose, onPrepare }) {
  const sentences = useMemo(() => splitTranslationSentences(translation, language), [translation, language]);
  const [selection, setSelection] = useState('0');
  const [question, setQuestion] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const copyVersion = useRef(0);
  const titleId = useId();
  const helpId = useId();
  const selectedText = selection === 'all' ? translation : sentences[Number(selection)] || '';

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const handleKeyDown = event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialogRef.current?.querySelectorAll('button:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []);
      const first = controls[0], last = controls.at(-1);
      const outside = !dialogRef.current?.contains(document.activeElement);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (outside || document.activeElement === first)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (outside || document.activeElement === last)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      copyVersion.current++;
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [onClose]);

  const copyText = async () => {
    const version = ++copyVersion.current;
    setError('');
    setCopied(false);
    try {
      await navigator.clipboard.writeText(selectedText);
      if (version === copyVersion.current) setCopied(true);
    } catch {
      if (version === copyVersion.current) setError('Clipboard access is unavailable. Select and copy the preview text manually.');
    }
  };
  const prepare = event => {
    event.preventDefault();
    if (busy) return;
    try {
      const draft = sentenceSearchDraft({ text: selectedText, language, question });
      setError('');
      onPrepare(draft);
    } catch (caught) { setError(caught.message || 'Could not prepare the sentence for Chat.'); }
  };

  return <div className="interpreter-glossary-overlay interpreter-search-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="interpreter-glossary interpreter-search" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={helpId}>
      <header className="interpreter-glossary-header">
        <div><p className="interpreter-eyebrow">FROM CONVERSATION TO UNDERSTANDING</p><h2 id={titleId}>Search with AI</h2></div>
        <button type="button" ref={closeRef} className="chat-icon-button" aria-label="Close sentence search" onClick={onClose}><Icon name="close" /></button>
      </header>
      <p id={helpId} className="interpreter-glossary-intro">Explore a complete translated sentence with {provider === 'GPT' ? 'ChatGPT' : provider}. Only the selected text and your question go into the draft—not the rest of this conversation. This uses Chat's AI knowledge, not live web search.</p>
      <form onSubmit={prepare}>
        {sentences.length > 1 && <label className="interpreter-field">Text to explore
          <select value={selection} onChange={event => { copyVersion.current++; setSelection(event.target.value); setCopied(false); setError(''); }}>
            {sentences.map((sentence, index) => <option key={index} value={String(index)}>Sentence {index + 1} · {sentence.length > 85 ? `${sentence.slice(0, 85)}…` : sentence}</option>)}
            <option value="all">Full translation · {sentences.length} sentences</option>
          </select>
        </label>}
        <div className="interpreter-search-preview-meta"><span>{LANGUAGES[language] || 'Translation'}</span><span>{selectedText.length.toLocaleString()} characters · full text</span></div>
        <blockquote className="interpreter-search-preview" lang={language} tabIndex={0} aria-label="Selected translation">{selectedText}</blockquote>
        <label className="interpreter-field interpreter-search-question">What would you like to know? (optional)
          <textarea value={question} maxLength={2000} rows={3} onChange={event => setQuestion(event.target.value)} placeholder="For example: What does this expression mean in this context?" />
        </label>
        <p className="interpreter-mode-help">Leave blank for an explanation, key terms, and useful background. You can edit the full request in Chat before pressing Send. Verify important information.</p>
        <p className="interpreter-search-privacy"><Icon name="lock" /><span>{privacyMode ? 'Private Chat: no previous messages or saved history. Provider retention still applies.' : 'Chat context is on. Messages you send follow your Chat history settings.'} Opening Chat ends this Interpreter session; export the transcript first if you need to keep it.</span></p>
        {busy && <p className="interpreter-banner" role="status">Stop listening before opening a Chat draft.</p>}
        {error && <p className="interpreter-banner interpreter-banner-error" role="alert">{error}</p>}
        <div className="interpreter-search-actions">
          <button type="button" className="interpreter-secondary" disabled={!selectedText} onClick={copyText}>Copy text</button>
          <span className="interpreter-copy-status" role="status">{copied ? 'Copied' : ''}</span>
          <button type="submit" className="interpreter-start" disabled={!selectedText || busy}>Open Chat draft <Icon name="arrow" /></button>
        </div>
      </form>
    </section>
  </div>;
}
