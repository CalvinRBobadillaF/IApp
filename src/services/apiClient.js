const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || '/api/v1').replace(/\/+$/, '');

async function apiRequest(path, { signal, timeout = 180_000, ...options } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeout);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { ...options, signal: controller.signal, cache: 'no-store' });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      let message = typeof data?.detail === 'string' ? data.detail : '';
      if (!message && Array.isArray(data?.detail)) message = data.detail.map(item => item.msg).join('; ');
      if (!message) message = response.status === 404
        ? 'API route not found. Check VITE_API_BASE_URL ends in /api/v1 and deploy the updated backend.'
        : `The API returned HTTP ${response.status}. Check the backend logs.`;
      throw new Error(message);
    }
    if (!data || typeof data !== 'object') throw new Error('The API returned an unexpected response. Check the configured API URL.');
    return data;
  } catch (error) {
    if (timedOut) throw new Error('The request timed out. The service may be waking up; please try again.');
    if (error instanceof TypeError) throw new Error('Cannot reach the API. Check your connection, backend URL, and allowed frontend origin.');
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export async function sendChatRequest(payload, { signal } = {}) {
  const data = await apiRequest('/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload), signal });
  if (typeof data.text !== 'string') throw new Error('The API response is missing its text field. Deploy the updated backend.');
  return { ...data, images: Array.isArray(data.images) ? data.images : [], warnings: Array.isArray(data.warnings) ? data.warnings : [] };
}

export async function getModelCatalog(signal) {
  const data = await apiRequest('/models', { signal, timeout: 20_000 });
  for (const key of ['Gemini', 'GPT', 'Claude']) {
    if (!Array.isArray(data[key]?.models) || !data[key].models.length || typeof data[key].default_model !== 'string') {
      throw new Error('Invalid model catalog');
    }
  }
  return data;
}
