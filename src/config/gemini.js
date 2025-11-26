
const apiKey = 'AIzaSyCxPfIqgvVQLuRv9Pzrw_-R6noo3WECV7A'; 

import { GoogleGenAI } from "@google/genai";

//Pasamos el apikey al constructor de IA
const ai = new GoogleGenAI({ apiKey: apiKey });


//Con una funcion asincrona tratamos de hacer fecth a la gemini api.
async function main(prompt) {
    try {
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
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