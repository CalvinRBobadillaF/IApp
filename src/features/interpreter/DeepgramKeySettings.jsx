import { useId, useState } from 'react';

export default function DeepgramKeySettings({
  credentialMode = 'server', setCredentialMode, localKeyConfigured = false,
  localKeyRemembered = false, localKeyStorageError = '', saveLocalKey, removeLocalKey,
  busy = false, captureKreyol = false,
}) {
  const noteId = useId();
  const [key, setKey] = useState('');
  const [remember, setRemember] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const changeMode = event => {
    setKey('');
    setFormError('');
    setNotice('');
    setCredentialMode?.(event.target.value);
  };
  const save = event => {
    event.preventDefault();
    if (busy) return;
    setNotice('');
    if (saveLocalKey?.(key, { remember }) !== true) {
      setFormError('Could not use this key. Check the key format and any storage error below.');
      return;
    }
    setKey('');
    setFormError('');
    setNotice(remember ? 'Key saved on this device. Its access is checked when you start listening.' : 'Key set for this session. Its access is checked when you start listening.');
  };
  const remove = () => {
    if (busy) return;
    setKey('');
    setNotice('');
    if (removeLocalKey?.() !== true) {
      setFormError('Could not remove the stored key. Check browser storage permissions before leaving this device.');
      return;
    }
    setFormError('');
    setNotice('Local key removed.');
  };

  return (
    <details className="interpreter-credentials">
      <summary>Deepgram credentials <span>{credentialMode === 'local' ? 'Temporary local key' : 'Server key'}</span></summary>
      <div className="interpreter-credentials-content">
        <label className="interpreter-field">English / Spanish speech credentials
          <select value={credentialMode} disabled={busy} onChange={changeMode}>
            <option value="server">Server key (recommended)</option>
            <option value="local">Temporary local key</option>
          </select>
        </label>
        <p className="interpreter-mode-help">Local mode sends a Deepgram key directly from this browser to Deepgram for English / Spanish speech. It does not send the key to IApp. Kreyòl speech and all translation still use the Render backend.</p>
        {captureKreyol && credentialMode === 'local' && <p className="interpreter-key-note">The local Deepgram key is not used while a Kreyòl speaker is selected.</p>}
        {credentialMode === 'local' && <>
          <p className="interpreter-key-note" id={noteId}>Contact the app owner for an individual, restricted, revocable Deepgram key. Do not share an administrator key or the server key. A browser key is exposed to scripts and users with access to this browser and can incur usage charges.</p>
          <form className="interpreter-key-form" onSubmit={save}>
            <label className="interpreter-field">Deepgram API key
              <input type="password" value={key} maxLength={8192} autoComplete="off" spellCheck={false} autoCapitalize="none" aria-describedby={noteId} disabled={busy} onChange={event => { setKey(event.target.value); setFormError(''); }} placeholder={localKeyConfigured ? 'Enter a replacement key' : 'Paste your individual key'} />
            </label>
            <label className="interpreter-checkbox"><input type="checkbox" checked={remember} disabled={busy} onChange={event => setRemember(event.target.checked)} />Remember key on this device (localStorage)</label>
            <p className="interpreter-mode-help">Unchecked: use only for this tool session. Remembering stores the key as plain text in localStorage. Privacy mode does not automatically erase an explicitly remembered key; use Remove saved key.</p>
            <button type="submit" className="interpreter-secondary" disabled={busy || !key.trim()}>{remember ? 'Save key on this device' : 'Use for session'}</button>
          </form>
        </>}
        <div className="interpreter-key-status">
          <p>{localKeyConfigured ? `•••••••• Key configured · ${localKeyRemembered ? 'Remembered on this device' : 'Session only'}` : 'No local key configured.'}</p>
          {(localKeyConfigured || localKeyRemembered) && <button type="button" className="interpreter-secondary" disabled={busy} onClick={remove}>{localKeyRemembered ? 'Remove saved key' : 'Remove local key'}</button>}
        </div>
        {notice && <p className="interpreter-key-note" role="status">{notice}</p>}
        {formError && <p className="interpreter-key-error" role="alert">{formError}</p>}
        {localKeyStorageError && <p className="interpreter-key-error" role="alert">{localKeyStorageError}</p>}
      </div>
    </details>
  );
}
