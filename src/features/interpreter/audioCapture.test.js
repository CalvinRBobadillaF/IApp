import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startInterpreterAudio } from './audioCapture';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

class FakeTrack extends EventTarget {
  constructor(kind = 'audio') {
    super();
    this.kind = kind;
    this.readyState = 'live';
    this.stop = vi.fn(() => { this.readyState = 'ended'; });
  }

  end() { this.readyState = 'ended'; this.dispatchEvent(new Event('ended')); }
}

function makeStream(tracks = [new FakeTrack()]) {
  return {
    tracks,
    getTracks: () => tracks,
    getAudioTracks: () => tracks.filter((track) => track.kind === 'audio'),
    getVideoTracks: () => tracks.filter((track) => track.kind === 'video'),
    removeTrack: (track) => { tracks.splice(tracks.indexOf(track), 1); },
  };
}

class FakeSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances = [];

  constructor(url, protocols) {
    this.url = url;
    this.protocols = protocols;
    this.readyState = 0;
    this.bufferedAmount = 0;
    this.send = vi.fn();
    this.close = vi.fn(() => { this.readyState = 3; });
    FakeSocket.instances.push(this);
  }

  open() { this.readyState = 1; this.onopen?.(); }
  message(data) { this.onmessage?.({ data: typeof data === 'string' ? data : JSON.stringify(data) }); }
  end(code = 1000) { this.readyState = 3; this.onclose?.({ code }); }
}

class FakeRecorder {
  static instances = [];
  static isTypeSupported = vi.fn(() => true);

  constructor(stream, options) {
    this.stream = stream;
    this.options = options;
    this.state = 'inactive';
    this.start = vi.fn(() => { this.state = 'recording'; });
    this.stop = vi.fn(() => { this.state = 'inactive'; this.onstop?.(); });
    FakeRecorder.instances.push(this);
  }

  chunk(size = 200) { this.ondataavailable?.({ data: new Blob(['x'.repeat(size)]) }); }
}

const makeNode = () => ({ connect: vi.fn(), disconnect: vi.fn() });

class FakeAudioContext {
  static instances = [];
  constructor() {
    this.sampleRate = 48000; // Deliberately different from the requested hint.
    this.state = 'suspended';
    this.resume = vi.fn(async () => { this.state = 'running'; });
    this.close = vi.fn(async () => { this.state = 'closed'; });
    this.source = makeNode();
    this.processor = makeNode();
    this.gain = { ...makeNode(), gain: { value: 1 } };
    this.destination = {};
    this.createMediaStreamSource = vi.fn(() => this.source);
    this.createScriptProcessor = vi.fn(() => this.processor);
    this.createGain = vi.fn(() => this.gain);
    FakeAudioContext.instances.push(this);
  }
}

const sessions = {
  deepgram: { provider: 'deepgram', url: 'wss://api.deepgram.com/v1/listen?model=nova-3&language=multi', protocols: ['bearer', 'ephemeral-test-token'] },
  gladia: { provider: 'gladia', url: 'wss://api.gladia.io/audio/test-session' },
};
const flush = async () => { for (let index = 0; index < 12; index += 1) await Promise.resolve(); };
const controllers = [];
let media, stream;

function start(overrides = {}) {
  const controller = new AbortController();
  controllers.push(controller);
  const options = {
    source: 'mic', provider: 'deepgram', signal: controller.signal,
    createSession: vi.fn(async ({ provider }) => sessions[provider]),
    onFinal: vi.fn(), onInterim: vi.fn(), onError: vi.fn(), onEnded: vi.fn(),
    ...overrides,
  };
  return { options, controller, promise: startInterpreterAudio(options) };
}

async function connected(overrides) {
  const pending = start(overrides);
  await flush();
  const socket = FakeSocket.instances.at(-1);
  expect(socket).toBeDefined();
  socket.open();
  const handle = await pending.promise;
  return { ...pending, socket, handle, recorder: FakeRecorder.instances.at(-1) };
}

beforeEach(() => {
  stream = makeStream();
  media = { getUserMedia: vi.fn(async () => stream), getDisplayMedia: vi.fn(async () => stream) };
  vi.stubGlobal('WebSocket', FakeSocket);
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal('isSecureContext', true);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: media });
  FakeSocket.instances = [];
  FakeRecorder.instances = [];
  FakeAudioContext.instances = [];
  FakeRecorder.isTypeSupported.mockReset().mockReturnValue(true);
});

