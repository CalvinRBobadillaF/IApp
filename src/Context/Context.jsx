import { createContext, useEffect, useState, useCallback } from "react";
import { sendPrompt } from "../services/router";
import { parsedMessage } from "../services/parsedMessage";

export const Context = createContext();

/* ============================================================
   HELPERS
   ============================================================ */
const loadState = (key, defaultValue) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
};

const ContextProvider = ({ children }) => {
  /* ============================================================
     ESTADO
     ============================================================ */
  const [openSidebar, setOpenSidebar] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [modalModel, setModalModels] = useState("");
  const [userName, setUserName] = useState("");
  const [theme, setTheme] = useState(false);
  const [models, setModels] = useState(false);
  
  // Keys de API
  const [geminiKey, setGeminiKey] = useState("");
  const [GPTKey, setGPTKey] = useState("");
  const [claudeKey, setClaudeKey] = useState("");

  const [modelFeature, setModelFeature] = useState("Gemini");
  const [currentChatId, setCurrentChatId] = useState(() => loadState("currentChatId", null));
  const [chatsByModel, setChatsByModel] = useState(() => 
    loadState("chatsByModel", { Gemini: [], GPT: [], Claude: [] })
  );

  const [userPrompt, setUserPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultData, setResultData] = useState("");

  /* ============================================================
     DATOS DERIVADOS
     ============================================================ */
  const chats = chatsByModel[modelFeature] || [];
  const currentChat = chats.find((chat) => chat.id === currentChatId) || null;

  /* ============================================================
     EFECTOS
     ============================================================ */
  useEffect(() => {
    localStorage.setItem("chatsByModel", JSON.stringify(chatsByModel));
    localStorage.setItem("currentChatId", JSON.stringify(currentChatId));
  }, [chatsByModel, currentChatId]);

  useEffect(() => {
    const modelChats = chatsByModel[modelFeature] || [];
    if (!modelChats.length) {
      setCurrentChatId(null);
    } else if (!modelChats.find((c) => c.id === currentChatId)) {
      setCurrentChatId(modelChats[modelChats.length - 1].id);
    }
    setResultData("");
  }, [modelFeature]);

  /* ============================================================
     ACCIONES DE CHAT
     ============================================================ */
  const newChat = useCallback(() => {
    const id = crypto.randomUUID();
    setChatsByModel((prev) => ({
      ...prev,
      [modelFeature]: [...prev[modelFeature], { id, messages: [] }],
    }));
    setCurrentChatId(id);
    setResultData("");
    setLoading(false);
    setUserPrompt("");
    return id;
  }, [modelFeature]);

  const loadChat = (id) => {
    setCurrentChatId(id);
    setResultData("");
    setLoading(false);
  };

  const deleteChat = (chatId) => {
    setChatsByModel((prev) => {
      const filtered = prev[modelFeature].filter((c) => c.id !== chatId);
      if (chatId === currentChatId) {
        const next = filtered.length ? filtered[filtered.length - 1].id : null;
        setCurrentChatId(next);
      }
      return { ...prev, [modelFeature]: filtered };
    });
  };

  /* ============================================================
     LÓGICA DE ENVÍO
     ============================================================ */
  const delayWord = (i, word) => {
    setTimeout(() => {
      setResultData((prev) => prev + word);
    }, 25 * i);
  };

  const onSent = async (customPrompt) => {
    const prompt = customPrompt ?? userPrompt;
    if (!prompt.trim()) return;

    let activeChatId = currentChatId;
    if (!activeChatId) {
      activeChatId = newChat();
    }

    setLoading(true);
    setResultData("");
    setUserPrompt("");

    const userMessage = { role: "user", text: prompt };
    
    setChatsByModel(prev => ({
      ...prev,
      [modelFeature]: prev[modelFeature].map(chat =>
        chat.id === activeChatId
          ? { ...chat, messages: [...chat.messages, userMessage] }
          : chat
      )
    }));

    try {
      const response = await sendPrompt({ model: modelFeature, prompt });

      // Efecto visual "Typing" (simple html para streaming visual)
      const formatted = response
        .split("**")
        .map((seg, i) => (i % 2 === 1 ? `<b>${seg}</b>` : seg))
        .join("")
        .replace(/\*/g, "<br/>");

      formatted.split(" ").forEach((w, i) => delayWord(i, w + " "));

      // Parseo real guardado en historial (incluyendo imágenes)
      const tokens = parsedMessage(response);
      
      setChatsByModel(prev => ({
        ...prev,
        [modelFeature]: prev[modelFeature].map(chat =>
          chat.id === activeChatId
            ? { ...chat, messages: [...chat.messages, { role: "model", tokens }] }
            : chat
        )
      }));
    } catch (err) {
      console.error(err);
      setResultData("Error processing request.");
    } finally {
      setLoading(false);
    }
  };

  /* ============================================================
     GESTIÓN DE ALMACENAMIENTO
     ============================================================ */
  const resetStorage = () => {
        localStorage.removeItem('Gemini Key')
        localStorage.removeItem('GPT Key')
        localStorage.removeItem('Claude Key')
        window.location.reload()
  }

  const deleteStorage = (e) => {
        e.stopPropagation()
        const ok = confirm('Seguro que quieres eliminar local storage?')
        if (ok) resetStorage()
    }

  const handleDelete = (e, chatId) => {
    e.stopPropagation();
    if (confirm("¿Seguro que quieres borrar este chat?")) {
      deleteChat(chatId);
    }
  };

  const contextValue = {
    chats,
    currentChat,
    currentChatId,
    loadChat,
    newChat,
    deleteChat,
    onSent,
    userPrompt,
    setUserPrompt,
    loading,
    resultData,
    openSidebar,
    setOpenSidebar,
    userName,
    setUserName,
    openModal,
    setOpenModal,
    theme,
    setTheme,
    models,
    setModels,
    geminiKey,
    setGeminiKey,
    GPTKey,
    setGPTKey,
    claudeKey,
    setClaudeKey,
    modalModel,
    setModalModels,
    modelFeature,
    setModelFeature,
    deleteStorage,
    handleDelete,
    resetStorage,
  };

  return (
    <Context.Provider value={contextValue}>
      {children}
    </Context.Provider>
  );
};

export default ContextProvider;