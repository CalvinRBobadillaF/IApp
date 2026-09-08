import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Context } from '../../Context/context.js';
import Interpreter from './Interpreter.jsx';
import useInterpreter from './useInterpreter.js';

vi.mock('./useInterpreter.js', () => ({ default: vi.fn() }));

const available = () => ({ transcription: { deepgram: true, gladia: true }, translation: { deepl: true, google: true } });
const hookState = () => ({
  status: 'idle', source: 'mic', setSource: vi.fn(), captureKreyol: false, setCaptureKreyol: vi.fn(),
  htMode: false, setHtMode: vi.fn(), subtitleOnly: false, setSubtitleOnly: vi.fn(),
  utterances: [], interimText: '', interimLang: 'en', error: '', dismissError: vi.fn(),
  capabilities: available(), capabilitiesLoading: false, capabilitiesError: '', reloadCapabilities: vi.fn(),
  elapsedSeconds: 0, start: vi.fn(), stop: vi.fn(), clear: vi.fn(), retry: vi.fn(),
  glossary: { defaultIntensity: 0.4, vocabulary: [], spelling: [] }, setGlossary: vi.fn(), canStart: true,
});
let state;
beforeEach(() => { state = hookState(); useInterpreter.mockImplementation(() => state); });
afterEach(cleanup);

function setup(overrides = {}) {
  const context = { privacyMode: false, modelFeature: 'Gemini', openSidebar: false, setOpenSidebar: vi.fn(), setOpenModal: vi.fn(), ...overrides };
  const onBack = vi.fn();
  const view = render(<Context.Provider value={context}><Interpreter onBack={onBack} /></Context.Provider>);
  return { ...view, context, onBack };
}

