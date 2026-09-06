import { sendChatRequest } from './apiClient.js';
import { PROVIDERS } from './chatState.js';

export function sendPrompt(request, options) {
  if (!PROVIDERS.includes(request.provider)) throw new Error('Unsupported provider.');
  return sendChatRequest(request, options);
}
