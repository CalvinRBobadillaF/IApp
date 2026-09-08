import { useCallback, useEffect, useRef, useState } from 'react';
import { createInterpreterSession, getInterpreterCapabilities, translateInterpreterText } from './api.js';
import { startInterpreterAudio } from './audioCapture.js';
import { DEEPGRAM_LOCAL_KEY, readDeepgramCredential, removeSavedDeepgramKey, validateDeepgramKey } from '../../services/interpreterCredentials.js';

export const MAX_UTTERANCES = 300;
export const emptyGlossary = () => ({ defaultIntensity: 0.4, vocabulary: [], spelling: [] });
export function targetLanguage(source, htMode, lastNonHt = 'en') {
  return source === 'ht' ? lastNonHt : htMode ? 'ht' : source === 'en' ? 'es' : 'en';
}
export function interpreterAvailability(capabilities, { captureKreyol, htMode, subtitleOnly, credentialMode = 'server', localKeyConfigured = false }) {
  const localSpeech = credentialMode === 'local' && !captureKreyol;
  if (localSpeech && !localKeyConfigured) return 'Enter your Deepgram key in Deepgram credentials, or switch back to server credentials.';
  if (localSpeech && subtitleOnly) return '';
  if (!capabilities) return 'Interpreter configuration is not available. Refresh its server status.';
  const speech = captureKreyol ? 'gladia' : 'deepgram';
  if (!localSpeech && !capabilities.transcription[speech]) return `Configure ${captureKreyol ? 'GLADIA_API_KEY' : 'DEEPGRAM_API_KEY'} on the IApp backend to transcribe this language.`;
  if (!subtitleOnly) {
    const translation = captureKreyol || htMode ? 'google' : 'deepl';
    if (!capabilities.translation[translation]) return `Configure ${translation === 'google' ? 'GOOGLE_TRANSLATE_API_KEY' : 'DEEPL_API_KEY'} on the IApp backend, or choose Subtitles only.`;
  }
  return '';
}