afterEach(() => {
  controllers.splice(0).forEach((controller) => controller.abort());
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('browser capture startup', () => {
  it('starts only after socket open; uses ephemeral credentials and an audio-only stream', async () => {
    const pending = start();
    const resolved = vi.fn();
    pending.promise.then(resolved);
    await flush();
    expect(resolved).not.toHaveBeenCalled();
    expect(FakeRecorder.instances).toHaveLength(0);
    const socket = FakeSocket.instances[0];
    expect(socket.protocols).toEqual(sessions.deepgram.protocols);
    expect(pending.options.createSession).toHaveBeenCalledWith({ provider: 'deepgram', sample_rate: 16000 });
    expect(media.getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ video: false }));
    socket.open();
    const handle = await pending.promise;
    expect(FakeRecorder.instances[0].start).toHaveBeenCalledWith(100);
    expect(FakeRecorder.instances[0].options.mimeType).toBe('audio/webm;codecs=opus');
    handle.stop();
    handle.stop();
    expect(stream.tracks[0].stop).toHaveBeenCalledTimes(1);
    expect(socket.close).toHaveBeenCalledTimes(1);
    expect(pending.options.onEnded).not.toHaveBeenCalled();
  });

  it('probes recorder formats and falls back to a supported container', async () => {
    FakeRecorder.isTypeSupported.mockImplementation((type) => type === 'audio/mp4');
    const { recorder } = await connected();
    expect(recorder.options.mimeType).toBe('audio/mp4');
  });

  it('does not request audio with no supported recording codec', async () => {
    FakeRecorder.isTypeSupported.mockReturnValue(false);
    await expect(start().promise).rejects.toThrow('supported audio format');
    expect(media.getUserMedia).not.toHaveBeenCalled();
  });

  it('handles missing MediaRecorder without a ReferenceError', async () => {
    vi.stubGlobal('MediaRecorder', undefined);
    await expect(start().promise).rejects.toThrow('supported audio format');
  });

  it('requires AudioContext for Gladia before requesting permissions', async () => {
    vi.stubGlobal('AudioContext', undefined);
    await expect(start({ provider: 'gladia' }).promise).rejects.toThrow('audio processing needed');
    expect(media.getUserMedia).not.toHaveBeenCalled();
  });

  it('rejects unsupported source/provider before requesting permissions', async () => {
    await expect(start({ source: 'system' }).promise).rejects.toThrow('supported audio source');
    await expect(start({ provider: 'unknown' }).promise).rejects.toThrow('supported audio source');
    expect(media.getUserMedia).not.toHaveBeenCalled();
  });

  it('requires HTTPS and browser capture support', async () => {
    vi.stubGlobal('isSecureContext', false);
    await expect(start().promise).rejects.toThrow('HTTPS');
    vi.stubGlobal('isSecureContext', true);
    media.getDisplayMedia = undefined;
    await expect(start({ source: 'tab' }).promise).rejects.toThrow('supported desktop browser');
    expect(media.getUserMedia).not.toHaveBeenCalled();
  });

  it('explains rejected permissions and does not initialize a provider', async () => {
    media.getUserMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    const pending = start();
    await expect(pending.promise).rejects.toThrow('Microphone access was denied');
    expect(pending.options.createSession).not.toHaveBeenCalled();
  });

  it('discards video immediately and rejects a shared tab without audio', async () => {
    const video = new FakeTrack('video');
    media.getDisplayMedia.mockResolvedValue(makeStream([video]));
    const pending = start({ source: 'tab' });
    await expect(pending.promise).rejects.toThrow('No tab audio was shared');
    expect(video.stop).toHaveBeenCalledTimes(1);
    expect(pending.options.createSession).not.toHaveBeenCalled();
  });

  it('sends only the audio tracks of a shared tab to MediaRecorder', async () => {
    const video = new FakeTrack('video');
    const audio = new FakeTrack();
    stream = makeStream([video, audio]);
    const { recorder } = await connected({ source: 'tab' });
    expect(video.stop).toHaveBeenCalledTimes(1);
    expect(recorder.stream.getTracks()).toEqual([audio]);
  });

  it('releases audio if the backend refuses to issue a session', async () => {
    const pending = start({ createSession: vi.fn().mockRejectedValue(new Error('Transcription is not configured.')) });
    await expect(pending.promise).rejects.toThrow('not configured');
    expect(stream.tracks[0].stop).toHaveBeenCalledOnce();
    expect(FakeSocket.instances).toHaveLength(0);
  });

  it.each([
    { provider: 'deepgram', url: 'https://api.deepgram.com/v1/listen' },
    { provider: 'deepgram', url: 'wss://untrusted.example/listen' },
    { provider: 'deepgram', url: 'wss://api.deepgram.com.evil.example/listen' },
    { provider: 'gladia', url: sessions.deepgram.url },
    { ...sessions.deepgram, protocols: ['token', 'permanent-key'] },
    { ...sessions.deepgram, protocols: ['bearer', 'token with spaces'] },
    { ...sessions.deepgram, protocols: ['bearer'] },
    { ...sessions.deepgram, url: 'wss://api.deepgram.com:8443/v1/listen' },
    { ...sessions.deepgram, url: ' wss://api.deepgram.com/v1/listen' },
    { ...sessions.deepgram, url: 'wss://api.deepgram.com/v1/listen#token' },
  ])('rejects mismatched or unsafe provider sessions %#', async (session) => {
    const pending = start({ createSession: vi.fn().mockResolvedValue(session) });
    await expect(pending.promise).rejects.toThrow('invalid transcription session');
    expect(stream.tracks[0].stop).toHaveBeenCalledOnce();
    expect(FakeSocket.instances).toHaveLength(0);
  });

  it('does not expose credentials if browser socket initialization fails', async () => {
    vi.stubGlobal('WebSocket', class {
      constructor() { throw new Error('Rejected sensitive session token'); }
    });
    const pending = start();
    await expect(pending.promise).rejects.toThrow('Could not open the transcription connection');
    expect(stream.tracks[0].stop).toHaveBeenCalledOnce();
  });

  it('accepts Gladia-issued sockets at the provider base domain', async () => {
    const { socket } = await connected({ provider: 'gladia', createSession: async () => ({ provider: 'gladia', url: 'wss://gladia.io/audio/test-session' }) });
    expect(socket.url).toBe('wss://gladia.io/audio/test-session');
  });
});

