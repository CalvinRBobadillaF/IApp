


const rawKey = localStorage.getItem("Gemini Key");
const apiKey = rawKey?.replace(/["\\]/g, "");

const userModel = localStorage.getItem('Model')
const model = userModel?.replace(/["\\]/g, "")


import { GoogleGenAI } from "@google/genai";

async function main(prompt) {
  const ai = new GoogleGenAI({ apiKey: apiKey });
  
    try {
  
  const response = await ai.models.generateContent({
    model: model,
    contents: prompt,
config: { 
    logging_config: {
      
      log_client_interaction: false, 
    }
  }
  });
  
  console.log(response.text);
    return response.text
} catch (error) {
    console.error("Error generating content:", error);
}
}

export default main;


