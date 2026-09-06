import { legacyTokensToText } from './messageFormat.js';

export const PROVIDERS = ['Gemini', 'GPT', 'Claude'];
export const emptyChats = () => ({ Gemini: [], GPT: [], Claude: [] });
export const STORAGE_KEYS = { settings: 'iapp.settings', chats: 'chatsByModel' };

export function readStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    try { return JSON.parse(raw); } catch { return raw; }
  } catch { return fallback; }
}

export function initialSettings() {
  const stored = readStored(STORAGE_KEYS.settings, {});
  return {
    privacyMode: typeof stored?.privacyMode === 'boolean' ? stored.privacyMode : true,
    saveHistory: typeof stored?.saveHistory === 'boolean' ? stored.saveHistory : true,
  };
}

export function normalizeChats(value) {
  return Object.fromEntries(PROVIDERS.map(provider => [provider,
    (Array.isArray(value?.[provider]) ? value[provider] : [])
      .filter(chat => chat && typeof chat.id === 'string' && Array.isArray(chat.messages) && !chat.private)
      .map(chat => ({ id: chat.id, private: false, messages: chat.messages
        .filter(message => message && ['user', 'assistant', 'model'].includes(message.role))
        .map(message => ({
          id: typeof message.id === 'string' ? message.id : crypto.randomUUID(),
          role: message.role === 'user' ? 'user' : 'assistant',
          text: typeof message.text === 'string' ? message.text : legacyTokensToText(message.tokens),
          status: message.status === 'pending' ? 'cancelled' : (message.status || 'complete'),
          attachments: Array.isArray(message.attachments) ? message.attachments
            .filter(file => file && typeof file.name === 'string')
            .map(file => ({ name: file.name, mime_type: file.mime_type, size: file.size })) : [],
          imagesOmitted: message.imagesOmitted === true,
        })),
      })),
  ]));
}

// Never serialize private chats or binary attachments/generated images into localStorage.
export function serializableChats(chatsByModel) {
  return Object.fromEntries(PROVIDERS.map(provider => [provider,
    chatsByModel[provider].filter(chat => !chat.private).map(chat => ({
      id: chat.id, private: false,
      messages: chat.messages.map(message => ({
        id: message.id, role: message.role, text: message.text,
        status: message.status === 'pending' ? 'cancelled' : message.status,
        attachments: (message.attachments || []).map(({ name, mime_type, size }) => ({ name, mime_type, size })),
        imagesOmitted: Boolean(message.images?.length || message.imagesOmitted),
      })),
    })),
  ]));
}

export function chatsReducer(state, action) {
  if (action.type === 'clear') return emptyChats();
  if (action.type === 'discardPrivate') return Object.fromEntries(PROVIDERS.map(p => [p, state[p].filter(c => !c.private)]));
  const chats = state[action.provider];
  if (!chats) return state;
  if (action.type === 'delete') return { ...state, [action.provider]: chats.filter(c => c.id !== action.chatId) };
  if (action.type === 'new') return { ...state, [action.provider]: [...chats, action.chat] };
  if (action.type === 'send') {
    const found = chats.some(c => c.id === action.chatId);
    return { ...state, [action.provider]: found
      ? chats.map(c => c.id === action.chatId ? { ...c, messages: [...c.messages, action.message] } : c)
      : [...chats, { id: action.chatId, private: action.private, messages: [action.message] }] };
  }
  if (action.type === 'finish') {
    return { ...state, [action.provider]: chats.map(c => c.id === action.chatId ? { ...c,
      messages: [...c.messages.map(m => m.id === action.userId ? { ...m, status: action.status } : m),
        ...(action.message ? [action.message] : [])],
    } : c) };
  }
  return state;
}

const MAX_HISTORY_CHARS = 100_000;
const MAX_TOTAL_BYTES = 12 * 1024 * 1024;
export const attachmentPayload = ({ name, mime_type, data }) => ({ name, mime_type, data });

// Keep complete turns; drop oldest pairs when the application context budget is reached.
export function buildHistory(messages, { privacyMode, attachments = [], mode = 'chat' }) {
  if (privacyMode) return { history: [], notice: '' };
  const pairs = [];
  for (let i = 0; i < messages.length - 1; i++) {
    const user = messages[i];
    const answer = messages[i + 1];
    if (user.role === 'user' && user.status === 'complete' && answer.role === 'assistant') {
      pairs.push([user, answer]);
      i++;
    }
  }
  let bytes = attachments.reduce((sum, file) => sum + (file.size || Math.ceil(file.data.length * 3 / 4)), 0);
  let chars = 0;
  let truncated = false;
  let missingFiles = false;
  const history = [];
  for (const pair of pairs.reverse()) {
    const extraChars = pair.reduce((sum, m) => sum + m.text.length, 0);
    const files = pair.flatMap(m => m.attachments || []).filter(f => f.data);
    const extraBytes = mode === 'image' ? 0 : files.reduce((sum, f) => sum + (f.size || Math.ceil(f.data.length * 3 / 4)), 0);
    if (history.length + 2 > 40 || chars + extraChars > MAX_HISTORY_CHARS || bytes + extraBytes > MAX_TOTAL_BYTES) {
      truncated = true;
      break;
    }
    chars += extraChars;
    bytes += extraBytes;
    const normalized = pair.map(m => {
      const lost = (m.attachments || []).filter(f => !f.data || mode === 'image');
      if (lost.length) missingFiles = true;
      const suffix = lost.length ? `\n[Attachments not included in this request: ${lost.map(f => f.name).join(', ')}. Ask the user to reattach if needed.]` : '';
      return { role: m.role, text: m.text + suffix,
        attachments: mode === 'image' ? [] : (m.attachments || []).filter(f => f.data).map(attachmentPayload) };
    });
    history.unshift(...normalized);
  }
  return { history, notice: [truncated && 'Older turns were omitted to stay within the context limit.',
    missingFiles && 'Some earlier files are unavailable. Reattach them for analysis.'].filter(Boolean).join(' ') };
}
