import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import GlossaryEditor from './GlossaryEditor.jsx';

const empty = () => ({ defaultIntensity: 0.4, vocabulary: [], spelling: [] });
const vocabulary = (value = 'Pétion-Ville') => ({ id: value, value, enabled: true, pronunciations: ['Petion vil'], intensity: null });
const correction = () => ({ id: 'ayiti', value: 'Ayiti', variants: ['Haiti'], enabled: true });
afterEach(cleanup);

function setup({ initial = empty(), ...overrides } = {}) {
  const props = { privacyMode: false, busy: false, onClose: vi.fn(), ...overrides };
  const changed = vi.fn();
  function Editor() {
    const [glossary, setGlossary] = useState(initial);
    return <GlossaryEditor {...props} glossary={glossary} setGlossary={next => { changed(next); setGlossary(next); return true; }} />;
  }
  return { ...render(<Editor />), ...props, changed };
}

describe('Kreyòl glossary editor', () => {
  it('adds trimmed vocabulary with unique pronunciations and clears the draft', () => {
    const { changed } = setup();
    fireEvent.change(screen.getByLabelText('Correct term'), { target: { value: '  Pétion-Ville  ' } });
    fireEvent.change(screen.getByLabelText('Sounds like, comma-separated'), { target: { value: ' Petion vil, Petion vil, Petyonvil ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add term' }));
    expect(changed.mock.lastCall[0].vocabulary).toEqual([expect.objectContaining({
      value: 'Pétion-Ville', enabled: true, intensity: null, pronunciations: ['Petion vil', 'Petyonvil'],
    })]);
    expect(screen.getByLabelText('Correct term').value).toBe('');
    expect(screen.getByLabelText('Sounds like, comma-separated').value).toBe('');
    expect(screen.getByRole('checkbox', { name: 'Use vocabulary term Pétion-Ville' }).checked).toBe(true);
  });

  it('requires spelling variants and saves a correction', () => {
    const { changed } = setup();
    fireEvent.change(screen.getByLabelText('Preferred spelling'), { target: { value: 'Ayiti' } });
    expect(screen.getByRole('button', { name: 'Add correction' }).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Variants to replace, comma-separated'), { target: { value: ' Haiti, Hayiti ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add correction' }));
    expect(changed.mock.lastCall[0].spelling).toEqual([expect.objectContaining({ value: 'Ayiti', variants: ['Haiti', 'Hayiti'], enabled: true })]);
    expect(screen.getByLabelText('Preferred spelling').value).toBe('');
  });

  it('rejects duplicate terms case-insensitively and retains the draft', () => {
    const { changed } = setup({ initial: { ...empty(), vocabulary: [vocabulary()] } });
    fireEvent.change(screen.getByLabelText('Correct term'), { target: { value: 'pétion-ville' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add term' }));
    expect(screen.getByRole('alert').textContent).toContain('already exists');
    expect(changed).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Correct term').value).toBe('pétion-ville');
  });

  it.each([
    [Array.from({ length: 21 }, (_, index) => `term${index}`).join(','), 'up to 20'],
    ['a'.repeat(161), '160 characters'],
  ])('rejects invalid pronunciation lists', (alternatives, message) => {
    const { changed } = setup();
    fireEvent.change(screen.getByLabelText('Correct term'), { target: { value: 'Name' } });
    fireEvent.change(screen.getByLabelText('Sounds like, comma-separated'), { target: { value: alternatives } });
    fireEvent.click(screen.getByRole('button', { name: 'Add term' }));
    expect(screen.getByRole('alert').textContent).toContain(message);
    expect(changed).not.toHaveBeenCalled();
  });

  it('enforces the overall character budget', () => {
    const initial = { ...empty(), vocabulary: Array.from({ length: 100 }, (_, index) => ({ ...vocabulary(`term${index}`), pronunciations: ['a'.repeat(160), 'b'.repeat(40)] })) };
    const { changed } = setup({ initial });
    fireEvent.change(screen.getByLabelText('Preferred spelling'), { target: { value: 'Ayiti' } });
    fireEvent.change(screen.getByLabelText('Variants to replace, comma-separated'), { target: { value: 'Haiti' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add correction' }));
    expect(screen.getByRole('alert').textContent).toContain('20,000 characters');
    expect(changed).not.toHaveBeenCalled();
  });

  it('caps each section at 100 entries', () => {
    setup({ initial: { ...empty(), vocabulary: Array.from({ length: 100 }, (_, index) => vocabulary(`term${index}`)) } });
    fireEvent.change(screen.getByLabelText('Correct term'), { target: { value: 'Another' } });
    expect(screen.getByRole('button', { name: 'Add term' }).disabled).toBe(true);
  });

  it('changes default and per-term emphasis and supports default inheritance', () => {
    const { changed } = setup({ initial: { ...empty(), vocabulary: [vocabulary()] } });
    fireEvent.change(screen.getByRole('slider'), { target: { value: '0.6' } });
    expect(changed.mock.lastCall[0].defaultIntensity).toBe(0.6);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Emphasis for Pétion-Ville' }), { target: { value: '0.8' } });
    expect(changed.mock.lastCall[0].vocabulary[0].intensity).toBe(0.8);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Emphasis for Pétion-Ville' }), { target: { value: '' } });
    expect(changed.mock.lastCall[0].vocabulary[0].intensity).toBeNull();
    const calls = changed.mock.calls.length;
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Emphasis for Pétion-Ville' }), { target: { value: '2' } });
    expect(changed.mock.calls).toHaveLength(calls);
  });

  it('toggles and removes both entry types', () => {
    const { changed } = setup({ initial: { ...empty(), vocabulary: [vocabulary()], spelling: [correction()] } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Use vocabulary term Pétion-Ville' }));
    expect(changed.mock.lastCall[0].vocabulary[0].enabled).toBe(false);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Use spelling correction Ayiti' }));
    expect(changed.mock.lastCall[0].spelling[0].enabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Remove vocabulary term Pétion-Ville' }));
    expect(screen.queryByRole('checkbox', { name: 'Use vocabulary term Pétion-Ville' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Remove spelling correction Ayiti' }));
    expect(screen.queryByRole('checkbox', { name: 'Use spelling correction Ayiti' })).toBeNull();
  });

  it.each([{ privacyMode: true }, { busy: true }])('locks all glossary edits when %j', flags => {
    const { changed } = setup({ ...flags, initial: { ...empty(), vocabulary: [vocabulary()] } });
    expect(screen.getByLabelText('Correct term').matches(':disabled')).toBe(true);
    expect(screen.getByRole('slider').matches(':disabled')).toBe(true);
    expect(screen.getByRole('checkbox', { name: 'Use vocabulary term Pétion-Ville' }).matches(':disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Remove vocabulary term Pétion-Ville' }));
    expect(changed).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Done' }).disabled).toBe(false);
  });

  it('does not clear the draft if the session rejects the update', () => {
    const setGlossary = vi.fn(() => false);
    render(<GlossaryEditor glossary={empty()} setGlossary={setGlossary} privacyMode={false} busy={false} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Correct term'), { target: { value: 'Ayiti' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add term' }));
    expect(screen.getByRole('alert').textContent).toContain('could not be updated');
    expect(screen.getByLabelText('Correct term').value).toBe('Ayiti');
  });

  it('focuses close, traps keyboard navigation and restores focus and scroll on unmount', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const previousOverflow = document.body.style.overflow;
    const { unmount, onClose } = setup();
    const close = screen.getByRole('button', { name: 'Close glossary' });
    const done = screen.getByRole('button', { name: 'Done' });
    expect(document.activeElement).toBe(close);
    expect(document.body.style.overflow).toBe('hidden');
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{}]);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(done);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    unmount();
    expect(document.body.style.overflow).toBe(previousOverflow);
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('only closes from the backdrop, not from clicks within the dialog', () => {
    const { onClose } = setup();
    const dialog = screen.getByRole('dialog');
    fireEvent.mouseDown(dialog);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(dialog.parentElement);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
