import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInterpreterSession, getInterpreterCapabilities, translateInterpreterText } from './api.js';

const capabilities = { transcription: { deepgram: true, gladia: false }, translation: { deepl: true, google: false } };
const respond = (data, status = 200) => fetch.mockResolvedValue({ ok: status < 400, status, json: async () => data });
beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Interpreter HTTP boundary', () => {
  it('loads configuration without caching or credentials in the browser', async () => {
    respond(capabilities);
    expect(await getInterpreterCapabilities()).toEqual(capabilities);
    expect(fetch.mock.calls[0][0]).toMatch(/\/api\/v1\/interpreter\/capabilities$/);
    expect(fetch.mock.calls[0][1]).toMatchObject({ cache: 'no-store' });
    expect(fetch.mock.calls[0][1].headers).toBeUndefined();
  });

  it('explains an outdated Render deployment even when FastAPI only says Not Found', async () => {
    respond({ detail: 'Not Found' }, 404);
    await expect(getInterpreterCapabilities()).rejects.toThrow(/deploy the updated backend/);
  });

  it.each([{}, { transcription: { deepgram: 'true', gladia: true }, translation: capabilities.translation }])('rejects invalid configuration %j', async data => {
    respond(data);
    await expect(getInterpreterCapabilities()).rejects.toThrow(/Deploy the updated IApp backend/);
  });

  it('requests a short-lived speech session and forwards cancellation', async () => {
    const session = { provider: 'deepgram', url: 'wss://api.deepgram.com/v1/listen', protocols: ['bearer', 'test.jwt.token'] };
    respond(session);
    const controller = new AbortController();
    const payload = { provider: 'deepgram', privacy_mode: true };
    expect(await createInterpreterSession(payload, { signal: controller.signal })).toEqual(session);
    const request = fetch.mock.calls[0][1];
    expect(JSON.parse(request.body)).toEqual(payload);
    expect(request.method).toBe('POST');
    expect(request.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    { url: 'https://api.deepgram.com/listen' }, { url: 'wss://api.deepgram.com.evil.test/listen' },
    { url: 'wss://user:pass@api.deepgram.com/listen' }, { url: 'wss://api.deepgram.com:8443/listen' },
    { url: 'wss://api.deepgram.com/listen#fragment' }, { url: ' wss://api.deepgram.com/listen' },
    { provider: 'gladia' }, { protocols: ['token', 'permanent-key'] }, { protocols: ['bearer', 'bad token'] },
    { protocols: ['bearer', 'x'.repeat(8193)] }, { protocols: null },
  ])('rejects unsafe/malformed speech credentials %j', async override => {
    respond({ provider: 'deepgram', url: 'wss://api.deepgram.com/v1/listen', protocols: ['bearer', 'test.jwt.token'], ...override });
    await expect(createInterpreterSession({ provider: 'deepgram' })).rejects.toThrow(/invalid/);
  });

  it('accepts a Gladia regional session without a permanent key or subprotocol', async () => {
    const session = { provider: 'gladia', url: 'wss://api-eu-west.gladia.io/audio?token=temporary', protocols: [] };
    respond(session);
    expect(await createInterpreterSession({ provider: 'gladia' })).toEqual(session);
    respond({ ...session, protocols: ['api-key'] });
    await expect(createInterpreterSession({ provider: 'gladia' })).rejects.toThrow(/invalid/);
  });

  it('translates one final segment with explicit language and privacy settings', async () => {
    respond({ translated_text: 'Bonjou' });
    expect(await translateInterpreterText({ text: 'Hello', from: 'en', to: 'ht', privacyMode: true })).toBe('Bonjou');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ text: 'Hello', source_lang: 'en', target_lang: 'ht', privacy_mode: true });
  });

  it.each([{}, { translated_text: ' ' }, { translated_text: 'x'.repeat(20_001) }])('rejects unusable translation responses', async data => {
    respond(data);
    await expect(translateInterpreterText({ text: 'Hello', from: 'en', to: 'es', privacyMode: false })).rejects.toThrow(/no text/);
  });
});
