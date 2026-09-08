import { StrictMode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useInterpreter, { emptyGlossary, interpreterAvailability, MAX_UTTERANCES, targetLanguage, validateGlossary } from './useInterpreter.js';
import { createInterpreterSession, getInterpreterCapabilities, translateInterpreterText } from './api.js';
import { startInterpreterAudio } from './audioCapture.js';

vi.mock('./api.js', () => ({ createInterpreterSession: vi.fn(), getInterpreterCapabilities: vi.fn(), translateInterpreterText: vi.fn() }));
vi.mock('./audioCapture.js', () => ({ startInterpreterAudio: vi.fn() }));
const configured = { transcription: { deepgram: true, gladia: true }, translation: { deepl: true, google: true } };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const audio = () => startInterpreterAudio.mock.calls.at(-1)[0];
async function setup(privacyMode = true, strict = false) {
  const hook = renderHook(props => useInterpreter(props), {
    initialProps: { privacyMode }, ...(strict ? { wrapper: StrictMode } : {}),
  });
  await act(async () => {});
  return hook;
}
async function start(result) { await act(async () => { await result.current.start(); }); }
async function final(text, lang = 'en', speechFinal = true) {
  await act(async () => { audio().onFinal({ text, lang, speechFinal }); });
}
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  getInterpreterCapabilities.mockResolvedValue(configured);
  createInterpreterSession.mockResolvedValue({ provider: 'deepgram', url: 'wss://api.deepgram.com/v1/listen' });
  translateInterpreterText.mockImplementation(async ({ text }) => `Translated: ${text}`);
  startInterpreterAudio.mockResolvedValue({ stop: vi.fn() });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('Interpreter lifecycle', () => {
  it('keeps completed-row callbacks stable while the timer runs and resets duration on clear', async () => {
    vi.useFakeTimers();
    const { result } = await setup();
    await start(result);
    const retry = result.current.retry;
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.elapsedSeconds).toBe(3);
    expect(result.current.retry).toBe(retry);
    act(() => { result.current.stop(); result.current.clear(); });
    expect(result.current.elapsedSeconds).toBe(0);
  });
  it('loads capabilities but never captures on mount, including StrictMode', async () => {
    const { result } = await setup(true, true);
    expect(result.current.canStart).toBe(true);
    expect(startInterpreterAudio).not.toHaveBeenCalled();
    expect(createInterpreterSession).not.toHaveBeenCalled();
  });

  it('locks immediately against duplicate starts and ignores controls while connecting', async () => {
    const pending = deferred();
    startInterpreterAudio.mockReturnValue(pending.promise);
    const { result } = await setup();
    let running;
    act(() => { running = result.current.start(); void result.current.start(); });
    expect(startInterpreterAudio).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('starting');
    act(() => { result.current.setSource('tab'); result.current.setCaptureKreyol(true); result.current.setHtMode(false); result.current.setSubtitleOnly(true); });
    expect(result.current).toMatchObject({ source: 'mic', captureKreyol: false, htMode: true, subtitleOnly: false });
    await act(async () => { pending.resolve({ stop: vi.fn() }); await running; });
    expect(result.current.status).toBe('listening');
  });

  it('cancels startup and stops a late handle without replacing a newer session', async () => {
    const pending = deferred(), stopOld = vi.fn();
    startInterpreterAudio.mockReturnValueOnce(pending.promise);
    const { result } = await setup();
    let running;
    act(() => { running = result.current.start(); });
    const old = audio();
    act(() => result.current.stop());
    expect(old.signal.aborted).toBe(true);
    await start(result);
    await act(async () => { pending.resolve({ stop: stopOld }); await running; old.onFinal({ text: 'Stale', lang: 'en' }); });
    expect(stopOld).toHaveBeenCalledOnce();
    expect(result.current.status).toBe('listening');
    expect(result.current.utterances).toEqual([]);
  });

  it('aborts active capture on unmount and ignores callbacks after leaving Tools', async () => {
    const { result, unmount } = await setup();
    await start(result);
    const callbacks = audio();
    const handle = await startInterpreterAudio.mock.results[0].value;
    unmount();
    expect(callbacks.signal.aborted).toBe(true);
    expect(handle.stop).toHaveBeenCalledOnce();
    callbacks.onFinal({ text: 'Too late', lang: 'en' });
    expect(translateInterpreterText).not.toHaveBeenCalled();
  });

  it('reports a failed connection and permits another start', async () => {
    startInterpreterAudio.mockRejectedValueOnce(new Error('Microphone denied'));
    const { result } = await setup();
    await start(result);
    expect(result.current).toMatchObject({ status: 'idle', error: 'Microphone denied', canStart: true });
    await start(result);
    act(() => { audio().onError('Connection lost'); audio().onEnded(); });
    expect(result.current).toMatchObject({ status: 'idle', error: 'Connection lost' });
  });

  it('blocks incomplete backend configuration and can recheck after deployment', async () => {
    getInterpreterCapabilities.mockRejectedValueOnce(new Error('Deploy the updated backend'));
    const { result } = await setup();
    expect(result.current.capabilitiesError).toMatch(/Deploy/);
    await start(result);
    expect(startInterpreterAudio).not.toHaveBeenCalled();
    await act(async () => { result.current.reloadCapabilities(); });
    expect(result.current.canStart).toBe(true);
  });

  it('requires only speech configuration when subtitles-only is selected', async () => {
    getInterpreterCapabilities.mockResolvedValue({ ...configured, translation: { google: false, deepl: false } });
    const { result } = await setup();
    expect(result.current.canStart).toBe(false);
    act(() => result.current.setSubtitleOnly(true));
    await start(result);
    await final('Hello.');
    expect(result.current.utterances[0]).toMatchObject({ text: 'Hello.', translating: false, failed: false });
    expect(translateInterpreterText).not.toHaveBeenCalled();
  });
});

