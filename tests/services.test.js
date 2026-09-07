import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildHistory, chatsReducer, emptyChats, initialSettings, normalizeChats,
  readStored, serializableChats, STORAGE_KEYS,
} from '../src/services/chatState.js';
import {
  ACCEPTED_FILE_TYPES, MAX_FILE_BYTES, readAttachment, validateFile,
} from '../src/services/attachments.js';
import { getModelCatalog, sendChatRequest } from '../src/services/apiClient.js';

const MiB = 1024 * 1024;
const message = (role, text, extra = {}) => ({
  id: `${role}-${text.slice(0, 10)}`, role, text, status: 'complete', attachments: [], ...extra,
});
const turn = (index, userExtra = {}, answerExtra = {}) => [
  message('user', `Question ${index}`, userExtra),
  message('assistant', `Answer ${index}`, answerExtra),
];
const attachment = (extra = {}) => ({
  id: 'upload-id', name: 'context.txt', mime_type: 'text/plain', size: 3, data: 'YWJj', ...extra,
});
const response = (status, data, jsonError = false) => ({
  ok: status >= 200 && status < 300,
  status,
  json: jsonError ? vi.fn().mockRejectedValue(new SyntaxError('Not JSON')) : vi.fn().mockResolvedValue(data),
});
const catalog = () => Object.fromEntries(['Gemini', 'GPT', 'Claude'].map(provider => [provider, {
  models: [{ value: `${provider}-chat`, label: `${provider} chat` }],
  default_model: `${provider}-chat`, image_model: provider === 'Claude' ? null : `${provider}-image`,
}]));

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('chat storage and migration', () => {
  it('uses private defaults and ignores malformed persisted setting types', () => {
    expect(initialSettings()).toEqual({ privacyMode: true, saveHistory: true });
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({ privacyMode: 'false', saveHistory: 0 }));
    expect(initialSettings()).toEqual({ privacyMode: true, saveHistory: true });
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({ privacyMode: false, saveHistory: false }));
    expect(initialSettings()).toEqual({ privacyMode: false, saveHistory: false });
  });

  it('reads legacy plain strings and survives blocked localStorage', () => {
    localStorage.setItem('User', 'Taylor');
    expect(readStored('User', '')).toBe('Taylor');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError'); });
    expect(readStored('User', 'fallback')).toBe('fallback');
    expect(initialSettings().privacyMode).toBe(true);
  });

  it('never persists private chats, binary files, or generated image bytes', () => {
    const state = { ...emptyChats(), GPT: [
      { id: 'private', private: true, messages: [message('user', 'private secret')] },
      { id: 'normal', private: false, messages: [
        message('user', 'Review', { attachments: [attachment({ data: 'sensitive-file-bytes' })], status: 'pending' }),
        message('assistant', '', { images: [{ mime_type: 'image/png', data: 'generated-image-bytes' }] }),
      ] },
    ] };
    const saved = serializableChats(state);
    const raw = JSON.stringify(saved);
    expect(saved.GPT).toHaveLength(1);
    expect(raw).not.toContain('private secret');
    expect(raw).not.toContain('sensitive-file-bytes');
    expect(raw).not.toContain('generated-image-bytes');
    expect(saved.GPT[0].messages[0]).toMatchObject({ status: 'cancelled', attachments: [
      { name: 'context.txt', mime_type: 'text/plain', size: 3 },
    ] });
    expect(saved.GPT[0].messages[1].imagesOmitted).toBe(true);
    expect(state.GPT[1].messages[0].status).toBe('pending');
  });

  it('migrates legacy model tokens while discarding corrupt chats and persisted binary content', () => {
    const saved = normalizeChats({ Gemini: [null, { id: 'invalid', messages: null },
      { id: 'private', private: true, messages: [] },
      { id: 'legacy', messages: [
        null, { role: 'system', text: 'untrusted role' },
        { role: 'user', text: 'Review this', status: 'pending', attachments: [null, attachment()] },
        { role: 'model', tokens: [{ type: 'code', language: 'js', content: 'const answer = 42;' }], imagesOmitted: true },
      ] },
    ], GPT: 'broken' });
    expect(saved.Gemini).toHaveLength(1);
    expect(saved.GPT).toEqual([]);
    expect(saved.Claude).toEqual([]);
    expect(saved.Gemini[0].messages).toHaveLength(2);
    expect(saved.Gemini[0].messages[0]).toMatchObject({ role: 'user', status: 'cancelled' });
    expect(saved.Gemini[0].messages[0].attachments[0]).not.toHaveProperty('data');
    expect(saved.Gemini[0].messages[1]).toMatchObject({
      role: 'assistant', text: '```js\nconst answer = 42;\n```', imagesOmitted: true,
    });
  });

  it('does not resurrect deleted chats when an old request finishes', () => {
    let state = chatsReducer(emptyChats(), {
      type: 'send', provider: 'GPT', chatId: 'chat', private: false,
      message: message('user', 'Pending', { status: 'pending' }),
    });
    state = chatsReducer(state, { type: 'delete', provider: 'GPT', chatId: 'chat' });
    state = chatsReducer(state, {
      type: 'finish', provider: 'GPT', chatId: 'chat', userId: 'user-Pending',
      status: 'complete', message: message('assistant', 'Too late'),
    });
    expect(state).toEqual(emptyChats());
  });

  it('discards private chats without deleting normal history from other providers', () => {
    const normal = { id: 'normal', private: false, messages: turn(1) };
    const state = { ...emptyChats(), Gemini: [{ id: 'private', private: true, messages: turn(2) }], GPT: [normal] };
    expect(chatsReducer(state, { type: 'discardPrivate' })).toEqual({ ...emptyChats(), GPT: [normal] });
  });
});

