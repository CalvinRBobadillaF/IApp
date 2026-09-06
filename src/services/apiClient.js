const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export async function sendChatRequest({ provider, model, prompt }) {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, model, prompt }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || "The API could not process the request.");
  }

  return data.text;
}