describe('opt-in direct Deepgram key compatibility', () => {
  const directKey = 'temporary-browser-test-key';

  it('bypasses the backend and authenticates only in the fixed Deepgram socket subprotocol', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const { socket, options, handle } = await connected({ deepgramApiKey: `  ${directKey}  ` });
    expect(options.createSession).not.toHaveBeenCalled();
    expect(socket.protocols).toEqual(['token', directKey]);
    const url = new URL(socket.url);
    expect(url.origin).toBe('wss://api.deepgram.com');
    expect(url.pathname).toBe('/v1/listen');
    expect(url.username).toBe('');
    expect(url.password).toBe('');
    expect(url.hash).toBe('');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      model: 'nova-3', language: 'multi', smart_format: 'true',
      punctuate: 'true', numerals: 'true', interim_results: 'true',
      filler_words: 'false', endpointing: '300', utterance_end_ms: '1200',
      no_delay: 'true', vad_events: 'true', diarize: 'false', mip_opt_out: 'true',
    });
    expect(socket.url).not.toContain(directKey);
    expect(fetch).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
    handle.stop();
    expect(stream.tracks[0].stop).toHaveBeenCalledOnce();
  });

  it('does not require a backend callback and preserves the tab-capture user gesture', async () => {
    const pending = start({ source: 'tab', deepgramApiKey: directKey, createSession: undefined });
    expect(media.getDisplayMedia).toHaveBeenCalledOnce();
    expect(FakeSocket.instances).toHaveLength(0);
    await flush();
    FakeSocket.instances[0].open();
    const handle = await pending.promise;
    handle.stop();
    expect(stream.tracks[0].stop).toHaveBeenCalledOnce();
  });

  it.each([null, 123, '', '   ', 'Token secret', 'secret\nkey', '"secret"', 'secret,key', 'x'.repeat(8193)])(
    'rejects invalid direct credential case %# before capture without disclosing it', async (deepgramApiKey) => {
      const pending = start({ deepgramApiKey });
      await expect(pending.promise).rejects.toThrow('Enter a valid raw Deepgram API key');
      expect(media.getUserMedia).not.toHaveBeenCalled();
      expect(pending.options.createSession).not.toHaveBeenCalled();
      expect(FakeSocket.instances).toHaveLength(0);
    },
  );

  it('never sends a Deepgram key to Gladia', async () => {
    const pending = start({ provider: 'gladia', deepgramApiKey: directKey });
    await expect(pending.promise).rejects.toThrow('only be used for English/Spanish');
    expect(media.getUserMedia).not.toHaveBeenCalled();
    expect(FakeAudioContext.instances).toHaveLength(0);
    expect(pending.options.createSession).not.toHaveBeenCalled();
  });

  it('keeps server-issued Deepgram sessions restricted to bearer tokens', async () => {
    const pending = start({ createSession: vi.fn(async () => ({ ...sessions.deepgram, protocols: ['token', directKey] })) });
    await expect(pending.promise).rejects.toThrow('invalid transcription session');
    expect(FakeSocket.instances).toHaveLength(0);
    expect(stream.tracks[0].stop).toHaveBeenCalledOnce();
  });

  it('releases a direct-mode permission result arriving after cancellation', async () => {
    const capture = deferred();
    media.getUserMedia.mockReturnValue(capture.promise);
    const pending = start({ deepgramApiKey: directKey });
    pending.controller.abort();
    await expect(pending.promise).rejects.toHaveProperty('name', 'AbortError');
    capture.resolve(stream);
    await flush();
    expect(stream.tracks[0].stop).toHaveBeenCalledOnce();
    expect(pending.options.createSession).not.toHaveBeenCalled();
    expect(FakeSocket.instances).toHaveLength(0);
  });

  it('closes a cancelled direct socket and cannot start recording from a late open', async () => {
    const pending = start({ deepgramApiKey: directKey });
    await flush();
    const socket = FakeSocket.instances[0];
    const lateOpen = socket.onopen;
    pending.controller.abort();
    await expect(pending.promise).rejects.toHaveProperty('name', 'AbortError');
    lateOpen();
    expect(FakeRecorder.instances).toHaveLength(0);
    expect(socket.close).toHaveBeenCalledOnce();
    expect(stream.tracks[0].stop).toHaveBeenCalledOnce();
  });

  it('sanitizes constructor failures that contain the supplied key', async () => {
    vi.stubGlobal('WebSocket', class {
      constructor() { throw new Error(`Rejected ${directKey}`); }
    });
    const pending = start({ deepgramApiKey: directKey });
    await expect(pending.promise).rejects.toThrow('Could not open the transcription connection');
    expect(stream.tracks[0].stop).toHaveBeenCalledOnce();
  });

  it('reports connection failure without echoing the key or reverting to server auth', async () => {
    const pending = start({ deepgramApiKey: directKey });
    await flush();
    const socket = FakeSocket.instances[0];
    socket.onerror({ message: directKey });
    await expect(pending.promise).rejects.toThrow('Could not connect to Deepgram. Check the supplied key, account permissions, billing, and your connection.');
    expect(pending.options.createSession).not.toHaveBeenCalled();
    expect(FakeRecorder.instances).toHaveLength(0);
    expect(socket.close).toHaveBeenCalledOnce();
    expect(stream.tracks[0].stop).toHaveBeenCalledOnce();
  });

  it('releases an established direct session after a provider error without exposing the key', async () => {
    const { socket, recorder, options } = await connected({ deepgramApiKey: directKey });
    socket.message({ type: 'Error', description: directKey });
    expect(options.onError).toHaveBeenCalledWith('The transcription provider could not process this session. Check its configuration and try again.');
    expect(options.onEnded).toHaveBeenCalledOnce();
    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(socket.close).toHaveBeenCalledOnce();
    expect(stream.tracks[0].stop).toHaveBeenCalledOnce();
  });
});

