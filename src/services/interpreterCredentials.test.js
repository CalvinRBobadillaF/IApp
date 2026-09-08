import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEEPGRAM_LOCAL_KEY, readDeepgramCredential, removeSavedDeepgramKey, validateDeepgramKey } from './interpreterCredentials.js';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());
describe('explicit browser credential storage', () => {
  it('does not import old app_key or other provider keys', () => {
    localStorage.setItem('app_key', 'legacy-key');
    localStorage.setItem('gladia_key', 'other-provider');
    expect(readDeepgramCredential()).toEqual({ key: '', remembered: false, error: '' });
  });
  it('reads only the dedicated key and removes only that key', () => {
    localStorage.setItem(DEEPGRAM_LOCAL_KEY, 'example-key');
    localStorage.setItem('unrelated', 'keep');
    expect(readDeepgramCredential()).toEqual({ key: 'example-key', remembered: true, error: '' });
    expect(removeSavedDeepgramKey()).toBe(true);
    expect(localStorage.getItem(DEEPGRAM_LOCAL_KEY)).toBeNull();
    expect(localStorage.getItem('unrelated')).toBe('keep');
  });
  it.each([null, {}, '', '  ', 'Token example-key', 'Bearer example-key', '"example-key"', 'key\ninside', 'x'.repeat(8193)])('rejects malformed input without including it in errors', value => {
    expect(() => validateDeepgramKey(value)).toThrow('Enter a raw Deepgram API key, without quotes or a Token/Bearer prefix.');
  });
  it('allows a trimmed raw key without assuming a particular provider key prefix', () => {
    expect(validateDeepgramKey(' example-key_123 ')).toBe('example-key_123');
  });
  it('does not silently accept malformed persisted content', () => {
    localStorage.setItem(DEEPGRAM_LOCAL_KEY, 'invalid private data');
    const result = readDeepgramCredential();
    expect(result.key).toBe('');
    expect(result.remembered).toBe(true);
    expect(result.error).not.toContain('invalid private data');
  });
  it('reports unavailable storage safely and never claims removal succeeded', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('secret-value'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('secret-value'); });
    expect(readDeepgramCredential()).toMatchObject({ key: '', remembered: false });
    expect(readDeepgramCredential().error).not.toContain('secret-value');
    expect(removeSavedDeepgramKey()).toBe(false);
  });
});