describe('conversation context budgets', () => {
  it('returns no prior context in privacy mode, including previous attachments', () => {
    expect(buildHistory(turn(1, { attachments: [attachment()] }), { privacyMode: true }))
      .toEqual({ history: [], notice: '' });
  });

  it('keeps complete turns with the original code and only API attachment fields', () => {
    const code = '```js\nconst value = `<tag>`;\n```';
    const result = buildHistory([
      message('user', code, { attachments: [attachment()] }), message('assistant', 'Looks correct.'),
    ], { privacyMode: false });
    expect(result.notice).toBe('');
    expect(result.history).toEqual([
      { role: 'user', text: code, attachments: [{ name: 'context.txt', mime_type: 'text/plain', data: 'YWJj' }] },
      { role: 'assistant', text: 'Looks correct.', attachments: [] },
    ]);
  });

  it('excludes failed, cancelled, pending, and orphaned turns', () => {
    const messages = [message('assistant', 'orphan'),
      ...turn(1, { status: 'failed' }), ...turn(2, { status: 'cancelled' }),
      ...turn(3, { status: 'pending' }), ...turn(4, {}, { status: 'failed' }),
      ...turn(5, {}, { status: 'cancelled' }), ...turn(6, {}, { status: 'pending' }),
      ...turn(7), message('user', 'unanswered'),
    ];
    const { history } = buildHistory(messages, { privacyMode: false });
    expect(history.map(item => item.text)).toEqual(['Question 7', 'Answer 7']);
  });

  it('keeps the latest 20 complete turns in chronological order', () => {
    const { history, notice } = buildHistory(Array.from({ length: 22 }, (_, i) => turn(i)).flat(), { privacyMode: false });
    expect(history).toHaveLength(40);
    expect(history[0].text).toBe('Question 2');
    expect(history.at(-1).text).toBe('Answer 21');
    expect(notice).toMatch(/older turns.*omitted/i);
  });

  it('trims whole oldest turns at the character budget', () => {
    const pair = index => [message('user', String(index).repeat(25_000)), message('assistant', 'x'.repeat(25_000))];
    const { history, notice } = buildHistory([...pair(1), ...pair(2), ...pair(3)], { privacyMode: false });
    expect(history).toHaveLength(4);
    expect(history[0].text).toBe('2'.repeat(25_000));
    expect(history.reduce((sum, item) => sum + item.text.length, 0)).toBeLessThanOrEqual(100_000);
    expect(notice).toMatch(/context limit/i);
  });

  it('accounts for current uploads before selecting historical files', () => {
    const messages = [
      ...turn(1, { attachments: [attachment({ name: 'old.pdf', size: 5 * MiB })] }),
      ...turn(2, { attachments: [attachment({ name: 'new.pdf', size: 5 * MiB })] }),
    ];
    const { history, notice } = buildHistory(messages, {
      privacyMode: false, attachments: [attachment({ size: 4 * MiB })],
    });
    expect(history.map(item => item.text)).toEqual(['Question 2', 'Answer 2']);
    expect(history[0].attachments[0].name).toBe('new.pdf');
    expect(notice).toMatch(/older turns.*omitted/i);
  });

  it('explicitly marks files lost after reload so the LLM cannot silently assume their contents', () => {
    const { history, notice } = buildHistory(turn(1, { attachments: [attachment({ data: undefined })] }), { privacyMode: false });
    expect(history[0].attachments).toEqual([]);
    expect(history[0].text).toContain('context.txt');
    expect(history[0].text).toMatch(/not included.*reattach/i);
    expect(notice).toMatch(/reattach/i);
  });

  it('counts attachment omission notes toward the text budget', () => {
    const messages = [message('user', 'q'.repeat(50_000), {
      attachments: [attachment({ name: 'context.txt', data: undefined })],
    }), message('assistant', 'a'.repeat(50_000))];
    const { history, notice } = buildHistory(messages, { privacyMode: false });
    expect(history).toEqual([]);
    expect(notice).toMatch(/context limit/i);
  });

  it('does not send historical attachments to text-to-image endpoints', () => {
    const { history, notice } = buildHistory(turn(1, { attachments: [attachment()] }), { privacyMode: false, mode: 'image' });
    expect(history.every(item => item.attachments.length === 0)).toBe(true);
    expect(history[0].text).toContain('context.txt');
    expect(notice).toMatch(/reattach|not included|unavailable/i);
  });

  it.each([{ images: [{ mime_type: 'image/png', data: 'bytes' }] }, { imagesOmitted: true }])(
    'supplies nonempty text and an honest omission notice after an image-only answer: %j', extra => {
      const { history, notice } = buildHistory([
        message('user', 'Draw a cat'), message('assistant', '', extra),
      ], { privacyMode: false });
      expect(history).toHaveLength(2);
      expect(history[1].text.trim()).not.toBe('');
      expect(history[1].text).toMatch(/image/i);
      expect(history[1]).not.toHaveProperty('images');
      expect(notice).toMatch(/image/i);
    },
  );
});