describe('cancellation and failure cleanup', () => {
  it('does not request permission if already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(start({ signal: controller.signal }).promise).rejects.toHaveProperty('name', 'AbortError');
    expect(media.getUserMedia).not.toHaveBeenCalled();
  });

  it('releases a permission result arriving after cancellation', async () => {
    const capture = deferred();
    media.getUserMedia.mockReturnValue(capture.promise);
    const pending = start();
    pending.controller.abort();
    await expect(pending.promise).rejects.toHaveProperty('name', 'AbortError');
    capture.resolve(stream);
    await flush();
    expect(stream.tracks[0].stop).toHaveBeenCalledOnce();
    expect(pending.options.createSession).not.toHaveBeenCalled();
  });

  it('ignores a backend session arriving after cancellation', async () => {
    const session = deferred();
    const pending = start({ createSession: vi.fn(() => session.promise) });
    await flush();
    pending.controller.abort();
    await expect(pending.promise).rejects.toHaveProperty('name', 'AbortError');
    session.resolve(sessions.deepgram);
    await flush();
    expect(FakeSocket.instances).toHaveLength(0);
    expect(stream.tracks[0].stop).toHaveBeenCalledOnce();
  });

  it('cannot reopen a cancelled connecting socket', async () => {
    const pending = start();
    await flush();
    const socket = FakeSocket.instances[0];
    const lateOpen = socket.onopen;
    pending.controller.abort();
    await expect(pending.promise).rejects.toHaveProperty('name', 'AbortError');
    lateOpen();
    expect(FakeRecorder.instances).toHaveLength(0);
    expect(socket.close).toHaveBeenCalledOnce();
  });

  it('reports initial socket rejection rather than pretending to be recording', async () => {
    const pending = start();
    await flush();
    FakeSocket.instances[0].onerror();
    await expect(pending.promise).rejects.toThrow('Could not connect');
    expect(stream.tracks[0].stop).toHaveBeenCalledOnce();
    expect(pending.options.onError).not.toHaveBeenCalled();
  });

  it('rejects a socket closed before startup even with a normal close code', async () => {
    const pending = start();
    await flush();
    FakeSocket.instances[0].end(1000);
    await expect(pending.promise).rejects.toThrow('connection closed');
    expect(stream.tracks[0].stop).toHaveBeenCalledOnce();
    expect(FakeRecorder.instances).toHaveLength(0);
  });

  it('reports audio sharing ending during startup instead of silently cancelling', async () => {
    const session = deferred();
    const pending = start({ createSession: () => session.promise });
    await flush();
    stream.tracks[0].end();
    await expect(pending.promise).rejects.toThrow('Audio sharing ended before transcription could start');
    session.resolve(sessions.deepgram);
    await flush();
    expect(FakeSocket.instances).toHaveLength(0);
    expect(pending.options.onEnded).not.toHaveBeenCalled();
  });

  it('times out an unanswered permission prompt and releases any late stream', async () => {
    vi.useFakeTimers();
    const capture = deferred();
    media.getUserMedia.mockReturnValue(capture.promise);
    const pending = start();
    const rejection = expect(pending.promise).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(60_000);
    await rejection;
    capture.resolve(stream);
    await flush();
    expect(stream.tracks[0].stop).toHaveBeenCalledOnce();
  });

  it('times out a connecting socket and releases its acquired microphone', async () => {
    vi.useFakeTimers();
    const pending = start();
    const rejection = expect(pending.promise).rejects.toThrow('timed out');
    await flush();
    const socket = FakeSocket.instances[0];
    await vi.advanceTimersByTimeAsync(60_000);
    await rejection;
    expect(socket.close).toHaveBeenCalledOnce();
    expect(stream.tracks[0].stop).toHaveBeenCalledOnce();
  });

  it('stops the recorder and notifies once when the user ends browser sharing', async () => {
    const { recorder, socket, options } = await connected();
    stream.tracks[0].end();
    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(socket.close).toHaveBeenCalledOnce();
    expect(options.onEnded).toHaveBeenCalledOnce();
    expect(options.onError).not.toHaveBeenCalled();
  });

  it('stops recording on unexpected socket close and ignores stale transcript callbacks', async () => {
    const { recorder, socket, options } = await connected();
    const lateMessage = socket.onmessage;
    socket.end(1006);
    lateMessage({ data: JSON.stringify({ type: 'Results', is_final: true, channel: { alternatives: [{ transcript: 'late' }] } }) });
    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(stream.tracks[0].stop).toHaveBeenCalledOnce();
    expect(options.onError).toHaveBeenCalledOnce();
    expect(options.onEnded).toHaveBeenCalledOnce();
    expect(options.onFinal).not.toHaveBeenCalled();
  });

  it('closes cleanly on normal socket shutdown', async () => {
    const { socket, options } = await connected();
    socket.end();
    expect(stream.tracks[0].stop).toHaveBeenCalledOnce();
    expect(options.onEnded).toHaveBeenCalledOnce();
    expect(options.onError).not.toHaveBeenCalled();
  });

  it('stops capture on recorder failure', async () => {
    const { recorder, options } = await connected();
    recorder.onerror({ error: new Error('internal details') });
    expect(options.onError).toHaveBeenCalledWith('Audio recording failed. Check your microphone and try again.');
    expect(stream.tracks[0].stop).toHaveBeenCalledOnce();
  });

  it('cleans up after MediaRecorder throws while starting', async () => {
    class BrokenRecorder extends FakeRecorder {
      constructor(...args) {
        super(...args);
        this.start = vi.fn(() => { throw new Error('Cannot start'); });
      }
    }
    vi.stubGlobal('MediaRecorder', BrokenRecorder);
    const pending = start();
    await flush();
    const socket = FakeSocket.instances[0];
    socket.open();
    await expect(pending.promise).rejects.toThrow('could not start audio recording');
    expect(stream.tracks[0].stop).toHaveBeenCalledOnce();
    expect(socket.close).toHaveBeenCalledOnce();
  });

  it('closes the socket and all tracks even when the provider stop message throws', async () => {
    stream = makeStream([new FakeTrack(), new FakeTrack()]);
    const { socket, handle, recorder, options } = await connected();
    socket.send.mockImplementation(() => { throw new Error('Network failed'); });
    expect(() => handle.stop()).not.toThrow();
    expect(socket.close).toHaveBeenCalledOnce();
    stream.tracks.forEach(track => expect(track.stop).toHaveBeenCalledOnce());
    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(options.onEnded).not.toHaveBeenCalled();
  });

  it('closes the session when sending an audio frame fails', async () => {
    const { socket, recorder, options } = await connected();
    socket.send.mockImplementation(() => { throw new Error('Network failed'); });
    recorder.chunk();
    expect(options.onError).toHaveBeenCalledWith(expect.stringContaining('connection was lost'));
    expect(socket.close).toHaveBeenCalledOnce();
    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(options.onEnded).toHaveBeenCalledOnce();
  });

  it('still notifies ended if the consumer error callback throws', async () => {
    const { socket, recorder, options } = await connected({ onError: vi.fn(() => { throw new Error('UI failed'); }) });
    expect(() => socket.end(1006)).not.toThrow();
    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(options.onEnded).toHaveBeenCalledOnce();
    expect(stream.tracks[0].stop).toHaveBeenCalledOnce();
  });

  it('bounds audio buffering and never persists captured audio', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    const { recorder, socket, options } = await connected();
    recorder.chunk(10);
    expect(socket.send).toHaveBeenCalledWith(expect.any(Blob));
    socket.bufferedAmount = 256 * 1024;
    recorder.chunk(10);
    expect(options.onError).toHaveBeenCalledWith(expect.stringContaining('cannot keep up'));
    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(storage).not.toHaveBeenCalled();
  });
});

