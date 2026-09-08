import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App.jsx';
import ContextProvider from '../src/Context/Context.jsx';
import { FALLBACK_CATALOG } from '../src/services/modelCatalog.js';
import { getModelCatalog } from '../src/services/apiClient.js';
import { getInterpreterCapabilities } from '../src/features/interpreter/api.js';
import { startInterpreterAudio } from '../src/features/interpreter/audioCapture.js';

vi.mock('../src/services/apiClient.js', () => ({ getModelCatalog: vi.fn() }));
vi.mock('../src/features/interpreter/api.js', () => ({ getInterpreterCapabilities: vi.fn(), createInterpreterSession: vi.fn(), translateInterpreterText: vi.fn() }));
vi.mock('../src/features/interpreter/audioCapture.js', () => ({ startInterpreterAudio: vi.fn() }));

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('User', JSON.stringify('Local test'));
  getModelCatalog.mockResolvedValue(FALLBACK_CATALOG);
  getInterpreterCapabilities.mockResolvedValue({ transcription: { deepgram: true, gladia: true }, translation: { deepl: true, google: true } });
  startInterpreterAudio.mockReset().mockResolvedValue({ stop: vi.fn() });
});
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

describe.each(['Gemini', 'GPT', 'Claude'])('%s hub integration', provider => {
  it('keeps the theme, opens global settings, and stops Interpreter capture when returning to Chat', async () => {
    localStorage.setItem('ModelFeature', JSON.stringify(provider));
    render(<ContextProvider><App /></ContextProvider>);
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Tools', exact: true }));
    fireEvent.click(await screen.findByRole('button', { name: /Open Interpreter/i }));
    await screen.findByRole('heading', { name: 'Interpreter AI' });
    expect(screen.getByRole('main').classList.contains(`iapp-chat-${provider.toLowerCase()}`)).toBe(true);
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(dialog.closest('.iapp-overlay-theme').classList.contains(`iapp-chat-${provider.toLowerCase()}`)).toBe(true);
    expect(screen.getByText(/changing privacy mode stops listening/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Done', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Start listening' }));
    await screen.findByRole('button', { name: 'Stop listening' });
    const callbacks = startInterpreterAudio.mock.calls[0][0];
    const handle = await startInterpreterAudio.mock.results[0].value;
    fireEvent.click(screen.getByRole('button', { name: 'Chat', exact: true }));
    expect(callbacks.signal.aborted).toBe(true);
    expect(handle.stop).toHaveBeenCalledOnce();
    expect(screen.queryByRole('heading', { name: 'Interpreter AI' })).toBeNull();
    expect(screen.getByRole('main').classList.contains(`iapp-chat-${provider.toLowerCase()}`)).toBe(true);
  });
});
