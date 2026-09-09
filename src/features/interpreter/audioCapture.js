import { SPEECH_LANGUAGES } from './languages.js';

const STARTUP_TIMEOUT_MS = 60_000;
const MAX_BUFFERED_BYTES = 256 * 1024;
const MAX_MESSAGE_CHARS = 256 * 1024;
const RECORDING_TYPES = [
  'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg', 'audio/mp4',
];

const abortError = () => new DOMException('Audio capture was cancelled.', 'AbortError');

function stopTracks(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}

function permissionError(error, source) {
  if (error?.name === 'NotAllowedError') {
    return new Error(source === 'tab'
      ? 'Tab sharing was cancelled or denied. Choose a browser tab and enable Share tab audio.'
      : 'Microphone access was denied. Allow microphone access in your browser and try again.');
  }
  if (error?.name === 'NotFoundError') return new Error('No audio input was found. Connect a microphone and try again.');
  if (error?.name === 'NotReadableError') return new Error('Audio capture is unavailable or the device is in use. Close other recording apps and try again.');
  return new Error('Could not start audio capture. Use HTTPS and a supported browser, then try again.');
}

function sessionOptions(session, provider) {
  let url;
  try {
    if (typeof session?.url !== 'string' || /\s/.test(session.url)) throw new Error();
    url = new URL(session.url);
  } catch { throw new Error('The backend returned an invalid transcription session.'); }
  const allowedHost = provider === 'deepgram'
    ? url.hostname === 'api.deepgram.com'
    : url.hostname === 'gladia.io' || url.hostname.endsWith('.gladia.io');
  const protocols = session.protocols ?? [];
  if (session.provider !== provider || !allowedHost || url.protocol !== 'wss:' || url.username || url.password || url.hash
      || (url.port && url.port !== '443') || !Array.isArray(protocols)
      || protocols.length > 2 || protocols.some((protocol) => typeof protocol !== 'string' || !protocol || protocol.length > 8192
        || !/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(protocol))
      || (provider === 'deepgram' && (protocols.length !== 2 || protocols[0] !== 'bearer'))
      || (provider === 'gladia' && protocols.length !== 0)) {
    throw new Error('The backend returned an invalid transcription session.');
  }
  return { url: url.href, protocols };
}

function directDeepgramOptions(apiKey, provider, language) {
  if (provider !== 'deepgram') throw new Error('A browser API key can only be used for transcription with Deepgram, not Kreyòl/Gladia.');
  if (typeof apiKey !== 'string' || !apiKey.trim() || apiKey.trim().length > 8192
      || !/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(apiKey.trim())) {
    throw new Error('Enter a valid raw Deepgram API key without quotes or an authorization prefix.');
  }
  // The opt-in compatibility path goes directly to the same fixed provider as
  // the backend session. Credentials belong only in the WebSocket subprotocol,
  // never in a URL, server request, transcript, or error message.
  const params = new URLSearchParams({
    model: 'nova-3', language, smart_format: 'true',
    punctuate: 'true', numerals: 'true', interim_results: 'true',
    filler_words: 'false', endpointing: '300', utterance_end_ms: '1200',
    no_delay: 'true', vad_events: 'true', diarize: 'false', mip_opt_out: 'true',
  });
  return { url: `wss://api.deepgram.com/v1/listen?${params}`, protocols: ['token', apiKey.trim()] };
}

// Explicit little-endian output, irrespective of the browser's platform.
function pcm16(samples) {
  const bytes = new ArrayBuffer(samples.length * 2);
  const view = new DataView(bytes);
  for (let index = 0; index < samples.length; index += 1) {
    const value = Number.isFinite(samples[index]) ? Math.max(-1, Math.min(1, samples[index])) : 0;
    view.setInt16(index * 2, value < 0 ? value * 0x8000 : value * 0x7fff, true);
  }
  return bytes;
}

/**
 * Owns one user-initiated browser audio session. The caller must abort when
 * navigating away. This module never persists credentials or audio.
 *
 * Resolves only after the socket opens and recording starts. Startup failures
 * reject; failures after startup notify onError(message), then onEnded(). An
 * explicit stop/abort is silent. Late permission/session results cannot restart
 * capture. Normally createSession requests short-lived backend credentials. The
 * explicit Deepgram-only compatibility option bypasses it using a supplied key.
 */
