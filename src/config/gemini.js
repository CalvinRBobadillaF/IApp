import { sendChatRequest } from "../services/apiClient";

export async function main(prompt) {
  const userModel = localStorage.getItem("Model");
  const model = userModel?.replace(/["\\]/g, "") || "gemini-3.8-flash";
  return sendChatRequest({ provider: "Gemini", model, prompt });
}

export default main;