describe('Interpreter workspace', () => {
  it.each(['Gemini', 'GPT', 'Claude'])('inherits the %s provider palette without starting audio', modelFeature => {
    const { container } = setup({ modelFeature });
    expect(container.querySelector(`.iapp-chat-${modelFeature.toLowerCase()}`)).toBeTruthy();
    expect(state.start).not.toHaveBeenCalled();
    expect(screen.getByText(/microphone and tab audio stay off until you start/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Start listening' }));
    expect(state.start).toHaveBeenCalledOnce();
  });

  it('opens IApp settings and navigation using the shared context', () => {
    const { context } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
    expect(context.setOpenModal).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle navigation' }));
    expect(context.setOpenSidebar).toHaveBeenCalledWith(true);
  });

  it('disables start and explains setup while checking capabilities', () => {
    Object.assign(state, { capabilities: null, capabilitiesLoading: true, canStart: false });
    setup();
    expect(screen.getByRole('button', { name: 'Start listening' }).disabled).toBe(true);
    expect(screen.getByText('Checking setup')).toBeTruthy();
    expect(screen.getByText('Checking interpreter configuration…')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each([
    [false, false, 'DEEPGRAM_API_KEY', 'DEEPL_API_KEY'],
    [false, true, 'DEEPGRAM_API_KEY', 'GOOGLE_TRANSLATE_API_KEY'],
    [true, false, 'GLADIA_API_KEY', 'GOOGLE_TRANSLATE_API_KEY'],
  ])('shows exact required backend keys for speaker=%s Kreyòl target=%s', (captureKreyol, htMode, speechKey, translationKey) => {
    Object.assign(state, { captureKreyol, htMode, capabilities: { transcription: {}, translation: {} }, canStart: false });
    setup();
    expect(screen.getByText(speechKey)).toBeTruthy();
    expect(screen.getByText(translationKey)).toBeTruthy();
    expect(screen.getByText('Setup needed')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start listening' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Recheck availability' }));
    expect(state.reloadCapabilities).toHaveBeenCalledOnce();
  });

  it('allows subtitles without a translation key and explains that no text is sent for translation', () => {
    Object.assign(state, { subtitleOnly: true, capabilities: { transcription: { deepgram: true }, translation: {} } });
    setup();
    expect(screen.getByRole('button', { name: 'Start listening' }).disabled).toBe(false);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByLabelText('Translation direction').disabled).toBe(true);
    expect(screen.getByText(/Subtitles only does not send text for translation/)).toBeTruthy();
  });

  it('presents stale or unreachable backend errors with a recovery action', () => {
    Object.assign(state, { capabilities: null, capabilitiesError: new Error('Interpreter endpoint not found.'), canStart: false });
    setup();
    expect(screen.getByRole('alert').textContent).toContain('updated IApp backend is deployed');
    expect(screen.getByText('Setup needed')).toBeTruthy();
  });

  it('sets input options while stopped and displays browser tab instructions', () => {
    state.source = 'tab';
    setup();
    fireEvent.change(screen.getByLabelText('Audio source'), { target: { value: 'mic' } });
    expect(state.setSource).toHaveBeenCalledWith('mic');
    fireEvent.change(screen.getByLabelText('Who is speaking?'), { target: { value: 'ht' } });
    expect(state.setCaptureKreyol).toHaveBeenCalledWith(true);
    fireEvent.change(screen.getByLabelText('Translation direction'), { target: { value: 'ht' } });
    expect(state.setHtMode).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Subtitles only' }));
    expect(state.setSubtitleOnly).toHaveBeenCalledWith(true);
    expect(screen.getByText(/Share tab audio/)).toBeTruthy();
  });

  it('shows adaptive translation for a Kreyòl speaker', () => {
    state.captureKreyol = true;
    setup();
    expect(screen.getByLabelText('Translation direction').disabled).toBe(true);
    expect(screen.getByLabelText('Translation direction').value).toBe('adaptive');
    expect(screen.getByText(/starting with English/)).toBeTruthy();
  });

  it.each([['starting', 'Cancel start'], ['listening', 'Stop listening']])('locks configuration during %s and permits cancellation', (status, action) => {
    Object.assign(state, { status, canStart: false });
    setup();
    expect(screen.getByLabelText('Audio source').disabled).toBe(true);
    expect(screen.getByLabelText('Who is speaking?').disabled).toBe(true);
    expect(screen.getByRole('checkbox', { name: 'Subtitles only' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Clear transcript' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: action }));
    expect(state.stop).toHaveBeenCalledOnce();
  });

  it('stops capture and discards the transcript before leaving', () => {
    const order = [];
    state.stop.mockImplementation(() => order.push('stop'));
    state.clear.mockImplementation(() => order.push('clear'));
    const { onBack } = setup();
    onBack.mockImplementation(() => order.push('back'));
    fireEvent.click(screen.getByRole('button', { name: 'Back to tools' }));
    expect(order).toEqual(['stop', 'clear', 'back']);
  });

  it('renders original and translated text safely, including interim and retry states', () => {
    Object.assign(state, { elapsedSeconds: 3661, interimText: 'Still talking', interimLang: 'es', utterances: [
      { id: 'ok', text: '<script>alert(1)</script>', lang: 'en', targetLang: 'es', translation: 'Hola', timestamp: '2026-09-07T10:00:00Z' },
      { id: 'working', text: 'Second turn', lang: 'es', targetLang: 'ht', translating: true },
      { id: 'failed', text: 'Please retry', lang: 'ht', targetLang: 'en', failed: true, timestamp: 'not-a-date' },
    ] });
    const { container } = setup();
    expect(screen.getByText('<script>alert(1)</script>')).toBeTruthy();
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText('Hola').lang).toBe('es');
    expect(screen.getByText('Translating…')).toBeTruthy();
    expect(within(screen.getByLabelText('Speech in progress')).getByText('Still talking')).toBeTruthy();
    expect(screen.getByLabelText('Session duration 01:01:01')).toBeTruthy();
    expect(container.querySelectorAll('time')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Retry translation: Please retry' }));
    expect(state.retry).toHaveBeenCalledWith('failed');
    fireEvent.click(screen.getByRole('button', { name: 'Clear transcript' }));
    expect(state.clear).toHaveBeenCalledOnce();
  });

  it('hides translation content in subtitle-only mode', () => {
    Object.assign(state, { subtitleOnly: true, utterances: [{ id: 'one', text: 'Hello', lang: 'en', targetLang: 'es', translation: 'Hola' }] });
    setup();
    expect(screen.getByText('Hello')).toBeTruthy();
    expect(screen.queryByText('Hola')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Translation' })).toBeNull();
  });

  it('shows dismissible errors and an honest privacy notice', () => {
    state.error = new Error('Microphone permission was denied.');
    setup({ privacyMode: true });
    expect(useInterpreter).toHaveBeenCalledWith({ privacyMode: true });
    expect(screen.getByRole('alert').textContent).toContain('Microphone permission was denied.');
    expect(screen.getByText(/Provider retention still applies/)).toBeTruthy();
    expect(screen.getByLabelText('Privacy mode on')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss interpreter error' }));
    expect(state.dismissError).toHaveBeenCalledOnce();
  });

  it('opens a read-only glossary in private mode and dismisses it without leaving the tool', () => {
    const { onBack } = setup({ privacyMode: true });
    fireEvent.click(screen.getByRole('button', { name: 'Kreyòl glossary' }));
    expect(screen.getByRole('dialog', { name: 'Kreyòl accuracy glossary' })).toBeTruthy();
    expect(screen.getByLabelText('Correct term').matches(':disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onBack).not.toHaveBeenCalled();
  });

  it('preserves glossary input focus when the workspace receives updates', () => {
    const { rerender, context, onBack } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Kreyòl glossary' }));
    const term = screen.getByLabelText('Correct term');
    term.focus();
    rerender(<Context.Provider value={{ ...context }}><Interpreter onBack={onBack} /></Context.Provider>);
    expect(document.activeElement).toBe(term);
  });

  it.each([
    { capabilitiesLoading: true, capabilitiesError: '' },
    { capabilitiesLoading: false, capabilitiesError: 'Backend unavailable.' },
  ])('permits local-key subtitles without waiting for the backend: %j', capabilityState => {
    Object.assign(state, { credentialMode: 'local', localKeyConfigured: true, subtitleOnly: true, backendRequired: false, capabilities: null, ...capabilityState });
    setup();
    expect(screen.getByRole('button', { name: 'Start listening' }).disabled).toBe(false);
    expect(screen.getByText('Ready · local key')).toBeTruthy();
    expect(screen.queryByText('Checking interpreter configuration…')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Start listening' }));
    expect(state.start).toHaveBeenCalledOnce();
  });

  it('explains a missing local key without requesting the server Deepgram variable', () => {
    Object.assign(state, { credentialMode: 'local', localKeyConfigured: false, subtitleOnly: true, backendRequired: false, canStart: false, capabilities: null });
    setup();
    expect(screen.getByRole('alert').textContent).toContain('Add an individual Deepgram key');
    expect(screen.queryByText('DEEPGRAM_API_KEY')).toBeNull();
    expect(screen.getByRole('button', { name: 'Start listening' }).disabled).toBe(true);
  });

  it('still requires the backend for translation when a local speech key is set', () => {
    Object.assign(state, { credentialMode: 'local', localKeyConfigured: true, backendRequired: true, capabilities: { transcription: {}, translation: {} }, canStart: false });
    setup();
    expect(screen.getByText('DEEPL_API_KEY')).toBeTruthy();
    expect(screen.queryByText('DEEPGRAM_API_KEY')).toBeNull();
    expect(screen.getByRole('button', { name: 'Start listening' }).disabled).toBe(true);
  });

  it('does not treat a configured local key as Gladia credentials', () => {
    Object.assign(state, { credentialMode: 'local', localKeyConfigured: true, captureKreyol: true, subtitleOnly: true, backendRequired: true, capabilities: { transcription: {}, translation: {} }, canStart: false });
    setup();
    expect(screen.getByText('GLADIA_API_KEY')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start listening' }).disabled).toBe(true);
  });
});
