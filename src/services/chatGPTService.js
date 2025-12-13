import { MainGPT } from "../config/chatgpt"


export const chatGPTService = async (prompt) => {
    return await MainGPT(prompt)
}