export async function startInterpreterAudio({
  source = 'mic', provider = 'deepgram', signal, createSession, deepgramApiKey, language = 'multi',
  onFinal, onInterim, onError, onEnded,
}) {
  if (signal?.aborted) throw abortError();
  if (!['mic', 'tab'].includes(source) || !['deepgram', 'gladia'].includes(provider)) {
    throw new Error('Choose a supported audio source and transcription provider.');
  }
  if (!['multi', ...SPEECH_LANGUAGES].includes(language)) throw new Error('Choose a supported speech language.');
  const directOptions = deepgramApiKey === undefined ? null : directDeepgramOptions(deepgramApiKey, provider, language);
  if (!directOptions && typeof createSession !== 'function') throw new Error('The interpreter backend is not configured.');
  const mediaDevices = navigator.mediaDevices;
  if (globalThis.isSecureContext === false || typeof WebSocket !== 'function'
      || typeof mediaDevices?.[source === 'mic' ? 'getUserMedia' : 'getDisplayMedia'] !== 'function') {
    throw new Error(source === 'tab'
      ? 'Tab audio capture needs HTTPS and a supported desktop browser such as Chrome or Edge.'
      : 'Microphone capture needs HTTPS and a browser with microphone support.');
  }
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  const mimeType = provider === 'deepgram' && typeof globalThis.MediaRecorder?.isTypeSupported === 'function'
    ? RECORDING_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) : null;
  if (provider === 'deepgram' && !mimeType) throw new Error('This browser cannot record a supported audio format. Try Chrome or Edge.');
  if (provider === 'gladia' && !AudioContextClass) throw new Error('This browser does not support the audio processing needed for Kreyòl.');

  return new Promise((resolve, reject) => {
    let stream, socket, recorder, audioContext, processor, audioSource, silentGain;
    let started = false;
    let stopped = false;
    const trackListeners = [];

    const finish = (error = null, notify = false) => {
      if (stopped) return;
      stopped = true;
      clearTimeout(startupTimer);
      signal?.removeEventListener('abort', abort);
      trackListeners.forEach(([track, listener]) => track.removeEventListener('ended', listener));
      if (recorder) {
        recorder.ondataavailable = recorder.onerror = recorder.onstop = null;
        try { if (recorder.state !== 'inactive') recorder.stop(); } catch { /* Already stopped by the browser. */ }
      }
      if (processor) processor.onaudioprocess = null;
      [processor, audioSource, silentGain].forEach((node) => {
        try { node?.disconnect(); } catch { /* Already disconnected. */ }
      });
      if (audioContext) {
        audioContext.onstatechange = null;
        if (audioContext.state !== 'closed') {
          try { Promise.resolve(audioContext.close()).catch(() => {}); } catch { /* Already closed. */ }
        }
      }
      if (socket) {
        socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
        try {
          if (started && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: provider === 'gladia' ? 'stop_recording' : 'CloseStream' }));
          }
        } catch { /* A failed closing message must not leave the connection open. */ }
        try { if (socket.readyState < WebSocket.CLOSING) socket.close(1000, 'Capture ended'); }
        catch { /* Network errors must not prevent releasing the microphone. */ }
      }
      stopTracks(stream);
      if (!started) reject(error || abortError());
      else if (notify) {
        // Consumer callbacks cannot prevent resource cleanup or leave a socket open.
        try { if (error) Promise.resolve(onError?.(error.message)).catch(() => {}); }
        catch { /* Cleanup still completes if the UI throws. */ }
        try { Promise.resolve(onEnded?.()).catch(() => {}); }
        catch { /* A callback must not cause a second lifecycle notification. */ }
      }
    };
    const abort = () => finish(abortError());
    const fail = (message) => finish(new Error(message), true);
    const startupTimer = setTimeout(() => fail('Audio startup timed out. Check permissions and your connection, then try again.'), STARTUP_TIMEOUT_MS);
    signal?.addEventListener('abort', abort, { once: true });

    const sendAudio = (data, size) => {
      if (stopped || !socket || socket.readyState !== WebSocket.OPEN || !size) return;
      if (size + socket.bufferedAmount > MAX_BUFFERED_BYTES) {
        fail('Your connection cannot keep up with live audio. Recording stopped; check your connection and restart.');
        return;
      }
      try { socket.send(data); } catch { fail('The transcription connection was lost. Please restart.'); }
    };

    const emitTranscript = (callback, result) => {
      // Transcript consumers can fail synchronously or asynchronously. Do not
      // leave the microphone recording when the UI can no longer process it.
      try {
        Promise.resolve(callback?.(result)).catch(() => fail('Could not process the transcript. Please restart recording.'));
      } catch { fail('Could not process the transcript. Please restart recording.'); }
    };

    const handleMessage = (event) => {
      if (stopped || !started || typeof event.data !== 'string') return;
      if (event.data.length > MAX_MESSAGE_CHARS) {
        fail('The transcription provider returned an oversized response. Please restart.');
        return;
      }
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (!message || typeof message !== 'object') return;
      if (message.type === 'error' || message.type === 'Error') {
        // Provider error payloads can include credentials/request content. Never expose them.
        fail('The transcription provider could not process this session. Check its configuration and try again.');
        return;
      }
      if (provider === 'deepgram') {
        if (message.type !== 'Results') return;
        const alternative = message.channel?.alternatives?.[0];
        const text = typeof alternative?.transcript === 'string' ? alternative.transcript.trim() : '';
        const confidence = Number.isFinite(alternative?.confidence) ? alternative.confidence : 0;
        const detected = language === 'multi' ? alternative?.languages?.[0] ?? 'en' : language;
        const lang = typeof detected === 'string' ? detected.slice(0, 2).toLowerCase() : '';
        const isFinal = message.is_final === true;
        if (!text || !SPEECH_LANGUAGES.includes(lang) || (!isFinal && confidence < 0.5)) return;
        emitTranscript(isFinal ? onFinal : onInterim, { text, lang, confidence, speechFinal: message.speech_final ?? isFinal });
      } else {
        if (message.type !== 'transcript') return;
        const utterance = message.data?.utterance;
        const text = typeof utterance?.text === 'string' ? utterance.text.trim() : '';
        if (!text) return;
        const confidence = Number.isFinite(utterance.confidence) ? utterance.confidence : 1;
        emitTranscript(message.data.is_final === true ? onFinal : onInterim, { text, lang: 'ht', confidence, speechFinal: message.data.is_final === true });
      }
    };

    const prepare = async () => {
      // Both calls happen before the first await, preserving the user's activation
      // for getDisplayMedia and AudioContext.resume (particularly mobile Safari).
      let audioReady = Promise.resolve();
      if (provider === 'gladia') {
        audioContext = new AudioContextClass({ sampleRate: 16000 });
        audioReady = Promise.resolve(audioContext.resume());
      }
      let capture;
      try {
        capture = source === 'tab'
          ? mediaDevices.getDisplayMedia({
            video: { width: { ideal: 1 }, height: { ideal: 1 }, frameRate: { ideal: 1 } },
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
          })
          : mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false,
          });
      } catch (error) {
        // Attach rejection handling even if requesting capture throws synchronously.
        audioReady.catch(() => {});
        throw permissionError(error, source);
      }
      const captured = Promise.resolve(capture).then((result) => {
        // getUserMedia/getDisplayMedia cannot be aborted: release any late result.
        if (stopped) { stopTracks(result); throw abortError(); }
        stream = result;
        stream.getVideoTracks().forEach((track) => { track.stop(); stream.removeTrack(track); });
        const audioTracks = stream.getAudioTracks();
        if (!audioTracks.length) throw new Error(source === 'tab'
          ? 'No tab audio was shared. Choose a browser tab and enable Share tab audio.'
          : 'The microphone returned no audio track. Choose another device and try again.');
        audioTracks.forEach((track) => {
          const listener = () => started ? finish(null, true)
            : fail('Audio sharing ended before transcription could start. Please start again.');
          track.addEventListener('ended', listener, { once: true });
          trackListeners.push([track, listener]);
          if (track.readyState === 'ended') throw new Error('Audio sharing ended before transcription could start.');
        });
      }, (error) => { throw permissionError(error, source); });
      await Promise.all([captured, audioReady]);
      if (stopped) return;
      if (audioContext && audioContext.state !== 'running') throw new Error('Audio processing is paused by the browser. Press Start again to allow it.');
      if (audioContext) {
        audioContext.onstatechange = () => {
          if (!stopped && audioContext.state !== 'running') {
            fail('Audio processing was interrupted by the browser. Please restart recording.');
          }
        };
      }
      let options = directOptions;
      if (!options) {
        const session = await createSession({ provider, sample_rate: audioContext?.sampleRate ?? 16000,
          ...(provider === 'deepgram' && language !== 'multi' ? { language } : {}) });
        if (stopped) return;
        options = sessionOptions(session, provider);
      }
      try { socket = new WebSocket(options.url, options.protocols); }
      catch { throw new Error('Could not open the transcription connection. Check your browser and connection, then try again.'); }
      socket.binaryType = 'arraybuffer';
      socket.onmessage = handleMessage;
      socket.onerror = () => fail(directOptions
        ? 'Could not connect to Deepgram. Check the supplied key, account permissions, billing, and your connection.'
        : 'Could not connect to the transcription provider. Check your connection and backend configuration.');
      socket.onclose = (event) => {
        if (!started || event.code !== 1000) fail('The transcription connection closed. Check your connection and restart.');
        else finish(null, true);
      };
      socket.onopen = () => {
        if (stopped) return;
        try {
          if (provider === 'deepgram') {
            recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32000 });
            recorder.ondataavailable = (event) => sendAudio(event.data, event.data?.size);
            recorder.onerror = () => fail('Audio recording failed. Check your microphone and try again.');
            recorder.onstop = () => fail('Audio recording stopped unexpectedly. Please restart.');
            recorder.start(100);
          } else {
            audioSource = audioContext.createMediaStreamSource(stream);
            // Kept for parity with InterpreterAI; replace with an AudioWorklet in
            // a dedicated audio-quality pass. The graph is always silent locally.
            processor = audioContext.createScriptProcessor(4096, 1, 1);
            silentGain = audioContext.createGain();
            silentGain.gain.value = 0;
            processor.onaudioprocess = (event) => {
              if (stopped) return;
              const data = pcm16(event.inputBuffer.getChannelData(0));
              sendAudio(data, data.byteLength);
            };
            audioSource.connect(processor);
            processor.connect(silentGain);
            silentGain.connect(audioContext.destination);
          }
          if (stopped) return;
          started = true;
          clearTimeout(startupTimer);
          resolve({ stop: () => finish() });
        } catch { fail('This browser could not start audio recording. Try another browser or audio source.'); }
      };
    };

    prepare().catch((error) => finish(error instanceof Error ? error : new Error('Audio startup failed. Please try again.')));
  });
}