describe('Transcript, translation, and privacy boundaries', () => {
  it('shows interim text without translating it and routes final EN/ES text to Kreyòl', async () => {
    const { result } = await setup();
    await start(result);
    act(() => audio().onInterim({ text: 'Hel', lang: 'en' }));
    expect(result.current.interimText).toBe('Hel');
    expect(translateInterpreterText).not.toHaveBeenCalled();
    await final('Hello.', 'en-US');
    await final('Hola.', 'es');
    expect(translateInterpreterText.mock.calls.map(([payload]) => payload)).toEqual([
      { text: 'Hello.', from: 'en', to: 'ht', privacyMode: true },
      { text: 'Hola.', from: 'es', to: 'ht', privacyMode: true },
    ]);
    expect(result.current.interimText).toBe('');
    expect(result.current.utterances[0].translation).toBe('Translated: Hello.');
    expect(localStorage.length).toBe(0);
  });

  it('routes English/Spanish bidirectionally with Kreyòl mode off', async () => {
    const { result } = await setup(false);
    act(() => result.current.setHtMode(false));
    await start(result);
    await final('Hello.', 'en');
    await final('Hola.', 'es');
    expect(translateInterpreterText.mock.calls.map(([payload]) => payload.to)).toEqual(['es', 'en']);
  });

  it('remembers the last EN/ES speaker when switching to Kreyòl capture', async () => {
    const { result } = await setup();
    await start(result);
    await final('Hola.', 'es');
    act(() => { result.current.stop(); result.current.setCaptureKreyol(true); });
    await start(result);
    expect(audio().provider).toBe('gladia');
    await final('Bonjou.', 'ht');
    expect(translateInterpreterText.mock.calls.at(-1)[0]).toMatchObject({ from: 'ht', to: 'es' });
    act(() => { result.current.stop(); result.current.clear(); });
    await start(result);
    await final('Bonjou.', 'ht');
    expect(translateInterpreterText.mock.calls.at(-1)[0].to).toBe('en');
  });

  it('merges close partial finals, aborts old translations, and ignores stale results', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    const old = deferred(), current = deferred();
    translateInterpreterText.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const { result } = await setup();
    await start(result);
    await final('Hello', 'en', false);
    const oldSignal = translateInterpreterText.mock.calls[0][1].signal;
    await final('everyone', 'en', false);
    expect(oldSignal.aborted).toBe(true);
    expect(result.current.utterances).toHaveLength(1);
    expect(result.current.utterances[0].text).toBe('Hello everyone');
    await act(async () => { current.resolve('Complete translation'); });
    await act(async () => { old.resolve('Stale translation'); });
    expect(result.current.utterances[0].translation).toBe('Complete translation');
  });

  it('does not merge a new fragment into an already completed utterance', async () => {
    const { result } = await setup();
    await start(result);
    await final('First completed turn', 'en', true);
    await final('Next turn', 'en', false);
    expect(result.current.utterances).toHaveLength(2);
  });

  it('limits concurrent translations and allows retry after backlog clears', async () => {
    const requests = Array.from({ length: 3 }, deferred);
    requests.forEach(request => translateInterpreterText.mockReturnValueOnce(request.promise));
    const { result } = await setup();
    await start(result);
    for (let index = 0; index < 4; index++) await final(`Turn ${index}.`);
    expect(translateInterpreterText).toHaveBeenCalledTimes(3);
    expect(result.current.utterances[3]).toMatchObject({ translating: false, failed: true });
    await act(async () => { requests.forEach(request => request.resolve('Done')); });
    await act(async () => { result.current.retry(result.current.utterances[3].id); });
    expect(result.current.utterances[3]).toMatchObject({ failed: false, translation: 'Translated: Turn 3.' });
  });

  it('marks failed translations for retry, and locks duplicate retries', async () => {
    translateInterpreterText.mockRejectedValueOnce(new Error('Translation quota reached'));
    const { result } = await setup();
    await start(result);
    await final('Hello.');
    expect(result.current.error).toBe('Translation quota reached');
    expect(result.current.utterances[0].failed).toBe(true);
    await act(async () => { const id = result.current.utterances[0].id; result.current.retry(id); result.current.retry(id); });
    expect(translateInterpreterText).toHaveBeenCalledTimes(2);
    expect(result.current.utterances[0].failed).toBe(false);
  });

  it.each(['stop', 'clear'])('%s aborts translation jobs and ignores late results', async action => {
    const pending = deferred();
    translateInterpreterText.mockReturnValueOnce(pending.promise);
    const { result } = await setup();
    await start(result);
    await final('Hello.');
    const signal = translateInterpreterText.mock.calls[0][1].signal;
    act(() => result.current[action]());
    expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve('Too late'));
    if (action === 'clear') expect(result.current.utterances).toEqual([]);
    else expect(result.current.utterances[0]).toMatchObject({ translation: null, failed: true, translating: false });
  });

  it('bounds transcript memory and ignores invalid or oversized final text', async () => {
    const { result } = await setup();
    act(() => result.current.setSubtitleOnly(true));
    await start(result);
    act(() => {
      for (let index = 0; index < MAX_UTTERANCES + 2; index++) audio().onFinal({ text: `Turn ${index}.`, lang: 'en', speechFinal: true });
      audio().onFinal({ text: 'Ignore', lang: 'fr' });
      audio().onFinal({ text: 'x'.repeat(5001), lang: 'en' });
    });
    expect(result.current.utterances).toHaveLength(MAX_UTTERANCES);
    expect(result.current.utterances[0].text).toBe('Turn 2.');
    expect(result.current.error).toMatch(/5,000/);
  });

  it('omits glossary when private and discards capture, transcript, and glossary on privacy changes', async () => {
    const { result, rerender } = await setup(false);
    const glossary = { ...emptyGlossary(), vocabulary: [{ value: 'Bonjou', pronunciations: [] }] };
    act(() => result.current.setGlossary(glossary));
    await start(result);
    await audio().createSession({ provider: 'gladia', sample_rate: 48000 });
    expect(createInterpreterSession.mock.calls[0][0]).toMatchObject({ privacy_mode: false, glossary: { vocabulary: [{ value: 'Bonjou' }] } });
    await final('Hello.');
    const signal = audio().signal;
    rerender({ privacyMode: true });
    expect(signal.aborted).toBe(true);
    expect(result.current.utterances).toEqual([]);
    expect(result.current.glossary).toEqual(emptyGlossary());
    expect(result.current.status).toBe('idle');
    act(() => result.current.setGlossary(glossary));
    expect(result.current.glossary.vocabulary).toEqual([]);
    await start(result);
    await audio().createSession({ provider: 'deepgram' });
    expect(createInterpreterSession.mock.calls[1][0]).toEqual({ provider: 'deepgram', privacy_mode: true });
    expect(localStorage.length).toBe(0);
  });
});

