import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import DeepgramKeySettings from './DeepgramKeySettings.jsx';

afterEach(cleanup);

function setup(overrides = {}) {
  const props = { setCredentialMode: vi.fn(), saveLocalKey: vi.fn(() => true), removeLocalKey: vi.fn(() => true), ...overrides };
  const view = render(<DeepgramKeySettings {...props} />);
  fireEvent.click(screen.getByText('Deepgram credentials'));
  return { ...view, props };
}

describe('Deepgram key settings', () => {
  it('defaults to the server without showing an API key field', () => {
    const { props } = setup();
    expect(screen.getByLabelText('English / Spanish speech credentials').value).toBe('server');
    expect(screen.queryByLabelText('Deepgram API key')).toBeNull();
    expect(props.setCredentialMode).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('English / Spanish speech credentials'), { target: { value: 'local' } });
    expect(props.setCredentialMode).toHaveBeenCalledWith('local');
  });

  it('uses a blank masked input and defaults to session-only storage', () => {
    const { props, container } = setup({ credentialMode: 'local', localKeyConfigured: true, localKeyRemembered: true });
    const input = screen.getByLabelText('Deepgram API key');
    expect(input.type).toBe('password');
    expect(input.value).toBe('');
    expect(input.autocomplete).toBe('off');
    expect(input.getAttribute('spellcheck')).toBe('false');
    expect(screen.getByRole('checkbox', { name: /Remember key/ }).checked).toBe(false);
    expect(screen.getByText(/•••••••• Key configured/)).toBeTruthy();
    expect(container.textContent).not.toContain('example-individual-key');
    fireEvent.change(input, { target: { value: 'example-individual-key' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use for session' }));
    expect(props.saveLocalKey).toHaveBeenCalledWith('example-individual-key', { remember: false });
    expect(input.value).toBe('');
    expect(screen.getByRole('status').textContent).toContain('access is checked when you start');
  });

  it('requires explicitly choosing localStorage and explains its limitations', () => {
    const { props } = setup({ credentialMode: 'local' });
    expect(screen.getByText(/individual, restricted, revocable/)).toBeTruthy();
    expect(screen.getByText(/plain text in localStorage/)).toBeTruthy();
    expect(screen.getByText(/Privacy mode does not automatically erase/)).toBeTruthy();
    expect(screen.getByText(/Kreyòl speech and all translation still use the Render backend/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Deepgram API key'), { target: { value: 'remember-test-key' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Remember key/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save key on this device' }));
    expect(props.saveLocalKey).toHaveBeenCalledWith('remember-test-key', { remember: true });
  });

  it('keeps failed input masked for correction and displays storage errors', () => {
    const { props } = setup({ credentialMode: 'local', saveLocalKey: vi.fn(() => false), localKeyStorageError: 'Browser storage is blocked.' });
    const input = screen.getByLabelText('Deepgram API key');
    fireEvent.change(input, { target: { value: 'invalid-test-key' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use for session' }));
    expect(props.saveLocalKey).toHaveBeenCalledOnce();
    expect(input.value).toBe('invalid-test-key');
    expect(screen.getByText(/Could not use this key/).getAttribute('role')).toBe('alert');
    expect(screen.getByText('Browser storage is blocked.').getAttribute('role')).toBe('alert');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('allows remembered-key removal even in server mode', () => {
    const { props } = setup({ localKeyConfigured: true, localKeyRemembered: true });
    fireEvent.click(screen.getByRole('button', { name: 'Remove saved key' }));
    expect(props.removeLocalKey).toHaveBeenCalledOnce();
    expect(screen.getByRole('status').textContent).toBe('Local key removed.');
  });

  it('does not claim deletion when removing the key fails', () => {
    setup({ localKeyConfigured: true, localKeyRemembered: true, removeLocalKey: vi.fn(() => false) });
    fireEvent.click(screen.getByRole('button', { name: 'Remove saved key' }));
    expect(screen.getByRole('alert').textContent).toContain('Could not remove the stored key');
    expect(screen.queryByText('Local key removed.')).toBeNull();
  });

  it('clears the draft key when switching credential modes', () => {
    setup({ credentialMode: 'local' });
    const input = screen.getByLabelText('Deepgram API key');
    fireEvent.change(input, { target: { value: 'draft-key' } });
    fireEvent.change(screen.getByLabelText('English / Spanish speech credentials'), { target: { value: 'server' } });
    expect(input.value).toBe('');
  });

  it('disables credential mutations during capture', () => {
    setup({ credentialMode: 'local', busy: true, localKeyConfigured: true, localKeyRemembered: true });
    expect(screen.getByLabelText('English / Spanish speech credentials').disabled).toBe(true);
    expect(screen.getByLabelText('Deepgram API key').disabled).toBe(true);
    expect(screen.getByRole('checkbox', { name: /Remember key/ }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Use for session' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Remove saved key' }).disabled).toBe(true);
  });

  it('clarifies that the local key does not apply to Kreyòl', () => {
    setup({ credentialMode: 'local', captureKreyol: true });
    expect(screen.getByText(/not used while a Kreyòl speaker is selected/)).toBeTruthy();
  });
});
