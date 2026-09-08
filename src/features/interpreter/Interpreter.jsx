import { memo, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Context } from '../../Context/context.js';
import Icon from '../../components/Chat/Icon.jsx';
import '../../components/Chat/Chat.css';
import useInterpreter from './useInterpreter.js';
import GlossaryEditor from './GlossaryEditor.jsx';
import './Interpreter.css';

const LANGUAGE_NAMES = { en: 'English', es: 'Spanish', ht: 'Haitian Kreyòl' };
const EMPTY_UTTERANCES = [];
const labelForLanguage = language => LANGUAGE_NAMES[language] || 'Speech';
const errorText = error => typeof error === 'string' ? error : error?.message || 'An unexpected error occurred.';

function formatElapsed(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map(part => String(part).padStart(2, '0')).join(':');
}

function SpeechTime({ timestamp }) {
  if (timestamp == null) return null;
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return <time dateTime={date.toISOString()}>{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>;
}

const Utterance = memo(function Utterance({ utterance, subtitleOnly, retry }) {
  const { id, text, lang, targetLang, translation, translating, failed, timestamp } = utterance;
  return (
    <article className={`interpreter-turn ${subtitleOnly ? 'is-subtitle-only' : ''}`} aria-label={`${labelForLanguage(lang)} speech`}>
      <div className="interpreter-speech">
        <div className="interpreter-turn-meta"><span className="interpreter-mobile-col">Original · </span><span>{labelForLanguage(lang)}</span><SpeechTime timestamp={timestamp} /></div>
        <p lang={lang}>{text}</p>
      </div>
      {!subtitleOnly && <div className="interpreter-translation">
        <div className="interpreter-turn-meta"><span className="interpreter-mobile-col">Translation · </span><span>{labelForLanguage(targetLang)}</span></div>
        {translating ? <p className="interpreter-muted" role="status">Translating…</p>
          : failed ? <div className="interpreter-retry"><p>Translation could not be completed.</p><button type="button" onClick={() => retry(id)} aria-label={`Retry translation: ${text}`}>Retry translation</button></div>
            : translation ? <p lang={targetLang}>{translation}</p>
              : <p className="interpreter-muted">No translation for this segment.</p>}
      </div>}
    </article>
  );
});

export default function Interpreter({ onBack }) {
  const { privacyMode, modelFeature, openSidebar, setOpenSidebar, setOpenModal } = useContext(Context);
  const {
    status, source, setSource, captureKreyol, setCaptureKreyol, htMode, setHtMode,
    subtitleOnly, setSubtitleOnly, utterances = EMPTY_UTTERANCES, interimText, interimLang,
    error, dismissError, capabilities, capabilitiesLoading, capabilitiesError,
    reloadCapabilities, elapsedSeconds, start, stop, clear, retry, glossary, setGlossary, canStart,
  } = useInterpreter({ privacyMode });
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const scrollRef = useRef(null);
  const followScroll = useRef(true);
  const busy = status !== 'idle';
  const listening = status === 'listening';
  const hasContent = utterances.length > 0 || Boolean(interimText);
  const selectedTranscription = captureKreyol ? capabilities?.transcription?.gladia : capabilities?.transcription?.deepgram;
  const selectedTranslation = captureKreyol || htMode ? capabilities?.translation?.google : capabilities?.translation?.deepl;
  const missingTranscription = capabilities && !selectedTranscription;
  const missingTranslation = capabilities && !subtitleOnly && !selectedTranslation;
  const capabilityIssue = Boolean(capabilitiesError || missingTranscription || missingTranslation);
  const closeGlossary = useCallback(() => setGlossaryOpen(false), []);
  const readyLabel = capabilitiesLoading ? 'Checking setup' : capabilityIssue ? 'Setup needed' : 'Ready';

  useEffect(() => {
    const viewport = scrollRef.current;
    if (viewport && followScroll.current) viewport.scrollTop = viewport.scrollHeight;
  }, [utterances, interimText, subtitleOnly]);

  const leave = () => { stop(); clear(); onBack(); };
  const clearTranscript = () => { clear(); followScroll.current = true; setShowJump(false); };
  const jumpToLatest = () => {
    const viewport = scrollRef.current;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
    followScroll.current = true;
    setShowJump(false);
  };

  return (
    <main className={`iapp-chat iapp-chat-${modelFeature.toLowerCase()} iapp-interpreter`}>
      <header className="chat-header interpreter-header">
        <div className="chat-header-left">
          <button type="button" className="chat-icon-button chat-mobile-menu" aria-label="Toggle navigation" aria-expanded={openSidebar} onClick={() => setOpenSidebar(!openSidebar)}><Icon name="menu" /></button>
          <button type="button" className="interpreter-back" onClick={leave} aria-label="Back to tools"><Icon name="arrow" /><span>Tools</span></button>
          <h1>Interpreter <span>AI</span></h1>
        </div>
        <div className="chat-header-actions">
          <span className={`chat-context-pill ${privacyMode ? 'is-private' : ''}`} aria-label={privacyMode ? 'Privacy mode on' : 'Session-only transcript'} title={privacyMode ? 'Privacy mode on' : 'Session-only transcript'}><Icon name="lock" /><span>{privacyMode ? 'Privacy on' : 'Session only'}</span></span>
          <button type="button" className="chat-icon-button" aria-label="Open settings" onClick={() => setOpenModal(true)}><Icon name="settings" /></button>
        </div>
      </header>

      <div className="interpreter-workspace">
        <section className="interpreter-controls" aria-label="Interpreter controls">
          <div className="interpreter-control-grid">
            <label className="interpreter-field">Audio source<select value={source} disabled={busy} onChange={event => setSource(event.target.value)}><option value="mic">Microphone</option><option value="tab">Browser tab</option></select></label>
            <label className="interpreter-field">Who is speaking?<select value={captureKreyol ? 'ht' : 'en-es'} disabled={busy} onChange={event => setCaptureKreyol(event.target.value === 'ht')}><option value="en-es">English / Spanish</option><option value="ht">Haitian Kreyòl</option></select></label>
            <label className="interpreter-field">Translation direction<select value={captureKreyol ? 'adaptive' : htMode ? 'ht' : 'en-es'} disabled={busy || captureKreyol || subtitleOnly} onChange={event => setHtMode(event.target.value === 'ht')}>
              {captureKreyol ? <option value="adaptive">Kreyòl → last English / Spanish</option> : <><option value="en-es">English ↔ Spanish</option><option value="ht">English / Spanish → Kreyòl</option></>}
            </select></label>
          </div>
          <p className="interpreter-mode-help">{captureKreyol ? 'Kreyòl is translated to the last English or Spanish language heard in this conversation, starting with English.' : 'English and Spanish are detected automatically. Stop first to switch to a Kreyòl speaker.'}{source === 'tab' && ' Select a browser tab and enable “Share tab audio” when prompted.'}</p>
          <div className="interpreter-action-row">
            <div className="interpreter-options">
              <label className="interpreter-checkbox"><input type="checkbox" checked={subtitleOnly} disabled={busy} onChange={event => setSubtitleOnly(event.target.checked)} />Subtitles only</label>
              <button type="button" className="interpreter-secondary" onClick={() => setGlossaryOpen(true)}><Icon name="file" />Kreyòl glossary</button>
            </div>
            <div className="interpreter-playback">
              <span className={`interpreter-status ${listening ? 'is-listening' : ''}`} role="status"><span aria-hidden="true" />{listening ? 'Listening' : status === 'starting' ? 'Connecting' : readyLabel}</span>
              <span className="interpreter-timer" aria-label={`Session duration ${formatElapsed(elapsedSeconds)}`}>{formatElapsed(elapsedSeconds)}</span>
              {busy ? <button type="button" className="interpreter-stop" onClick={stop}>{status === 'starting' ? 'Cancel start' : 'Stop listening'}</button>
                : <button type="button" className="interpreter-start" disabled={!canStart || capabilitiesLoading} onClick={start}>Start listening</button>}
            </div>
          </div>
        </section>

        {capabilitiesLoading && <p className="interpreter-banner" role="status">Checking interpreter configuration…</p>}
        {!capabilitiesLoading && capabilityIssue && <div className="interpreter-banner interpreter-banner-warning" role="alert">
          {capabilitiesError && <p>{errorText(capabilitiesError)} Check that the updated IApp backend is deployed and reachable.</p>}
          {missingTranscription && <p>{captureKreyol ? 'Kreyòl speech needs Gladia.' : 'English / Spanish speech needs Deepgram.'} Set <code>{captureKreyol ? 'GLADIA_API_KEY' : 'DEEPGRAM_API_KEY'}</code> on the IApp backend, then recheck availability.</p>}
          {missingTranslation && <p>{captureKreyol || htMode ? 'Kreyòl translation needs Google Cloud Translation.' : 'English / Spanish translation needs DeepL.'} Set <code>{captureKreyol || htMode ? 'GOOGLE_TRANSLATE_API_KEY' : 'DEEPL_API_KEY'}</code> on the IApp backend, or use Subtitles only.</p>}
          <button type="button" className="interpreter-secondary" disabled={busy} onClick={reloadCapabilities}>Recheck availability</button>
        </div>}
        {error && <div className="interpreter-banner interpreter-banner-error" role="alert"><p>{errorText(error)}</p><button type="button" className="chat-icon-button" aria-label="Dismiss interpreter error" onClick={dismissError}><Icon name="close" /></button></div>}

        <section className="interpreter-conversation" aria-label="Live interpretation">
          <div className={`interpreter-conversation-header ${subtitleOnly ? 'is-subtitle-only' : ''}`}>
            <h2>Original</h2>{!subtitleOnly && <h2>Translation</h2>}
            <button type="button" className="interpreter-clear" disabled={!hasContent || busy} onClick={clearTranscript} title={busy ? 'Stop listening before clearing the transcript' : 'Discard the transcript'}>Clear transcript</button>
          </div>
          <div className="interpreter-transcript" ref={scrollRef} onScroll={event => {
            const viewport = event.currentTarget;
            const nearBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 80;
            followScroll.current = nearBottom;
            setShowJump(!nearBottom);
          }}>
            {!hasContent && <div className="interpreter-empty">
              <span className="interpreter-empty-symbol" aria-hidden="true">Aa ↔ Aa</span>
              <h3>{listening ? 'Listening for your first words…' : status === 'starting' ? 'Connecting your audio…' : 'Make room for a conversation.'}</h3>
              <p>{busy ? 'Your words will appear here as you speak.' : 'Choose who is speaking and where to listen. Then press Start listening to begin.'}</p>
              {!busy && <p className="interpreter-empty-note">Your microphone and tab audio stay off until you start.</p>}
            </div>}
            <div role="log" aria-label="Final speech and translations" aria-live="polite" aria-relevant="additions text">
              {utterances.map(utterance => <Utterance key={utterance.id} utterance={utterance} subtitleOnly={subtitleOnly} retry={retry} />)}
            </div>
            {interimText && <div className={`interpreter-turn interpreter-interim ${subtitleOnly ? 'is-subtitle-only' : ''}`} aria-label="Speech in progress">
              <div className="interpreter-speech"><div className="interpreter-turn-meta">{labelForLanguage(interimLang)} · In progress</div><p lang={interimLang}>{interimText}<span className="interpreter-cursor" aria-hidden="true" /></p></div>
              {!subtitleOnly && <div className="interpreter-translation"><p className="interpreter-muted">Translation follows completed speech.</p></div>}
            </div>}
          </div>
          {showJump && <button type="button" className="interpreter-jump" onClick={jumpToLatest}>Jump to latest ↓</button>}
        </section>

        <footer className="interpreter-footer"><Icon name="lock" /><p>{privacyMode ? 'Privacy mode excludes the custom glossary. ' : ''}IApp keeps this transcript in memory and does not save audio. Audio goes to the speech provider; {subtitleOnly ? 'Subtitles only does not send text for translation.' : 'completed text goes through IApp to the translation provider.'} Provider retention still applies. Leaving this tool stops capture and discards the transcript.</p></footer>
      </div>
      {glossaryOpen && <GlossaryEditor glossary={glossary} setGlossary={setGlossary} privacyMode={privacyMode} busy={busy} onClose={closeGlossary} />}
    </main>
  );
}
