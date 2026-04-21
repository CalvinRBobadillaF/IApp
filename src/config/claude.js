import Anthropic from "@anthropic-ai/sdk";

const rawKey = localStorage.getItem("Claude Key");
const apiKey = rawKey?.replace(/["\\]/g, "");

export async function MainClaude(prompt) {
  const userModel = localStorage.getItem('ModelClaude');
  const model = userModel?.replace(/["\\]/g, "") || "claude-sonnet-4-6";

  const client = new Anthropic({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true
  });

  try {
    const response = await client.messages.create({
      model: model,
      max_tokens: 8096, // ✅ Fix: era 1000, causaba respuestas cortadas
      messages: [
        { role: 'user', content: prompt }
      ],
    });

    const text = response.content
      ?.filter(item => item.type === "text")
      .map(item => item.text)
      .join("");

    return text || "Claude no devolvió texto.";

  } catch (error) {
    console.error("Error en claudeService:", error);
    return "Error al generar la respuesta.";
  }
}