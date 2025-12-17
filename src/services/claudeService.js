import { MainClaude } from "../config/claude"


export const claudeService = async (prompt) => {
    return await MainClaude(prompt)
}