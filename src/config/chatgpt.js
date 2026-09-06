import { sendChatRequest } from "../services/apiClient";

// ✅ Fix: export con el nombre que espera router.js
export const MainGPT = async (prompt) => {
  const userModel = localStorage.getItem("ModelGPT");
  const model = userModel?.replace(/["\\]/g, "") || "gpt-5.6-terra";
  return sendChatRequest({ provider: "GPT", model, prompt });
};
