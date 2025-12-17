import { GeminiService } from "./geminiService";
import { chatGPTService } from "./chatGPTService";
import { claudeService } from "./claudeService";

export const AI_MODELS = {
  Gemini: GeminiService,
  GPT: chatGPTService,
  Claude: claudeService
};

export const sendPrompt = async ({ model, prompt }) => {
  const service = AI_MODELS[model];

  if (!service) {
    throw new Error(`Modelo no soportado: ${model}`);
  }

  return await service(prompt);
};