export function validateGlossary(value) {
  if (!value || !Array.isArray(value.vocabulary) || !Array.isArray(value.spelling) ||
      value.vocabulary.length > 100 || value.spelling.length > 100) throw new Error('Keep at most 100 vocabulary terms and 100 spelling corrections.');
  let characters = 0;
  const term = text => {
    if (typeof text !== 'string' || !text.trim() || text.trim().length > 160) throw new Error('Glossary terms must contain 1–160 characters.');
    if ([...text].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error('Glossary terms cannot contain control characters.');
    characters += text.trim().length;
    return text.trim();
  };
  const list = items => {
    if (!Array.isArray(items) || items.length > 20) throw new Error('Use at most 20 pronunciations or variants for each term.');
    return items.map(term);
  };
  const intensity = number => {
    if (typeof number !== 'number' || !Number.isFinite(number) || number < 0 || number > 1) throw new Error('Glossary intensity must be between 0 and 1.');
    return number;
  };
  const result = {
    defaultIntensity: intensity(value.defaultIntensity),
    vocabulary: value.vocabulary.map(entry => ({ id: entry.id || crypto.randomUUID(), value: term(entry.value),
      pronunciations: list(entry.pronunciations || []), intensity: entry.intensity == null ? null : intensity(entry.intensity), enabled: entry.enabled !== false })),
    spelling: value.spelling.map(entry => {
      const variants = list(entry.variants);
      if (!variants.length) throw new Error('A spelling correction needs at least one variant.');
      return { id: entry.id || crypto.randomUUID(), value: term(entry.value), variants, enabled: entry.enabled !== false };
    }),
  };
  if (characters > 20_000) throw new Error('The glossary must contain at most 20,000 characters.');
  return result;
}

// All transcript, glossary, and connection state is local to this mounted tool.
// No transcript persistence or global translation cache. Remembering a direct
// Deepgram key is a separate explicit opt-in; never return its value to the UI.
export default function useInterpreter({ privacyMode = true } = {}) {
  const [status, setStatus] = useState('idle');
  const [source, changeSource] = useState('mic');
  const [captureKreyol, changeCaptureKreyol] = useState(false);
  const [htMode, changeHtMode] = useState(true);
  const [subtitleOnly, changeSubtitleOnly] = useState(false);
  const [utterances, setUtterances] = useState([]);
  const [interimText, setInterimText] = useState('');
  const [interimLang, setInterimLang] = useState('en');
  const [error, setError] = useState('');
  const [glossary, changeGlossary] = useState(emptyGlossary);
  const [capabilities, setCapabilities] = useState(null);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(true);
  const [capabilitiesError, setCapabilitiesError] = useState('');
  const [capabilityVersion, setCapabilityVersion] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [credentialMode, changeCredentialMode] = useState('server');
  const [localCredential, changeLocalCredential] = useState(readDeepgramCredential);
  const credentialRef = useRef(localCredential);
  const credentialModeRef = useRef('server');
  const mounted = useRef(false);
  const runRef = useRef(null);
  const rowsRef = useRef([]);
  const translations = useRef(new Map());
  const lastFinal = useRef(null);
  const lastNonHt = useRef('en');
  const previousPrivacy = useRef(privacyMode);

  const updateRows = useCallback(updater => {
    const next = updater(rowsRef.current).slice(-MAX_UTTERANCES);
    rowsRef.current = next;
    for (const [id, job] of translations.current) {
      if (!next.some(row => row.id === id)) { job.controller.abort(); translations.current.delete(id); }
    }
    if (mounted.current) setUtterances(next);
  }, []);

  const abortTranslations = useCallback(() => {
    for (const job of translations.current.values()) job.controller.abort();
    translations.current.clear();
  }, []);

  const stop = useCallback(() => {
    const run = runRef.current;
    runRef.current = null;
    run?.controller.abort();
    run?.audio?.stop();
    abortTranslations();
    lastFinal.current = null;
    updateRows(rows => rows.map(row => row.translating ? { ...row, translating: false, failed: true } : row));
    if (mounted.current) { setStatus('idle'); setInterimText(''); }
  }, [abortTranslations, updateRows]);

  const clear = useCallback(() => {
    abortTranslations();
    lastFinal.current = null;
    lastNonHt.current = 'en';
    updateRows(() => []);
    setElapsedSeconds(0);
    setInterimText('');
    setError('');
  }, [abortTranslations, updateRows]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stop();
      rowsRef.current = [];
    };
  }, [stop]);

  useEffect(() => {
    const changed = event => {
      if (event.key !== DEEPGRAM_LOCAL_KEY && event.key !== null) return;
      // Another tab removed/replaced browser credentials. Never keep using the
      // prior key or silently switch the active stream to a different account.
      stop();
      credentialModeRef.current = 'server';
      changeCredentialMode('server');
      const next = readDeepgramCredential();
      credentialRef.current = next;
      changeLocalCredential(next);
      setError('Browser credentials changed in another tab. Listening stopped; choose your credentials again.');
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, [stop]);

  useEffect(() => {
    const controller = new AbortController();
    setCapabilitiesLoading(true);
    setCapabilitiesError('');
    getInterpreterCapabilities(controller.signal).then(data => {
      if (!controller.signal.aborted) setCapabilities(data);
    }).catch(caught => {
      if (!controller.signal.aborted) { setCapabilities(null); setCapabilitiesError(caught.message || 'Cannot reach the Interpreter API.'); }
    }).finally(() => { if (!controller.signal.aborted) setCapabilitiesLoading(false); });
    return () => controller.abort();
  }, [capabilityVersion]);

  useEffect(() => {
    if (previousPrivacy.current === privacyMode) return;
    previousPrivacy.current = privacyMode;
    stop();
    clear();
    changeGlossary(emptyGlossary());
    setError('Privacy mode changed. Recording stopped and the interpreter session was cleared.');
  }, [privacyMode, stop, clear]);

  useEffect(() => {
    if (status !== 'listening') return;
    const started = Date.now();
    const timer = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [status]);

  const translateRow = useCallback(async row => {
    translations.current.get(row.id)?.controller.abort();
    translations.current.delete(row.id);
    // Keep a slow provider from accumulating unbounded requests during live audio.
    if (translations.current.size >= 3) {
      updateRows(rows => rows.map(item => item.id === row.id ? { ...item, translating: false, failed: true } : item));
      setError('Translation is catching up. Use Retry on any untranslated segments.');
      return;
    }
    const job = { controller: new AbortController(), revision: row.revision };
    translations.current.set(row.id, job);
    updateRows(rows => rows.map(item => item.id === row.id ? { ...item, translating: true, failed: false } : item));
    try {
      const text = await translateInterpreterText({ text: row.text, from: row.lang, to: row.targetLang, privacyMode }, { signal: job.controller.signal });
      if (!mounted.current || translations.current.get(row.id) !== job || job.controller.signal.aborted) return;
      updateRows(rows => rows.map(item => item.id === row.id && item.revision === job.revision
        ? { ...item, translation: text, translating: false, failed: false } : item));
    } catch (caught) {
      if (!mounted.current || job.controller.signal.aborted || translations.current.get(row.id) !== job) return;
      updateRows(rows => rows.map(item => item.id === row.id && item.revision === job.revision
        ? { ...item, translating: false, failed: true } : item));
      setError(caught.message || 'Translation failed. Please retry this segment.');
    } finally {
      if (translations.current.get(row.id) === job) translations.current.delete(row.id);
    }
  }, [privacyMode, updateRows]);

  const backendRequired = !(credentialMode === 'local' && !captureKreyol && subtitleOnly);
  const unavailable = interpreterAvailability(capabilities, { captureKreyol, htMode, subtitleOnly, credentialMode, localKeyConfigured: Boolean(localCredential.key) });
  const canStart = status === 'idle' && !(capabilitiesLoading && backendRequired) && !unavailable;
  const start = useCallback(async () => {
    if (runRef.current || !mounted.current) return;
    const localSpeech = credentialModeRef.current === 'local' && !captureKreyol;
    const credential = credentialRef.current;
    const blocked = interpreterAvailability(capabilities, { captureKreyol, htMode, subtitleOnly,
      credentialMode: credentialModeRef.current, localKeyConfigured: Boolean(credential.key) });
    if (blocked || (capabilitiesLoading && !(localSpeech && subtitleOnly))) { setError(blocked || 'Wait for Interpreter configuration to load.'); return; }
    const run = { controller: new AbortController(), audio: null };
    runRef.current = run;
    setStatus('starting');
    setError('');
    setElapsedSeconds(0);
    lastFinal.current = null;
    const isCurrent = () => mounted.current && runRef.current === run && !run.controller.signal.aborted;
    try {
      const audio = await startInterpreterAudio({
        source, provider: captureKreyol ? 'gladia' : 'deepgram', signal: run.controller.signal,
        ...(localSpeech ? { deepgramApiKey: credential.key } : {
          createSession: options => createInterpreterSession({ ...options, privacy_mode: privacyMode,
            ...(privacyMode ? {} : { glossary }) }, { signal: run.controller.signal }),
        }),
        onInterim: ({ text, lang }) => {
          if (!isCurrent()) return;
          setInterimText(typeof text === 'string' ? text.slice(0, 5000) : '');
          setInterimLang(lang);
        },
        onFinal: ({ text, lang, speechFinal }) => {
          if (!isCurrent() || typeof text !== 'string' || !text.trim()) return;
          const clean = text.trim();
          if (clean.length > 5000) { setError('A transcript segment exceeded 5,000 characters. Stop and restart with shorter segments.'); return; }
          const language = lang?.slice(0, 2).toLowerCase();
          if (!['en', 'es', 'ht'].includes(language)) return;
          if (language !== 'ht') lastNonHt.current = language;
          const target = targetLanguage(language, htMode, lastNonHt.current);
          setInterimText('');
          const previous = lastFinal.current;
          const currentRow = rowsRef.current.at(-1);
          const merge = previous && !previous.speechFinal && currentRow?.id === previous.id && Date.now() - previous.time < 250 &&
            !/[.!?…]$/.test(currentRow.text) && !speechFinal && currentRow.lang === language &&
            currentRow.targetLang === target && currentRow.text.length + clean.length + 1 <= 5000;
          const row = { id: merge ? currentRow.id : crypto.randomUUID(), text: merge ? `${currentRow.text} ${clean}` : clean,
            lang: language, targetLang: target, translation: null, translating: !subtitleOnly, failed: false,
            timestamp: merge ? currentRow.timestamp : new Date(), revision: merge ? currentRow.revision + 1 : 0 };
          lastFinal.current = { id: row.id, time: Date.now(), speechFinal };
          updateRows(rows => merge ? [...rows.slice(0, -1), row] : [...rows, row]);
          if (!subtitleOnly) void translateRow(row);
        },
        onError: message => { if (isCurrent()) setError(typeof message === 'string' ? message : 'Audio transcription failed.'); },
        onEnded: () => { if (isCurrent()) stop(); },
      });
      if (!isCurrent()) { audio.stop(); return; }
      run.audio = audio;
      setStatus('listening');
    } catch (caught) {
      if (!isCurrent()) return;
      stop();
      if (caught.name !== 'AbortError') setError(caught.message || 'Could not start transcription.');
    }
  }, [capabilities, capabilitiesLoading, source, captureKreyol, privacyMode, glossary, htMode, subtitleOnly, translateRow, updateRows, stop]);

  const setCredentialMode = value => {
    if (runRef.current || !['server', 'local'].includes(value)) return;
    credentialModeRef.current = value;
    changeCredentialMode(value);
    setError('');
  };
  const saveLocalKey = (value, { remember = false } = {}) => {
    if (runRef.current) return false;
    let key;
    try { key = validateDeepgramKey(value); }
    catch (caught) {
      const next = { ...credentialRef.current, error: caught.message };
      credentialRef.current = next;
      changeLocalCredential(next);
      return false;
    }
    const next = { key, remembered: false, error: '' };
    if (remember === true) {
      try { localStorage.setItem(DEEPGRAM_LOCAL_KEY, key); next.remembered = true; }
      catch {
        next.remembered = credentialRef.current.remembered;
        next.error = 'Saving failed. The entered key is available for this session only; any previously saved key may still remain on this device.';
      }
    } else if (!removeSavedDeepgramKey()) {
      next.remembered = credentialRef.current.remembered;
      next.error = 'Using the entered key for this session, but browser storage could not be cleared. Any previously saved key may still remain; clear this site’s data in your browser when possible.';
    }
    credentialRef.current = next;
    changeLocalCredential(next);
    setError('');
    return true;
  };
  const removeLocalKey = () => {
    if (runRef.current) return false;
    const removed = removeSavedDeepgramKey();
    const next = { key: '', remembered: removed ? false : credentialRef.current.remembered,
      error: removed ? '' : 'The key is no longer active in this session, but IApp could not remove it from browser storage. Clear this site’s data in your browser; revoke the key in Deepgram if needed.' };
    credentialRef.current = next;
    changeLocalCredential(next);
    return removed;
  };

  const retry = useCallback(id => {
    const row = rowsRef.current.find(item => item.id === id);
    if (row?.failed && !translations.current.has(id)) void translateRow(row);
  }, [translateRow]);
  const setGlossary = value => {
    if (privacyMode || runRef.current) return;
    try { changeGlossary(validateGlossary(value)); return true; }
    catch (caught) { setError(caught.message); return false; }
  };
  return {
    status, source, setSource: value => { if (!runRef.current && ['mic', 'tab'].includes(value)) changeSource(value); },
    captureKreyol, setCaptureKreyol: value => { if (!runRef.current) changeCaptureKreyol(Boolean(value)); },
    htMode, setHtMode: value => { if (!runRef.current) changeHtMode(Boolean(value)); },
    subtitleOnly, setSubtitleOnly: value => { if (!runRef.current) changeSubtitleOnly(Boolean(value)); },
    utterances, interimText, interimLang, error, dismissError: () => setError(''),
    capabilities, capabilitiesLoading, capabilitiesError,
    reloadCapabilities: () => { if (!runRef.current) setCapabilityVersion(version => version + 1); },
    elapsedSeconds, start, stop, clear, retry, glossary, setGlossary, canStart,
    credentialMode, setCredentialMode, localKeyConfigured: Boolean(localCredential.key),
    localKeyRemembered: localCredential.remembered, localKeyStorageError: localCredential.error,
    saveLocalKey, removeLocalKey, backendRequired,
  };
}
