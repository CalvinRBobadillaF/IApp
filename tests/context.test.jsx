import { useContext } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ContextProvider from '../src/Context/Context.jsx';
import { Context } from '../src/Context/context.js';
import { sendPrompt } from '../src/services/router.js';
import { getModelCatalog } from '../src/services/apiClient.js';
import { FALLBACK_CATALOG } from '../src/services/modelCatalog.js';
import { STORAGE_KEYS } from '../src/services/chatState.js';
import { DEEPGRAM_LOCAL_KEY } from '../src/services/interpreterCredentials.js';

vi.mock('../src/services/router.js', () => ({ sendPrompt: vi.fn() }));
vi.mock('../src/services/apiClient.js', () => ({ getModelCatalog: vi.fn() }));

const answer = { text: 'Answer with `code`.', images: [], warnings: [], model: 'test-model' };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
async function setup({ normal = false } = {}) {
  if (normal) localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({ privacyMode: false, saveHistory: true }));
  const hook = renderHook(() => useContext(Context), { wrapper: ContextProvider });
  await act(async () => {});
  return hook;
}
async function send(result, text) { await act(async () => { await result.current.onSent(text); }); }

beforeEach(() => {
  localStorage.clear();
  sendPrompt.mockReset().mockResolvedValue(answer);
  getModelCatalog.mockReset().mockResolvedValue(FALLBACK_CATALOG);
});
afterEach(cleanup);

describe('conversation and privacy boundaries', () => {
  it('does not silently finish Clear IApp data if deleting a remembered credential fails', async () => {
    const { result } = await setup();
    act(() => result.current.completeLogin('Test user'));
    localStorage.setItem(DEEPGRAM_LOCAL_KEY, 'fake-key');
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('Denied'); });
    act(() => result.current.resetStorage());
    expect(result.current.signedIn).toBe(true);
    expect(result.current.storageWarning).toMatch(/No reset was performed/);
    expect(localStorage.getItem(DEEPGRAM_LOCAL_KEY)).toBe('fake-key');
  });
  it('Clear IApp data removes an opted-in Interpreter key without touching unrelated site data', async () => {
    const { result } = await setup();
    localStorage.setItem(DEEPGRAM_LOCAL_KEY, 'test-key');
    localStorage.setItem('unrelated', 'keep');
    act(() => result.current.resetStorage());
    expect(localStorage.getItem(DEEPGRAM_LOCAL_KEY)).toBeNull();
    expect(localStorage.getItem('unrelated')).toBe('keep');
  });
  it('creates the first normal turn atomically and sends raw code plus paired context on follow-up', async () => {
    const { result } = await setup({ normal: true });
    const code = 'Review:\n```js\nconst n = 1;\n```';
    await send(result, code);
    expect(result.current.currentChat.messages).toHaveLength(2);
    await send(result, 'What should I change?');
    expect(sendPrompt.mock.calls[1][0].history).toEqual([
      { role: 'user', text: code, attachments: [] },
      { role: 'assistant', text: answer.text, attachments: [] },
    ]);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.chats)).Gemini[0].messages).toHaveLength(4);
  });

  it('defaults to private, excludes prior turns and custom instructions, and never saves private text', async () => {
    const { result } = await setup();
    act(() => result.current.setInstructions('Private preference'));
    await send(result, 'Private question');
    await send(result, 'Private follow-up');
    expect(sendPrompt.mock.calls[1][0]).toMatchObject({ privacy_mode: true, history: [], instructions: '' });
    expect(result.current.currentChat.messages).toHaveLength(4);
    expect(localStorage.getItem(STORAGE_KEYS.chats)).not.toContain('Private');
    expect(localStorage.getItem(STORAGE_KEYS.settings)).not.toContain('preference');
  });

  it('isolates private sessions and preserves earlier normal chats when switching modes', async () => {
    const { result } = await setup({ normal: true });
    act(() => result.current.setInstructions('Answer in Spanish'));
    await send(result, 'Normal chat');
    const normalId = result.current.currentChatId;
    expect(sendPrompt.mock.calls[0][0].instructions).toBe('Answer in Spanish');
    act(() => result.current.setPrivacyMode(true));
    expect(result.current.chats).toEqual([]);
    await send(result, 'Secret session');
    expect(sendPrompt.mock.calls[1][0].history).toEqual([]);
    act(() => result.current.setPrivacyMode(false));
    expect(result.current.chats.map(chat => chat.id)).toEqual([normalId]);
    act(() => result.current.setPrivacyMode(true));
    expect(result.current.chats).toEqual([]);
  });

  it('removes saved normal history immediately when saving is disabled and does not reload it', async () => {
    const { result, unmount } = await setup({ normal: true });
    await send(result, 'Stored question');
    act(() => result.current.setSaveHistory(false));
    expect(localStorage.getItem(STORAGE_KEYS.chats)).toBeNull();
    expect(result.current.chats).toHaveLength(1);
    unmount();
    const next = await setup();
    expect(next.result.current.chats).toEqual([]);
  });

  it('works with denied browser storage, including login and an API reply', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Denied'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('Denied'); });
    const { result } = await setup();
    act(() => result.current.completeLogin('  Alex  '));
    expect(result.current.signedIn).toBe(true);
    expect(result.current.userName).toBe('Alex');
    await send(result, 'Hello');
    expect(result.current.currentChat.messages).toHaveLength(2);
    expect(result.current.storageWarning).toMatch(/storage is unavailable/);
  });
});

