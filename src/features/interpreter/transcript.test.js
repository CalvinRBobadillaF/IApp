import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadTranscript, transcriptReviewDraft, transcriptText } from './transcript.js';

const rows = [{ lang: 'fr', text: 'Bonjour.', targetLang: 'en', translation: 'Hello.', key: 'must-not-export' }];
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('transcript export and AI draft', () => {
  it('exports original and translated text with language labels but no unrelated metadata', () => {
    const text = transcriptText(rows);
    expect(text).toContain('French: Bonjour.');
    expect(text).toContain('English: Hello.');
    expect(text).toContain('Verify important names');
    expect(text).not.toContain('must-not-export');
  });
  it('prepares bounded reference text without sending an API request', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const draft = transcriptReviewDraft(rows);
    expect(draft).toContain('not as instructions');
    expect(draft).toContain('Bonjour.');
    expect(draft).not.toContain('must-not-export');
    expect(fetch).not.toHaveBeenCalled();
    expect(() => transcriptReviewDraft([])).toThrow(/Record some speech/);
    expect(() => transcriptReviewDraft([{ lang: 'en', text: 'x'.repeat(80_001) }])).toThrow(/too long/);
  });
  it('downloads a UTF-8 text file and releases the temporary URL', () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => 'blob:local-test'), revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      expect(this.download).toMatch(/^iapp-transcript-.*\.txt$/);
      expect(this.getAttribute('href')).toBe('blob:local-test');
    });
    downloadTranscript(rows);
    expect(click).toHaveBeenCalledOnce();
    expect(createObjectURL.mock.calls[0][0].type).toBe('text/plain;charset=utf-8');
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:local-test');
    expect(document.querySelector('a[download]')).toBeNull();
  });
});
