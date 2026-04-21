import Anthropic from "@anthropic-ai/sdk";

export async function MainClaude(prompt) {
  // ✅ Fix crítico: leer DENTRO de la función, no a nivel de módulo
  // A nivel de módulo solo se lee una vez al cargar la app → modelo siempre el mismo
  const rawKey = localStorage.getItem("Claude Key");
  const apiKey = rawKey?.replace(/["\\]/g, "");

  const userModel = localStorage.getItem("ModelClaude");
  const model = userModel?.replace(/["\\]/g, "") || "claude-sonnet-4-7";

  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 8096,
      messages: [{ role: "user", content: prompt }],
    });

    return (
      response.content
        ?.filter((item) => item.type === "text")
        .map((item) => item.text)
        .join("") || "Claude no devolvió texto."
    );
  } catch (error) {
    console.error("Error en claudeService:", error);
    throw error;
  }
}