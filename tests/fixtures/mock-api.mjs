// Local-only browser QA. No provider keys, provider requests, or persistence.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { FALLBACK_CATALOG } from '../../src/services/modelCatalog.js';

const sampleImage = await readFile(new URL('../../src/assets/catProfile.jpeg', import.meta.url));
const server = createServer(async (request, response) => {
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Cache-Control', 'no-store');
  if (request.method === 'GET' && request.url === '/api/v1/interpreter/capabilities') {
    response.end(JSON.stringify({ languages: ['en', 'es', 'ht', 'fr', 'de', 'it', 'pt'],
      transcription: { deepgram: false, gladia: false }, translation: { deepl: false, google: false } }));
    return;
  }
  if (request.method === 'GET' && request.url === '/api/v1/models') {
    response.end(JSON.stringify(FALLBACK_CATALOG));
    return;
  }
  if (request.method === 'POST' && request.url === '/api/v1/chat') {
    try {
      let body = '';
      for await (const chunk of request) {
        body += chunk;
        if (body.length > 18 * 1024 * 1024) { response.writeHead(413).end('{}'); return; }
      }
      const payload = JSON.parse(body);
      const imageMode = payload.mode === 'image';
      response.end(JSON.stringify({
        provider: payload.provider,
        model: imageMode ? FALLBACK_CATALOG[payload.provider]?.image_model : payload.model,
        text: imageMode ? 'Local test image — this is an existing app asset, not AI-generated.'
          : 'Local test response. No AI request was made.\n\n```python\ndef hello(name):\n    return f"Hello, {name}!"\n```\n\n| Check | Result |\n| --- | --- |\n| Markdown | Ready |',
        images: imageMode ? [{ mime_type: 'image/jpeg', data: sampleImage.toString('base64') }] : [],
        warnings: ['LOCAL MOCK API: provider behavior, permissions, and quotas are not being tested.'],
      }));
    } catch { response.writeHead(400).end(JSON.stringify({ detail: 'Invalid local test request' })); }
    return;
  }
  response.writeHead(404).end('{}');
});
server.listen(8000, '127.0.0.1', () => process.stdout.write('Local MOCK API listening on http://127.0.0.1:8000\n'));
