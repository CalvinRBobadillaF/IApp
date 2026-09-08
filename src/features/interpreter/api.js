import { apiRequest } from '../../services/apiClient.js';

const post = (path, body, signal) => apiRequest(`/interpreter/${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body), signal, timeout: 35_000,
});

export async function getInterpreterCapabilities(signal) {
  const data = await apiRequest('/interpreter/capabilities', { signal, timeout: 20_000 });
  if (!['deepgram', 'gladia'].every(key => typeof data.transcription?.[key] === 'boolean') ||
      !['deepl', 'google'].every(key => typeof data.translation?.[key] === 'boolean')) {
    throw new Error('The Interpreter API is unavailable. Deploy the updated IApp backend.');
  }
  return data;
}

export async function createInterpreterSession(payload, { signal } = {}) {
  const data = await post('session', payload, signal);
  let url;
  try { url = new URL(data.url); } catch { throw new Error('The transcription service returned an invalid session.'); }
  const validHost = payload.provider === 'deepgram' ? url.hostname === 'api.deepgram.com'
    : payload.provider === 'gladia' && (url.hostname === 'gladia.io' || url.hostname.endsWith('.gladia.io'));
  if (url.protocol !== 'wss:' || url.username || url.password || url.hash || (url.port && url.port !== '443') ||
      !validHost || data.provider !== payload.provider || /\s/.test(data.url)) {
    throw new Error('The transcription service returned an invalid session.');
  }
  if (payload.provider === 'deepgram' && (!Array.isArray(data.protocols) || data.protocols.length !== 2 ||
      data.protocols[0] !== 'bearer' || typeof data.protocols[1] !== 'string' || data.protocols[1].length > 8192 ||
      !/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(data.protocols[1]))) {
    throw new Error('The transcription service returned an invalid temporary credential.');
  }
  if (payload.provider === 'gladia' && data.protocols != null && (!Array.isArray(data.protocols) || data.protocols.length)) {
    throw new Error('The transcription service returned an invalid session.');
  }
  return data;
}

export async function translateInterpreterText({ text, from, to, privacyMode }, { signal } = {}) {
  const data = await post('translate', { text, source_lang: from, target_lang: to, privacy_mode: privacyMode }, signal);
  if (typeof data.translated_text !== 'string' || !data.translated_text.trim() || data.translated_text.length > 20_000) {
    throw new Error('The translation provider returned no text. Please retry.');
  }
  return data.translated_text;
}
