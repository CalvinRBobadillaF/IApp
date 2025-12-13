import main from "../config/gemini"


export const GeminiService = async (prompt) => {
    return await main(prompt)
}