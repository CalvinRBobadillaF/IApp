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

const getInitialModelFeature = () => {
  const preferred = localStorage.getItem("ModelFeature");
  const keyForModel = {
    Gemini: "Gemini Key",
    GPT: "GPT Key",
    Claude: "Claude Key",
  };

  if (keyForModel[preferred] && localStorage.getItem(keyForModel[preferred])) {
    return preferred;
  }

  return Object.keys(keyForModel).find((model) => localStorage.getItem(keyForModel[model])) || "Gemini";
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

  const [modelFeature, setModelFeature] = useState(getInitialModelFeature);
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
    localStorage.setItem("ModelFeature", modelFeature);
  }, [modelFeature]);

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
  const onSent = async (customPrompt) => {
    const prompt = customPrompt ?? userPrompt;
    if (!prompt.trim() || loading) return;

    const activeModel = modelFeature;
    let activeChatId = currentChatId;
    if (!activeChatId) {
      activeChatId = crypto.randomUUID();
    }

    setLoading(true);
    setResultData("");
    setUserPrompt("");

    const userMessage = { role: "user", text: prompt };
    
    setCurrentChatId(activeChatId);
    setChatsByModel((prev) => {
      const modelChats = prev[activeModel] || [];
      const chatExists = modelChats.some((chat) => chat.id === activeChatId);
      const nextChats = chatExists
        ? modelChats.map((chat) => chat.id === activeChatId
          ? { ...chat, messages: [...chat.messages, userMessage] }
          : chat)
        : [...modelChats, { id: activeChatId, messages: [userMessage] }];

      return { ...prev, [activeModel]: nextChats };
    });

    try {
      const response = await sendPrompt({ model: activeModel, prompt });

      // Parseo real guardado en historial (incluyendo imágenes)
      const tokens = parsedMessage(response);
      
      setChatsByModel(prev => ({
        ...prev,
        [activeModel]: (prev[activeModel] || []).map(chat =>
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
        localStorage.removeItem('User')
        localStorage.removeItem('Model')
        localStorage.removeItem('ModelGPT')
        localStorage.removeItem('ModelClaude')
        localStorage.removeItem('ModelFeature')
        localStorage.removeItem('currentChatId')
        localStorage.removeItem('chatsByModel')
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
