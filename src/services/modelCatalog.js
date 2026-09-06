import { readStored } from './chatState.js';

// Offline fallback; /models is authoritative once the updated backend is available.
export const FALLBACK_CATALOG = {
  Gemini: { default_model: 'gemini-3.8-flash', image_model: 'gemini-3.1-flash-image', models: [
    { value: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
    { value: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash' },
    { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
    { value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite' },
    { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Preview)' },
  ] },
  GPT: { default_model: 'gpt-5.6-terra', image_model: 'gpt-image-2', models: [
    { value: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' },
    { value: 'gpt-5.6-terra', label: 'GPT-5.6 Terra' },
    { value: 'gpt-5.6-luna', label: 'GPT-5.6 Luna' },
  ] },
  Claude: { default_model: 'claude-opus-5', image_model: null, models: [
    { value: 'claude-opus-5', label: 'Claude Opus 5' },
    { value: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  ] },
};
export const MODEL_STORAGE = { Gemini: 'Model', GPT: 'ModelGPT', Claude: 'ModelClaude' };
export function initialModels() {
  return Object.fromEntries(Object.entries(FALLBACK_CATALOG).map(([provider, config]) => {
    const saved = readStored(MODEL_STORAGE[provider], '');
    return [provider, config.models.some(m => m.value === saved) ? saved : config.default_model];
  }));
}
