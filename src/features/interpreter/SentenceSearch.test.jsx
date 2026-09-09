import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SentenceSearch from './SentenceSearch.jsx';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const mockClipboard = clipboard => vi.stubGlobal('navigator', { clipboard });
const translation = 'The appointment is tomorrow. Please bring the complete report.';
function setup(overrides = {}) {
  const props = { translation, language: 'en', provider: 'Gemini', privacyMode: true, busy: false, onClose: vi.fn(), onPrepare: vi.fn(), ...overrides };
  return { ...render(<SentenceSearch {...props} />), props };
}

describe('sentence search preview', () => {
  it('previews a full sentence and prepares only the selected sentence and custom question', () => {
    const { props } = setup();
    expect(screen.getByRole('dialog', { name: 'Search with AI' })).toBeTruthy();
    expect(screen.getByLabelText('Selected translation').textContent).toBe('The appointment is tomorrow.');
    fireEvent.change(screen.getByLabelText('Text to explore'), { target: { value: '1' } });
    expect(screen.getByLabelText('Selected translation').textContent).toBe('Please bring the complete report.');
    fireEvent.change(screen.getByLabelText('What would you like to know? (optional)'), { target: { value: 'What might a complete report include?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open Chat draft' }));
    expect(props.onPrepare).toHaveBeenCalledOnce();
    const draft = props.onPrepare.mock.calls[0][0];
    expect(draft).toContain('Please bring the complete report.');
    expect(draft).toContain('What might a complete report include?');
    expect(draft).not.toContain('The appointment is tomorrow.');
  });

  it('can choose all sentences without truncating the full translation', () => {
    const { props } = setup();
    fireEvent.change(screen.getByLabelText('Text to explore'), { target: { value: 'all' } });
    expect(screen.getByLabelText('Selected translation').textContent).toBe(translation);
    fireEvent.click(screen.getByRole('button', { name: 'Open Chat draft' }));
    expect(props.onPrepare.mock.calls[0][0]).toContain(translation);
  });

  it('keeps the entire text when sentence segmentation is unavailable', () => {
    vi.spyOn(Intl, 'Segmenter').mockImplementation(() => { throw new Error('Unavailable'); });
    const { props } = setup();
    expect(screen.queryByLabelText('Text to explore')).toBeNull();
    expect(screen.getByLabelText('Selected translation').textContent).toBe(translation);
    fireEvent.click(screen.getByRole('button', { name: 'Open Chat draft' }));
    expect(props.onPrepare.mock.calls[0][0]).toContain(translation);
  });

  it('has safe rendered text and explains Chat and privacy boundaries without sending a request', () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    const { container, props } = setup({ provider: 'GPT', translation: '<script>bad()</script>' });
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByLabelText('Selected translation').textContent).toBe('<script>bad()</script>');
    expect(screen.getByText(/with ChatGPT/)).toBeTruthy();
    expect(screen.getByText(/not live web search/)).toBeTruthy();
    expect(screen.getByText(/Provider retention still applies/)).toBeTruthy();
    expect(props.onPrepare).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('copies only after a click and resets feedback when the selection changes', async () => {
    const writeText = vi.fn().mockResolvedValue();
    mockClipboard({ writeText });
    setup();
    expect(writeText).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Copy text' }));
    await waitFor(() => expect(screen.getByText('Copied')).toBeTruthy());
    expect(writeText).toHaveBeenCalledWith('The appointment is tomorrow.');
    fireEvent.change(screen.getByLabelText('Text to explore'), { target: { value: '1' } });
    expect(screen.queryByText('Copied')).toBeNull();
  });

  it('reports clipboard denial without pretending the copy succeeded', async () => {
    mockClipboard({ writeText: vi.fn().mockRejectedValue(new Error('Denied')) });
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Copy text' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('copy the preview text manually'));
    expect(screen.queryByText('Copied')).toBeNull();
  });

  it('does not show stale clipboard feedback after choosing another sentence', async () => {
    let finishCopy;
    mockClipboard({ writeText: vi.fn(() => new Promise(resolve => { finishCopy = resolve; })) });
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Copy text' }));
    fireEvent.change(screen.getByLabelText('Text to explore'), { target: { value: '1' } });
    finishCopy();
    await waitFor(() => expect(screen.queryByText('Copied')).toBeNull());
  });

  it('blocks opening Chat while capture is busy', () => {
    const { props } = setup({ busy: true });
    expect(screen.getByRole('button', { name: 'Open Chat draft' }).disabled).toBe(true);
    expect(screen.getByText(/Stop listening before opening/)).toBeTruthy();
    fireEvent.submit(screen.getByRole('button', { name: 'Open Chat draft' }).closest('form'));
    expect(props.onPrepare).not.toHaveBeenCalled();
  });

  it('reports oversized text instead of silently truncating it', () => {
    const { props } = setup({ translation: 'x'.repeat(80_001) });
    fireEvent.click(screen.getByRole('button', { name: 'Open Chat draft' }));
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(props.onPrepare).not.toHaveBeenCalled();
  });

  it('supports Escape, backdrop dismissal, focus trapping and focus restoration', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const { props, unmount, container } = setup();
    const close = screen.getByRole('button', { name: 'Close sentence search' });
    const last = screen.getByRole('button', { name: 'Open Chat draft' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledOnce();
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(props.onClose).toHaveBeenCalledOnce();
    fireEvent.mouseDown(container.querySelector('.interpreter-search-overlay'));
    expect(props.onClose).toHaveBeenCalledTimes(2);
    unmount();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).not.toBe('hidden');
    trigger.remove();
  });
});