describe('attachment validation and reading', () => {
  it.each([
    ['report.PDF', 'application/pdf'], ['photo.JPG', 'image/jpeg'], ['photo.jpeg', 'image/jpeg'],
    ['photo.png', 'image/png'], ['photo.webp', 'image/webp'], ['main.tsx', 'text/plain'],
    ['notes.md', 'text/plain'], ['data.csv', 'text/plain'], ['script.ps1', 'text/plain'],
  ])('recognizes %s by extension', (name, mime) => {
    expect(validateFile({ name, size: 1, type: 'application/octet-stream' })).toBe(mime);
    expect(ACCEPTED_FILE_TYPES.split(',')).toContain(`.${name.split('.').at(-1).toLowerCase()}`);
  });

  it('accepts exact size and filename limits', () => {
    expect(validateFile({ name: `${'a'.repeat(176)}.txt`, size: MAX_FILE_BYTES })).toBe('text/plain');
  });

  it.each([
    [{ name: 'empty.txt', size: 0 }, /empty/i],
    [{ name: 'huge.pdf', size: MAX_FILE_BYTES + 1 }, /5 MB/i],
    [{ name: `${'a'.repeat(177)}.txt`, size: 1 }, /180 characters/i],
    [{ name: 'document.docx', size: 1 }, /export word as PDF/i],
    [{ name: 'workbook.xlsx', size: 1 }, /spreadsheets as CSV/i],
    [{ name: 'vector.svg', size: 1 }, /use PDF/i],
  ])('rejects unsupported upload %#', (file, expected) => {
    expect(() => validateFile(file)).toThrow(expected);
  });

  it('reads UTF-8 files as base64 with only local metadata added', async () => {
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    const result = await readAttachment(file);
    expect(result).toEqual({
      id: expect.any(String), name: 'notes.txt', mime_type: 'text/plain', size: 5, data: 'aGVsbG8=',
    });
  });
});

