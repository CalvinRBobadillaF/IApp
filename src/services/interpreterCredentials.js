// Explicitly opted-in browser credential, separate from chat data and legacy keys.
// No telemetry, encryption claim, automatic migration, or provider calls here.
export const DEEPGRAM_LOCAL_KEY = 'iapp.interpreter.deepgramKey.v1';

export function validateDeepgramKey(value) {
  const key = typeof value === 'string' ? value.trim() : '';
  if (!key || key.length > 8192 || !/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(key)) {
    throw new Error('Enter a raw Deepgram API key, without quotes or a Token/Bearer prefix.');
  }
  return key;
}

export function readDeepgramCredential() {
  try {
    const saved = localStorage.getItem(DEEPGRAM_LOCAL_KEY);
    if (saved === null) return { key: '', remembered: false, error: '' };
    try { return { key: validateDeepgramKey(saved), remembered: true, error: '' }; }
    catch { return { key: '', remembered: true, error: 'The saved Deepgram key is invalid. Remove it or enter a replacement.' }; }
  } catch {
    return { key: '', remembered: false, error: 'Browser storage is unavailable. You can enter a key for this session only.' };
  }
}

export function removeSavedDeepgramKey() {
  try { localStorage.removeItem(DEEPGRAM_LOCAL_KEY); return true; }
  catch { return false; }
}
