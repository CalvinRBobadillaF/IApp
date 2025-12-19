import { createContext, useEffect, useState } from "react";
import { sendPrompt } from "../services/router";

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
  const [userName, setUserName] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [modalModel, setModalModels] = useState('')
  const [theme, setTheme] = useState(false);
  const [models, setModels] = useState(false);
  const [geminiKey, setGeminiKey] = useState('')
  const [GPTKey, setGPTKey] = useState('')
  const [claudeKey, setClaudeKey] = useState('')

  const [modelFeature, setModelFeature] = useState("Gemini");

  /* =========================
     CHAT SYSTEM (BY MODEL)
  ========================== */

  const [chatsByModel, setChatsByModel] = useState(
    loadState("chatsByModel", {
      Gemini: [],
      GPT: [],
      Claude: []
    })
  );

  const [currentChatId, setCurrentChatId] = useState(
    loadState("currentChatId", null)
  );

  const [userPrompt, setUserPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultData, setResultData] = useState("");

  /* =========================
     PERSISTENCE
  ========================== */

  useEffect(() => {
    localStorage.setItem("chatsByModel", JSON.stringify(chatsByModel));
    localStorage.setItem("currentChatId", JSON.stringify(currentChatId));
  }, [chatsByModel, currentChatId]);

  /* =========================
     DERIVED STATE
  ========================== */

  const chats = chatsByModel[modelFeature];
  const currentChat =
    chats.find(chat => chat.id === currentChatId) || null;

  /* =========================
     CHAT ACTIONS
  ========================== */

  const newChat = () => {
    const id = crypto.randomUUID();

    setChatsByModel(prev => ({
      ...prev,
      [modelFeature]: [...prev[modelFeature], { id, messages: [] }]
    }));

    setCurrentChatId(id);
    setResultData("");
    setLoading(false);
    setUserPrompt("");
  };

  const loadChat = (id) => {
    setCurrentChatId(id);
    setResultData("");
    setLoading(false);
  };

  const deleteChat = (chatId) => {
    setChatsByModel(prev => {
      const filtered = prev[modelFeature].filter(c => c.id !== chatId);

      if (chatId === currentChatId) {
        const next = filtered.length ? filtered[filtered.length - 1].id : null;
        setCurrentChatId(next);
      }

      return {
        ...prev,
        [modelFeature]: filtered
      };
    });
  };

  

  /* =========================
     WORD ANIMATION
  ========================== */

  const delayWord = (i, word) => {
    setTimeout(() => {
      setResultData(prev => prev + word);
    }, 25 * i);
  };

  /* =========================
     SEND PROMPT
  ========================== */

  const onSent = async (customPrompt) => {
  const prompt = customPrompt ?? userPrompt;
  if (!prompt.trim()) return;

  if (!currentChatId) newChat();

  setLoading(true);
  setResultData("");
  setUserPrompt("");

  // --- 1. Agregar mensaje del usuario al estado ---
  setChatsByModel((prev) => ({
    ...prev,
    [modelFeature]: prev[modelFeature].map((chat) =>
      chat.id === currentChatId
        ? {
            ...chat,
            messages: [...chat.messages, { role: "user", text: prompt }],
          }
        : chat
    ),
  }));

  try {
    // --- 2. Llamada a la API ---
    const response = await sendPrompt({
      model: modelFeature,
      prompt,
    });

    // --- 3. Formateo de la respuesta (Markdown simple a HTML) ---
    const formatted = response
      .split("**")
      .map((seg, i) => (i % 2 === 1 ? `<b>${seg}</b>` : seg))
      .join("")
      .replace(/\*/g, "<br/>");

    // --- 4. Efecto de escritura (Typing effect) ---
    formatted.split(" ").forEach((w, i) => delayWord(i, w + " "));

    // --- 5. Agregar mensaje de la IA al historial del chat ---
    setChatsByModel((prev) => ({
      ...prev,
      [modelFeature]: prev[modelFeature].map((chat) =>
        chat.id === currentChatId
          ? {
              ...chat,
              messages: [...chat.messages, { role: "model", text: formatted }],
            }
          : chat
      ),
    }));
    
  } catch (err) {
    console.error(err);
    const errorMsg = "Ocurrió un error procesando tu solicitud.";

    // Agregar mensaje de error al chat
    setChatsByModel((prev) => ({
      ...prev,
      [modelFeature]: prev[modelFeature].map((chat) =>
        chat.id === currentChatId
          ? {
              ...chat,
              messages: [...chat.messages, { role: "model", text: errorMsg }],
            }
          : chat
      ),
    }));

    setResultData(errorMsg);
  } finally {
    setLoading(false);
  }
};

  const handleDelete = (e, chatId) => {
        e.stopPropagation(); // evitar que dispare loadChat
        const ok = confirm("¿Seguro que quieres borrar este chat? Esta acción no se puede deshacer.");
        if (ok) deleteChat(chatId);
    };

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

  /* =========================
     MODEL SWITCH FIX
     (Evita chat fantasma)
  ========================== */

  useEffect(() => {
    const modelChats = chatsByModel[modelFeature];
    if (!modelChats.length) {
      setCurrentChatId(null);
    } else if (!modelChats.find(c => c.id === currentChatId)) {
      setCurrentChatId(modelChats[modelChats.length - 1].id);
    }
    setResultData("");
  }, [modelFeature]);

  /* =========================
     PROVIDER
  ========================== */

  return (
    <Context.Provider
      value={{
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
        setGPTKey,
        geminiKey,
        setGeminiKey,
        modalModel,
        setModalModels,
        GPTKey,
        modelFeature,
        claudeKey,
        setClaudeKey,
        deleteStorage,
        handleDelete,
        resetStorage,
        setModelFeature
      }}
    >
      {children}
    </Context.Provider>
  );
};

export default ContextProvider;