describe('API client failures and response validation', () => {
  it('posts structured payloads without caching and supplies optional arrays', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, { text: 'Hello' }));
    vi.stubGlobal('fetch', fetchMock);
    const payload = { provider: 'GPT', message: 'Hi', privacy_mode: true, history: [] };
    expect(await sendChatRequest(payload)).toEqual({ text: 'Hello', images: [], warnings: [] });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/v1\/chat$/);
    expect(options).toMatchObject({
      method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    [500, { detail: 'Provider temporarily unavailable' }, false, /Provider temporarily unavailable/],
    [422, { detail: [{ msg: 'File too large' }, { msg: 'Invalid model' }] }, false, /File too large; Invalid model/],
    [404, null, true, /ends in \/api\/v1.*updated backend/],
    [500, null, true, /HTTP 500.*backend logs/],
    [200, null, true, /unexpected response/i],
    [200, { images: [] }, false, /missing its text field/i],
  ])('explains HTTP %s response %#', async (status, data, jsonError, expected) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(status, data, jsonError)));
    await expect(sendChatRequest({})).rejects.toThrow(expected);
  });

  it('turns failed fetches into actionable connection errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(sendChatRequest({})).rejects.toThrow(/connection, backend URL, and allowed frontend origin/i);
  });

  it('propagates cancellation without converting it to a server failure', async () => {
    vi.stubGlobal('fetch', vi.fn((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
    })));
    const controller = new AbortController();
    const pending = sendChatRequest({}, { signal: controller.signal });
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await rejected;
  });

  it('passes an already cancelled signal to fetch', async () => {
    const fetchMock = vi.fn((_url, { signal }) => {
      expect(signal.aborted).toBe(true);
      return Promise.reject(new DOMException('Cancelled', 'AbortError'));
    });
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    controller.abort();
    await expect(sendChatRequest({}, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });

  it.each([
    ['chat', 180_000, () => sendChatRequest({})],
    ['catalog', 20_000, () => getModelCatalog()],
  ])('aborts %s at its configured timeout', async (_kind, timeout, request) => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
    })));
    const rejected = expect(request()).rejects.toThrow(/timed out.*waking up/i);
    await vi.advanceTimersByTimeAsync(timeout);
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('accepts an authoritative valid catalog', async () => {
    const data = catalog();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(200, data)));
    expect(await getModelCatalog()).toEqual(data);
  });

  it.each([
    data => { delete data.Claude; },
    data => { data.GPT.models = []; },
    data => { data.Gemini.models = [null]; },
    data => { data.GPT.models[0].value = ''; },
    data => { data.GPT.models[0].label = 42; },
    data => { data.GPT.default_model = 'not-listed'; },
    data => { data.GPT.image_model = { value: 'unexpected-object' }; },
  ])('rejects malformed catalog variant %#', async mutate => {
    const data = catalog();
    mutate(data);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(200, data)));
    await expect(getModelCatalog()).rejects.toThrow('Invalid model catalog');
  });
});