describe('transcription messages and Gladia PCM', () => {
  it('parses Deepgram EN/ES final and confident partial results only', async () => {
    const { socket, options } = await connected();
    const result = (transcript, lang, is_final, confidence = 0.9) => ({
      type: 'Results', is_final, speech_final: is_final,
      channel: { alternatives: [{ transcript, languages: [lang], confidence }] },
    });
    socket.message(result(' Hello ', 'en-US', true));
    socket.message(result('Hola', 'es', false));
    socket.message(result('Bonjour', 'fr', true));
    socket.message(result('uncertain', 'en', false, 0.3));
    socket.message('not json');
    socket.message(null);
    socket.message({ type: 'SpeechStarted' });
    expect(options.onFinal).toHaveBeenCalledExactlyOnceWith({ text: 'Hello', lang: 'en', confidence: 0.9, speechFinal: true });
    expect(options.onInterim).toHaveBeenCalledExactlyOnceWith({ text: 'Hola', lang: 'es', confidence: 0.9, speechFinal: false });
  });

  it('sanitizes provider error messages and releases capture', async () => {
    const { socket, options } = await connected();
    socket.message({ type: 'Error', description: 'Sensitive provider payload' });
    expect(options.onError.mock.calls[0][0]).not.toContain('Sensitive');
    expect(options.onEnded).toHaveBeenCalledOnce();
    expect(stream.tracks[0].stop).toHaveBeenCalledOnce();
  });

  it('bounds incoming provider response size', async () => {
    const { socket, options } = await connected();
    socket.message('x'.repeat(256 * 1024 + 1));
    expect(options.onError).toHaveBeenCalledWith(expect.stringContaining('oversized'));
    expect(options.onEnded).toHaveBeenCalledOnce();
  });

  it.each([false, true])('releases recording if a transcript callback fails (asynchronous: %s)', async (asynchronous) => {
    const onFinal = vi.fn(() => {
      if (asynchronous) return Promise.reject(new Error('Sensitive UI details'));
      throw new Error('Sensitive UI details');
    });
    const { socket, recorder, options } = await connected({ onFinal });
    expect(() => socket.message({ type: 'Results', is_final: true, channel: { alternatives: [{ transcript: 'Hello' }] } })).not.toThrow();
    await flush();
    expect(options.onError).toHaveBeenCalledWith('Could not process the transcript. Please restart recording.');
    expect(options.onEnded).toHaveBeenCalledOnce();
    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(stream.tracks[0].stop).toHaveBeenCalledOnce();
  });

  it('resumes Gladia audio within the user gesture and sends the actual sample rate', async () => {
    const { socket, options, handle } = await connected({ provider: 'gladia' });
    const context = FakeAudioContext.instances[0];
    expect(context.resume.mock.invocationCallOrder[0]).toBeLessThan(media.getUserMedia.mock.invocationCallOrder[0]);
    expect(options.createSession).toHaveBeenCalledWith({ provider: 'gladia', sample_rate: 48000 });
    expect(FakeRecorder.instances).toHaveLength(0);
    expect(context.gain.gain.value).toBe(0);
    expect(context.createScriptProcessor).toHaveBeenCalledWith(4096, 1, 1);
    context.processor.onaudioprocess({ inputBuffer: { getChannelData: () => new Float32Array([-2, -0.5, 0, 0.5, 2, NaN]) } });
    const pcm = new DataView(socket.send.mock.calls[0][0]);
    expect(Array.from({ length: 6 }, (_, index) => pcm.getInt16(index * 2, true))).toEqual([-32768, -16384, 0, 16383, 32767, 0]);
    socket.message({ type: 'transcript', data: { is_final: true, utterance: { text: 'Bonjou', confidence: 0.8 } } });
    socket.message({ type: 'transcript', data: { is_final: false, utterance: { text: 'Mwen' } } });
    expect(options.onFinal).toHaveBeenCalledExactlyOnceWith({ text: 'Bonjou', lang: 'ht', confidence: 0.8, speechFinal: true });
    expect(options.onInterim).toHaveBeenCalledWith({ text: 'Mwen', lang: 'ht', confidence: 1, speechFinal: false });
    handle.stop();
    expect(context.processor.onaudioprocess).toBeNull();
    expect(context.processor.disconnect).toHaveBeenCalledOnce();
    expect(context.source.disconnect).toHaveBeenCalledOnce();
    expect(context.gain.disconnect).toHaveBeenCalledOnce();
    expect(context.close).toHaveBeenCalledOnce();
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'stop_recording' }));
  });

  it('closes the Gladia AudioContext when microphone permission is rejected', async () => {
    media.getUserMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    await expect(start({ provider: 'gladia' }).promise).rejects.toThrow('Microphone access');
    expect(FakeAudioContext.instances[0].close).toHaveBeenCalledOnce();
  });

  it('closes the Gladia context when resuming throws synchronously', async () => {
    vi.stubGlobal('AudioContext', class extends FakeAudioContext {
      constructor() {
        super();
        this.resume = vi.fn(() => { throw new Error('Audio resume failed'); });
      }
    });
    await expect(start({ provider: 'gladia' }).promise).rejects.toThrow('Audio resume failed');
    expect(FakeAudioContext.instances[0].close).toHaveBeenCalledOnce();
    expect(media.getUserMedia).not.toHaveBeenCalled();
  });

  it('releases a late microphone result after Gladia resume fails', async () => {
    const capture = deferred();
    media.getUserMedia.mockReturnValue(capture.promise);
    vi.stubGlobal('AudioContext', class extends FakeAudioContext {
      constructor() {
        super();
        this.resume = vi.fn().mockRejectedValue(new Error('Resume rejected'));
      }
    });
    const pending = start({ provider: 'gladia' });
    await expect(pending.promise).rejects.toThrow('Resume rejected');
    capture.resolve(stream);
    await flush();
    expect(FakeAudioContext.instances[0].close).toHaveBeenCalledOnce();
    expect(stream.tracks[0].stop).toHaveBeenCalledOnce();
    expect(pending.options.createSession).not.toHaveBeenCalled();
  });

  it('releases the acquired microphone and context while resume is still pending', async () => {
    const resume = deferred();
    vi.stubGlobal('AudioContext', class extends FakeAudioContext {
      constructor() {
        super();
        this.resume = vi.fn(() => resume.promise);
      }
    });
    const pending = start({ provider: 'gladia' });
    await flush();
    pending.controller.abort();
    await expect(pending.promise).rejects.toHaveProperty('name', 'AbortError');
    resume.resolve();
    await flush();
    expect(FakeAudioContext.instances[0].close).toHaveBeenCalledOnce();
    expect(stream.tracks[0].stop).toHaveBeenCalledOnce();
    expect(pending.options.createSession).not.toHaveBeenCalled();
  });

  it('fails startup if Gladia audio processing is interrupted while requesting a session', async () => {
    const session = deferred();
    const pending = start({ provider: 'gladia', createSession: () => session.promise });
    await flush();
    const context = FakeAudioContext.instances[0];
    context.state = 'interrupted';
    context.onstatechange();
    await expect(pending.promise).rejects.toThrow('interrupted by the browser');
    session.resolve(sessions.gladia);
    await flush();
    expect(FakeSocket.instances).toHaveLength(0);
    expect(context.close).toHaveBeenCalledOnce();
    expect(stream.tracks[0].stop).toHaveBeenCalledOnce();
  });

  it('cleans up if Gladia graph creation fails after creating a source', async () => {
    const pending = start({ provider: 'gladia' });
    await flush();
    const context = FakeAudioContext.instances[0];
    context.createScriptProcessor.mockImplementation(() => { throw new Error('Unsupported processor'); });
    const socket = FakeSocket.instances[0];
    socket.open();
    await expect(pending.promise).rejects.toThrow('could not start audio recording');
    expect(context.source.disconnect).toHaveBeenCalledOnce();
    expect(context.close).toHaveBeenCalledOnce();
    expect(socket.close).toHaveBeenCalledOnce();
    expect(stream.tracks[0].stop).toHaveBeenCalledOnce();
  });

  it('stops all capture if Gladia processing is suspended after connection', async () => {
    const { socket, options } = await connected({ provider: 'gladia' });
    const context = FakeAudioContext.instances[0];
    const lateStateChange = context.onstatechange;
    context.state = 'suspended';
    context.onstatechange();
    expect(options.onError).toHaveBeenCalledWith(expect.stringContaining('interrupted by the browser'));
    expect(options.onEnded).toHaveBeenCalledOnce();
    expect(context.onstatechange).toBeNull();
    expect(context.processor.disconnect).toHaveBeenCalledOnce();
    expect(context.source.disconnect).toHaveBeenCalledOnce();
    expect(context.gain.disconnect).toHaveBeenCalledOnce();
    expect(context.close).toHaveBeenCalledOnce();
    expect(stream.tracks[0].stop).toHaveBeenCalledOnce();
    expect(socket.close).toHaveBeenCalledOnce();
    lateStateChange();
    expect(options.onEnded).toHaveBeenCalledOnce();
  });

  it('cleans Gladia graphs and audio tracks when its socket disconnects', async () => {
    const { socket, options } = await connected({ provider: 'gladia' });
    const context = FakeAudioContext.instances[0];
    socket.end(1006);
    expect(context.close).toHaveBeenCalledOnce();
    expect(context.processor.disconnect).toHaveBeenCalledOnce();
    expect(stream.tracks[0].stop).toHaveBeenCalledOnce();
    expect(options.onEnded).toHaveBeenCalledOnce();
  });
});
