import { createContext, useEffect, useState } from "react";
import main from "../config/gemini";

export const Context = createContext();

const loadState = (key, defaultValue) => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : defaultValue;
    } catch {
        return defaultValue;
    }
};

const ContextProvider = ({ children }) => {
    const [openSidebar, setOpenSidebar] = useState(false);

    //Chat system:
    const [chats, setChats] = useState(loadState("chats", []));
    const [currentChatId, setCurrentChatId] = useState(loadState("currentChatId", null));

    const [userPrompt, setUserPrompt] = useState("");
    const [loading, setLoading] = useState(false);
    const [resultData, setResultData] = useState(""); // animación en tiempo real

    // Save the chats in LS
    useEffect(() => {
        localStorage.setItem("chats", JSON.stringify(chats));
        localStorage.setItem("currentChatId", JSON.stringify(currentChatId));
    }, [chats, currentChatId]);


    // Create new chat system:
    const newChat = () => {
        const id = crypto.randomUUID();
        const newChat = {
            id,
            messages: []
        };

        setChats(prev => [...prev, newChat]);
        setCurrentChatId(id);

        setResultData("");
        setLoading(false);
        setUserPrompt("");
    };


    // Get chat
    const currentChat = chats.find(c => c.id === currentChatId) || null;


    // load chat
    const loadChat = (id) => {
        setCurrentChatId(id);
        setResultData("");  
        setLoading(false);
    };


    // Word animation
    const delayWord = (i, word) => {
        setTimeout(() => {
            setResultData(prev => prev + word);
        }, 25 * i);
    };


    // Sent prompt
    const onSent = async (customPrompt) => {
        const prompt = customPrompt ?? userPrompt;
        if (!prompt.trim()) return;

        if (!currentChatId) newChat(); // New chat if there is 0

        setLoading(true);
        setResultData("");
        setUserPrompt('')

        // Add message
        setChats(prev =>
            prev.map(chat =>
                chat.id === currentChatId
                    ? { ...chat, messages: [...chat.messages, { role: "user", text: prompt }] }
                    : chat
            )
        );

        try {
            const response = await main(prompt);

            
            let formatted = response
                .split("**").map((seg, i) =>
                    i % 2 === 1 ? `<b>${seg}</b>` : seg
                ).join("")
                .replace(/\*/g, "<br/>");

            const words = formatted.split(" ");
            words.forEach((w, i) => delayWord(i, w + " "));

            
            setChats(prev =>
                prev.map(chat =>
                    chat.id === currentChatId
                        ? { ...chat, messages: [...chat.messages, { role: "model", text: formatted }] }
                        : chat
                )
            );

        } catch (err) {
            console.error(err);

            const errorMsg = "Ocurrió un error procesando tu solicitud.";

            setChats(prev =>
                prev.map(chat =>
                    chat.id === currentChatId
                        ? { ...chat, messages: [...chat.messages, { role: "model", text: errorMsg }] }
                        : chat
                )
            );

            setResultData(errorMsg);
        }

        setUserPrompt("");
        setLoading(false);
    };


    const deleteChat = (chatId) => {
        setChats(prev => {
            const filtered = prev.filter(c => c.id !== chatId);
           //Delete chat and get to the last one
            if (chatId === currentChatId) {
                
                const next = filtered.length ? filtered[filtered.length - 1].id : null;
                setCurrentChatId(next);
            }
            return filtered;
    })
}

    return (
        <Context.Provider
            value={{
                chats,
                currentChat,
                currentChatId,
                loadChat,
                newChat,
                onSent,
                userPrompt,
                setUserPrompt,
                loading,
                resultData,
                openSidebar,
                setOpenSidebar,
                deleteChat
            }}
        >
            {children}
        </Context.Provider>
    );
};

export default ContextProvider;