describe('Interpreter pure rules', () => {
  it('has explicit target-language fallbacks', () => {
    expect(targetLanguage('ht', true)).toBe('en');
    expect(targetLanguage('ht', false, 'es')).toBe('es');
    expect(targetLanguage('es', false)).toBe('en');
  });
  it('explains the required provider for each selected language/mode', () => {
    expect(interpreterAvailability({ ...configured, transcription: { deepgram: false } }, {})).toMatch(/DEEPGRAM_API_KEY/);
    expect(interpreterAvailability({ ...configured, transcription: { gladia: false } }, { captureKreyol: true })).toMatch(/GLADIA_API_KEY/);
    expect(interpreterAvailability({ ...configured, translation: { deepl: false } }, { htMode: false })).toMatch(/DEEPL_API_KEY/);
  });
  it('normalizes and bounds a session-only glossary', () => {
    expect(validateGlossary(emptyGlossary())).toEqual(emptyGlossary());
    expect(validateGlossary({ ...emptyGlossary(), vocabulary: [{ value: ' Bonjou ', pronunciations: [] }] }).vocabulary[0].value).toBe('Bonjou');
    for (const value of ['', 'x'.repeat(161), 'bad\u0000term']) {
      expect(() => validateGlossary({ ...emptyGlossary(), vocabulary: [{ value }] })).toThrow(/Glossary terms/);
    }
    expect(() => validateGlossary({ ...emptyGlossary(), defaultIntensity: NaN })).toThrow(/intensity/);
    expect(() => validateGlossary({ ...emptyGlossary(), spelling: [{ value: 'word', variants: [] }] })).toThrow(/at least one/);
  });
});
