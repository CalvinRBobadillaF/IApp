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

    // Add user message
    setChatsByModel(prev => ({
      ...prev,
      [modelFeature]: prev[modelFeature].map(chat =>
        chat.id === currentChatId
          ? {
              ...chat,
              messages: [...chat.messages, { role: "user", text: prompt }]
            }
          : chat
      )
    }));

    try {
      const response = await sendPrompt({
        model: modelFeature,
        prompt
      });

      const formatted = response
        .split("**")
        .map((seg, i) => (i % 2 === 1 ? `<b>${seg}</b>` : seg))
        .join("")
        .replace(/\*/g, "<br/>");

      formatted.split(" ").forEach((w, i) =>
        delayWord(i, w + " ")
      );

      // Add model message
      setChatsByModel(prev => ({
        ...prev,
        [modelFeature]: prev[modelFeature].map(chat =>
          chat.id === currentChatId
            ? {
                ...chat,
                messages: [...chat.messages, { role: "model", text: formatted }]
              }
            : chat
        )
      }));

    } catch (err) {
      console.error(err);

      const errorMsg = "Ocurrió un error procesando tu solicitud.";

      setChatsByModel(prev => ({
        ...prev,
        [modelFeature]: prev[modelFeature].map(chat =>
          chat.id === currentChatId
            ? {
                ...chat,
                messages: [...chat.messages, { role: "model", text: errorMsg }]
              }
            : chat
        )
      }));

      setResultData(errorMsg);
    }

    setLoading(false);
  };

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
        setModelFeature
      }}
    >
      {children}
    </Context.Provider>
  );
};

export default ContextProvider;


