import { useEffect, useId, useRef, useState } from 'react';
import Icon from '../../components/Chat/Icon.jsx';

const EMPTY_GLOSSARY = { defaultIntensity: 0.4, vocabulary: [], spelling: [] };

function parseVariants(value) {
  const items = [...new Set(value.split(',').map(item => item.trim()).filter(Boolean))];
  if (items.length > 20) throw new Error('Use up to 20 comma-separated alternatives per entry.');
  if (items.some(item => item.length > 160)) throw new Error('Each alternative must be 160 characters or less.');
  return items;
}

function totalCharacters(glossary) {
  return [...glossary.vocabulary, ...glossary.spelling].reduce((sum, entry) =>
    sum + entry.value.length + (entry.pronunciations || entry.variants || []).reduce((count, item) => count + item.length, 0), 0);
}

export default function GlossaryEditor({ glossary = EMPTY_GLOSSARY, setGlossary, privacyMode, busy, onClose }) {
  const [term, setTerm] = useState('');
  const [pronunciations, setPronunciations] = useState('');
  const [preferred, setPreferred] = useState('');
  const [variants, setVariants] = useState('');
  const [error, setError] = useState('');
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const titleId = useId();
  const helpId = useId();
  const disabled = privacyMode || busy;

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const handleKeyDown = event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialogRef.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || [])
        .filter(element => element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls.at(-1);
      if (!first) { event.preventDefault(); return; }
      const outside = !dialogRef.current?.contains(document.activeElement);
      if (event.shiftKey && (outside || document.activeElement === first)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (outside || document.activeElement === last)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [onClose]);

  const update = next => {
    if (disabled) return;
    if (totalCharacters(next) > 20_000) { setError('The glossary must contain 20,000 characters or less in total. Remove an entry before adding more.'); return false; }
    if (setGlossary(next) === false) { setError('The glossary could not be updated. Check your entries and try again.'); return false; }
    setError('');
    return true;
  };

  const addEntry = (event, kind) => {
    event.preventDefault();
    if (disabled) return;
    try {
      const value = (kind === 'vocabulary' ? term : preferred).trim();
      const alternatives = parseVariants(kind === 'vocabulary' ? pronunciations : variants);
      if (!value) throw new Error('Enter the correct term or preferred spelling.');
      if (value.length > 160) throw new Error('Use a term of 160 characters or less.');
      if (kind === 'spelling' && !alternatives.length) throw new Error('Add at least one spelling variant to replace.');
      if (glossary[kind].length >= 100) throw new Error('Use up to 100 entries in each glossary section.');
      if (glossary[kind].some(entry => entry.value.toLowerCase() === value.toLowerCase())) throw new Error('That term already exists in this section.');
      const entry = { id: crypto.randomUUID(), value, enabled: true,
        ...(kind === 'vocabulary' ? { pronunciations: alternatives, intensity: null } : { variants: alternatives }) };
      if (update({ ...glossary, [kind]: [...glossary[kind], entry] })) {
        if (kind === 'vocabulary') { setTerm(''); setPronunciations(''); }
        else { setPreferred(''); setVariants(''); }
      }
    } catch (caught) { setError(caught.message); }
  };

  const patchEntry = (kind, id, patch) => update({ ...glossary, [kind]: glossary[kind].map(entry => entry.id === id ? { ...entry, ...patch } : entry) });
  const removeEntry = (kind, id) => update({ ...glossary, [kind]: glossary[kind].filter(entry => entry.id !== id) });

  return (
    <div className="interpreter-glossary-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="interpreter-glossary" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={helpId}>
        <header className="interpreter-glossary-header"><div><p className="interpreter-eyebrow">WORDS THAT MATTER</p><h2 id={titleId}>Kreyòl accuracy glossary</h2></div><button type="button" ref={closeRef} className="chat-icon-button" aria-label="Close glossary" onClick={onClose}><Icon name="close" /></button></header>
        <p id={helpId} className="interpreter-glossary-intro">Improve recognition of names and specialized terms. Changes apply to the next Kreyòl session and stay in memory until you leave this tool.</p>
        {privacyMode ? <p className="interpreter-banner">Privacy mode excludes the glossary from speech requests and disables editing. Turn privacy mode off in IApp settings to use it.</p>
          : busy && <p className="interpreter-banner">Stop listening before editing the glossary.</p>}
        {error && <p className="interpreter-banner interpreter-banner-error" role="alert">{error}</p>}

        <fieldset disabled={disabled} className="interpreter-glossary-fields">
          <legend className="chat-sr-only">Glossary entries</legend>
          <div className="interpreter-glossary-section">
            <label className="interpreter-field interpreter-intensity">Default vocabulary emphasis <output>{Math.round(glossary.defaultIntensity * 100)}%</output><input type="range" min="0" max="1" step="0.05" value={glossary.defaultIntensity} onChange={event => update({ ...glossary, defaultIntensity: Number(event.target.value) })} /></label>
            <p className="interpreter-glossary-help">Higher emphasis gives listed terms more weight. Start with the default 40%.</p>
          </div>

          <section className="interpreter-glossary-section">
            <h3>Sounds-like vocabulary <span>{glossary.vocabulary.length} / 100</span></h3>
            <p className="interpreter-glossary-help">Add the correct term and optional ways it sounds when spoken.</p>
            <form className="interpreter-glossary-form" onSubmit={event => addEntry(event, 'vocabulary')}>
              <label className="interpreter-field">Correct term<input value={term} maxLength={160} onChange={event => setTerm(event.target.value)} placeholder="For example, Pétion-Ville" /></label>
              <label className="interpreter-field">Sounds like, comma-separated<input value={pronunciations} maxLength={3220} onChange={event => setPronunciations(event.target.value)} placeholder="Optional: Petion vil" /></label>
              <button type="submit" className="interpreter-secondary" disabled={!term.trim() || glossary.vocabulary.length >= 100}>Add term</button>
            </form>
            {glossary.vocabulary.length === 0 ? <p className="interpreter-glossary-empty">No vocabulary terms yet.</p> : <ul className="interpreter-glossary-list">{glossary.vocabulary.map(entry => <li key={entry.id}>
              <label className="interpreter-glossary-entry"><input type="checkbox" checked={entry.enabled} onChange={event => patchEntry('vocabulary', entry.id, { enabled: event.target.checked })} aria-label={`Use vocabulary term ${entry.value}`} /><span><strong>{entry.value}</strong>{entry.pronunciations.length > 0 && <small>{entry.pronunciations.join(', ')}</small>}</span></label>
              <label className="interpreter-entry-intensity">Emphasis<input type="number" min="0" max="1" step="0.05" placeholder="Default" value={entry.intensity ?? ''} aria-label={`Emphasis for ${entry.value}`} onChange={event => { if (event.target.validity.valid) patchEntry('vocabulary', entry.id, { intensity: event.target.value === '' ? null : Number(event.target.value) }); }} /></label>
              <button type="button" className="chat-icon-button" aria-label={`Remove vocabulary term ${entry.value}`} onClick={() => removeEntry('vocabulary', entry.id)}><Icon name="close" /></button>
            </li>)}</ul>}
          </section>

          <section className="interpreter-glossary-section">
            <h3>Exact spelling corrections <span>{glossary.spelling.length} / 100</span></h3>
            <p className="interpreter-glossary-help">Replace consistently misspelled words with your preferred spelling.</p>
            <form className="interpreter-glossary-form" onSubmit={event => addEntry(event, 'spelling')}>
              <label className="interpreter-field">Preferred spelling<input value={preferred} maxLength={160} onChange={event => setPreferred(event.target.value)} placeholder="For example, Ayiti" /></label>
              <label className="interpreter-field">Variants to replace, comma-separated<input value={variants} maxLength={3220} onChange={event => setVariants(event.target.value)} placeholder="At least one spelling variant" /></label>
              <button type="submit" className="interpreter-secondary" disabled={!preferred.trim() || !variants.trim() || glossary.spelling.length >= 100}>Add correction</button>
            </form>
            {glossary.spelling.length === 0 ? <p className="interpreter-glossary-empty">No spelling corrections yet.</p> : <ul className="interpreter-glossary-list">{glossary.spelling.map(entry => <li key={entry.id}>
              <label className="interpreter-glossary-entry"><input type="checkbox" checked={entry.enabled} onChange={event => patchEntry('spelling', entry.id, { enabled: event.target.checked })} aria-label={`Use spelling correction ${entry.value}`} /><span><strong>{entry.value}</strong><small>{entry.variants.join(', ')}</small></span></label>
              <button type="button" className="chat-icon-button" aria-label={`Remove spelling correction ${entry.value}`} onClick={() => removeEntry('spelling', entry.id)}><Icon name="close" /></button>
            </li>)}</ul>}
          </section>
        </fieldset>
        <footer className="interpreter-glossary-footer"><p>Up to 160 characters per term, 20 alternatives per entry, and 20,000 characters in total. Enabled entries are sent to the speech provider when privacy mode is off.</p><button type="button" className="interpreter-start" onClick={onClose}>Done</button></footer>
      </section>
    </div>
  );
}