describe('request lifecycle', () => {
  it('prepares a new AI review draft without sending it and preserves the earlier chat', async () => {
    const { result } = await setup();
    await send(result, 'Earlier conversation');
    const previousId = result.current.currentChatId;
    sendPrompt.mockClear();
    act(() => result.current.setActiveSection('interpreter'));
    act(() => result.current.openChatDraft('Review this transcript: Bonjour.'));
    expect(result.current.activeSection).toBe('chat');
    expect(result.current.userPrompt).toContain('Bonjour.');
    expect(result.current.currentChatId).not.toBe(previousId);
    expect(result.current.chats.some(chat => chat.id === previousId)).toBe(true);
    expect(sendPrompt).not.toHaveBeenCalled();
  });
  it('does not overwrite an unsent draft when replacement is declined', async () => {
    const { result } = await setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    act(() => { result.current.setUserPrompt('Keep my draft'); result.current.setActiveSection('interpreter'); });
    let changed;
    act(() => { changed = result.current.openChatDraft('Replacement transcript'); });
    expect(changed).toBe(false);
    expect(result.current.userPrompt).toBe('Keep my draft');
    expect(result.current.activeSection).toBe('interpreter');
  });
  it('preserves a chat draft and history across tool navigation', async () => {
    const { result } = await setup({ normal: true });
    await send(result, 'Keep this conversation');
    const chatId = result.current.currentChatId;
    act(() => { result.current.setUserPrompt('Unsent draft'); result.current.setOpenSidebar(true); result.current.setOpenModal(true); });
    act(() => result.current.setActiveSection('tools'));
    expect(result.current).toMatchObject({ activeSection: 'tools', currentChatId: chatId, userPrompt: 'Unsent draft', openSidebar: false, openModal: false });
    act(() => result.current.setActiveSection('interpreter'));
    act(() => result.current.loadChat(chatId));
    expect(result.current.activeSection).toBe('chat');
    expect(result.current.currentChat.messages).toHaveLength(2);
    act(() => result.current.setActiveSection('invalid'));
    expect(result.current.activeSection).toBe('chat');
  });

  it('cancels pending chat work on tool navigation and ignores late replies', async () => {
    const request = deferred();
    sendPrompt.mockReturnValue(request.promise);
    const { result } = await setup();
    let running;
    act(() => { running = result.current.onSent('Pending'); });
    const signal = sendPrompt.mock.calls[0][1].signal;
    act(() => result.current.setActiveSection('tools'));
    expect(signal.aborted).toBe(true);
    await act(async () => { request.resolve(answer); await running; });
    expect(result.current.activeSection).toBe('tools');
    expect(result.current.currentChat.messages).toHaveLength(1);
    act(() => result.current.newChat());
    expect(result.current.activeSection).toBe('chat');
  });
  it('locks immediately against same-tick duplicate sends', async () => {
    const request = deferred();
    sendPrompt.mockReturnValue(request.promise);
    const { result } = await setup();
    let first;
    act(() => { first = result.current.onSent('Once'); void result.current.onSent('Duplicate'); });
    expect(sendPrompt).toHaveBeenCalledTimes(1);
    await act(async () => { request.resolve(answer); await first; });
    expect(result.current.currentChat.messages).toHaveLength(2);
  });

  it('aborts an in-flight request when privacy changes and ignores its late response', async () => {
    const request = deferred();
    sendPrompt.mockReturnValue(request.promise);
    const { result } = await setup({ normal: true });
    let running;
    act(() => { running = result.current.onSent('Old normal request'); });
    const signal = sendPrompt.mock.calls[0][1].signal;
    act(() => result.current.setPrivacyMode(true));
    expect(signal.aborted).toBe(true);
    await act(async () => { request.resolve(answer); await running; });
    expect(result.current.currentChat).toBeNull();
    expect(result.current.chats).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('never resurrects a deleted chat when its response arrives', async () => {
    const request = deferred();
    sendPrompt.mockReturnValue(request.promise);
    const { result } = await setup();
    let running;
    act(() => { running = result.current.onSent('Delete me'); });
    act(() => result.current.deleteChat(result.current.currentChatId));
    await act(async () => { request.resolve(answer); await running; });
    expect(result.current.chats).toEqual([]);
    expect(result.current.currentChat).toBeNull();
  });

  it('does not let an old cancelled request clear a newer pending request', async () => {
    const oldRequest = deferred(), nextRequest = deferred();
    sendPrompt.mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(nextRequest.promise);
    const { result } = await setup();
    let oldRun, nextRun;
    act(() => { oldRun = result.current.onSent('Old'); });
    act(() => result.current.newChat());
    act(() => { nextRun = result.current.onSent('New'); });
    await act(async () => { oldRequest.resolve(answer); await oldRun; });
    expect(result.current.loading).toBe(true);
    expect(result.current.currentChat.messages[0].text).toBe('New');
    await act(async () => { nextRequest.resolve(answer); await nextRun; });
    expect(result.current.loading).toBe(false);
    expect(result.current.currentChat.messages).toHaveLength(2);
  });

  it('restores failed text/files for retry and excludes the failed turn from context', async () => {
    sendPrompt.mockRejectedValueOnce(new Error('Quota reached'));
    const { result } = await setup({ normal: true });
    await act(async () => { await result.current.addAttachments([new File(['hello'], 'notes.txt')]); });
    await send(result, 'Review this');
    expect(result.current.userPrompt).toBe('Review this');
    expect(result.current.attachments[0].name).toBe('notes.txt');
    expect(result.current.currentChat.messages[0].status).toBe('failed');
    await send(result);
    expect(sendPrompt.mock.calls[1][0].history).toEqual([]);
    expect(result.current.error).toBe('');
  });
});

describe('files, images, and model choices', () => {
  it('accepts file-only messages, sends inline bytes, and retains files in normal in-memory context', async () => {
    const { result } = await setup({ normal: true });
    await act(async () => { await result.current.addAttachments([new File(['const x = 2;'], 'sample.js')]); });
    await send(result, '');
    expect(sendPrompt.mock.calls[0][0].attachments).toEqual([
      { name: 'sample.js', mime_type: 'text/plain', data: btoa('const x = 2;') },
    ]);
    await send(result, 'Explain that file');
    expect(sendPrompt.mock.calls[1][0].history[0].attachments).toHaveLength(1);
    expect(localStorage.getItem(STORAGE_KEYS.chats)).not.toContain(btoa('const x = 2;'));
  });

  it('rejects too many or unsupported files without partially attaching them', async () => {
    const { result } = await setup();
    await act(async () => { await result.current.addAttachments(Array.from({ length: 5 }, (_, i) => new File(['x'], `${i}.txt`))); });
    expect(result.current.attachmentError).toMatch(/up to 4/);
    expect(result.current.attachments).toEqual([]);
    await act(async () => { await result.current.addAttachments([new File(['zip'], 'book.xlsx')]); });
    expect(result.current.attachmentError).toMatch(/CSV/);
    expect(result.current.attachments).toEqual([]);
  });

  it.each(['Gemini', 'GPT'])('routes %s image mode and keeps image-only replies valid for text follow-ups', async provider => {
    const generated = { mime_type: 'image/png', data: 'iVBORw0KGgo=' };
    sendPrompt.mockResolvedValueOnce({ ...answer, text: '', images: [generated], model: FALLBACK_CATALOG[provider].image_model });
    const { result } = await setup({ normal: true });
    act(() => result.current.setModelFeature(provider));
    act(() => result.current.setMode('image'));
    await send(result, 'Create a blue mountain landscape');
    expect(sendPrompt.mock.calls[0][0]).toMatchObject({ provider, mode: 'image', attachments: [] });
    expect(result.current.currentChat.messages[1].images).toEqual([generated]);
    expect(localStorage.getItem(STORAGE_KEYS.chats)).not.toContain(generated.data);
    act(() => result.current.setMode('chat'));
    await send(result, 'Describe the requested style');
    expect(sendPrompt.mock.calls[1][0].history[1].text).toMatch(/image.*not included/i);
    expect(result.current.contextNotice).toMatch(/Generated images are not included/);
  });

  it('does not allow Claude image creation or attachments in image mode', async () => {
    const { result } = await setup();
    act(() => result.current.setModelFeature('Claude'));
    act(() => result.current.setMode('image'));
    expect(result.current.mode).toBe('chat');
    expect(result.current.error).toMatch(/cannot generate/);
    act(() => result.current.setModelFeature('GPT'));
    await act(async () => { await result.current.addAttachments([new File(['x'], 'notes.txt')]); });
    act(() => result.current.setMode('image'));
    await send(result, 'Draw something');
    expect(sendPrompt).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/remove file attachments/);
  });

  it('retains model preferences across providers and resets mode for a new chat', async () => {
    const { result } = await setup();
    const model = FALLBACK_CATALOG.GPT.models[0].value;
    act(() => result.current.setSelectedModel('GPT', model));
    act(() => result.current.setModelFeature('GPT'));
    act(() => result.current.setMode('image'));
    act(() => result.current.newChat());
    expect(result.current.mode).toBe('chat');
    act(() => result.current.setModelFeature('Gemini'));
    act(() => result.current.setModelFeature('GPT'));
    expect(result.current.selectedModels.GPT).toBe(model);
  });
});
