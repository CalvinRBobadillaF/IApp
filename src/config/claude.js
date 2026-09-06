import { sendChatRequest } from "../services/apiClient";

export async function MainClaude(prompt) {
  const userModel = localStorage.getItem("ModelClaude");
  const model = userModel?.replace(/["\\]/g, "") || "claude-opus-5";
  return sendChatRequest({ provider: "Claude", model, prompt });
}
