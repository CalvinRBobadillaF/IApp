import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Context } from './context.js';
import { sendPrompt } from '../services/router.js';
import { getModelCatalog } from '../services/apiClient.js';
import { FALLBACK_CATALOG, initialModels, MODEL_STORAGE } from '../services/modelCatalog.js';
import { attachmentPayload, buildHistory, chatsReducer, emptyChats, initialSettings, normalizeChats,
  PROVIDERS, readStored, serializableChats, STORAGE_KEYS } from '../services/chatState.js';
import { MAX_FILES, MAX_TOTAL_BYTES, readAttachment, validateFile } from '../services/attachments.js';

export default function ContextProvider({ children }) {
  const [settings, setSettings] = useState(initialSettings);
  const { privacyMode, saveHistory } = settings;
  const [instructions, setInstructions] = useState('');
  const [chatsByModel, dispatch] = useReducer(chatsReducer, null, () =>
    initialSettings().saveHistory ? normalizeChats(readStored(STORAGE_KEYS.chats, {})) : emptyChats());
  const [modelFeature, changeProvider] = useState(() => {
    const provider = readStored('ModelFeature', 'Gemini');
    return PROVIDERS.includes(provider) ? provider : 'Gemini';
  });
  const [modelCatalog, setModelCatalog] = useState(FALLBACK_CATALOG);
  const [selectedModels, setSelectedModels] = useState(initialModels);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [userName, setUserName] = useState(() => {
    const value = readStored('User', '');
    return typeof value === 'string' ? value : '';
  });
  const [signedIn, setSignedIn] = useState(() => {
    const value = readStored('User', '');
    return typeof value === 'string' && Boolean(value.trim());
  });
  const [userPrompt, setUserPrompt] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const [mode, changeMode] = useState('chat');
  const [error, setError] = useState('');
  const [contextNotice, setContextNotice] = useState('');
  const [storageWarning, setStorageWarning] = useState('');
  const [pending, setPending] = useState(null);
  const [openSidebar, setOpenSidebar] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [models, setModels] = useState(false);
  const [activeSection, changeSection] = useState('chat');
  const requestRef = useRef(null);
  const fileReadRef = useRef({ generation: 0, busy: false });
  const chats = chatsByModel[modelFeature].filter(chat => chat.private === privacyMode);
  const currentChat = chats.find(chat => chat.id === currentChatId) || null;

  const writeStored = useCallback((key, value) => {
    try {
      if (value === undefined) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      setStorageWarning('Browser storage is unavailable or full. This session will continue in memory; export important text before closing.');
      return false;
    }
  }, []);

  useEffect(() => {
    // Old browser API credentials are unused after the backend migration.
    for (const key of ['Gemini Key', 'GPT Key', 'Claude Key']) writeStored(key, undefined);
    const controller = new AbortController();
    getModelCatalog(controller.signal).then(catalog => {
      setModelCatalog(catalog);
      setSelectedModels(previous => Object.fromEntries(PROVIDERS.map(provider => [provider,
        catalog[provider].models.some(m => m.value === previous[provider])
          ? previous[provider] : catalog[provider].default_model])));
    }).catch(() => { /* Offline/dev fallback remains usable. */ });
    return () => controller.abort();
  }, [writeStored]);

  useEffect(() => {
    writeStored(STORAGE_KEYS.settings, settings);
    if (saveHistory) writeStored(STORAGE_KEYS.chats, serializableChats(chatsByModel));
    else writeStored(STORAGE_KEYS.chats, undefined);
    // Selection is session-local; never persist a private session identifier.
    writeStored('currentChatId', undefined);
  }, [chatsByModel, settings, saveHistory, writeStored]);

  useEffect(() => {
    writeStored('ModelFeature', modelFeature);
    for (const provider of PROVIDERS) writeStored(MODEL_STORAGE[provider], selectedModels[provider]);
  }, [modelFeature, selectedModels, writeStored]);

  useEffect(() => () => {
    requestRef.current?.controller.abort();
    requestRef.current = null;
    fileReadRef.current.generation++;
  }, []);

  const cancelRequest = useCallback(() => {
    const request = requestRef.current;
    if (!request) return;
    requestRef.current = null;
    request.controller.abort();
    dispatch({ type: 'finish', provider: request.provider, chatId: request.chatId, userId: request.userId, status: 'cancelled' });
    setPending(null);
  }, []);

  const resetDraft = useCallback(() => {
    fileReadRef.current = { generation: fileReadRef.current.generation + 1, busy: false };
    setAttachmentsLoading(false);
    setAttachments([]);
    setAttachmentError('');
    setUserPrompt('');
    setError('');
    setContextNotice('');
  }, []);

  const newChat = useCallback(() => {
    cancelRequest();
    resetDraft();
    changeSection('chat');
    changeMode('chat');
    const id = crypto.randomUUID();
    dispatch({ type: 'new', provider: modelFeature, chat: { id, private: privacyMode, messages: [] } });
    setCurrentChatId(id);
    return id;
  }, [cancelRequest, resetDraft, modelFeature, privacyMode]);

  const setModelFeature = useCallback(provider => {
    if (!PROVIDERS.includes(provider) || provider === modelFeature) return;
    cancelRequest();
    resetDraft();
    changeProvider(provider);
    changeMode('chat');
    setCurrentChatId(null);
    setModels(false);
  }, [cancelRequest, resetDraft, modelFeature]);

  const setPrivacyMode = useCallback(value => {
    if (Boolean(value) === privacyMode) return;
    cancelRequest();
    resetDraft();
    dispatch({ type: 'discardPrivate' });
    setCurrentChatId(null);
    setSettings(previous => ({ ...previous, privacyMode: Boolean(value) }));
  }, [cancelRequest, resetDraft, privacyMode]);

  const setSaveHistory = value => setSettings(previous => ({ ...previous, saveHistory: Boolean(value) }));
  const setSelectedModel = (provider, value) => {
    if (modelCatalog[provider]?.models.some(item => item.value === value)) {
      setSelectedModels(previous => ({ ...previous, [provider]: value }));
    }
  };
  const setMode = value => {
    if (!['chat', 'image'].includes(value)) return;
    if (value === 'image' && !modelCatalog[modelFeature].image_model) {
      setError('This provider can analyze images but cannot generate them. Choose GPT or Gemini.');
      return;
    }
    if (requestRef.current) return;
    // Preserve file selection; image mode visibly requires removing files first.
    changeMode(value);
    setError('');
  };

  const loadChat = id => {
    if (!chats.some(chat => chat.id === id)) return;
    cancelRequest();
    resetDraft();
    changeSection('chat');
    changeMode('chat');
    setCurrentChatId(id);
  };
  const deleteChat = id => {
    if (requestRef.current?.chatId === id) cancelRequest();
    dispatch({ type: 'delete', provider: modelFeature, chatId: id });
    if (currentChatId === id) { setCurrentChatId(null); resetDraft(); }
  };
  const clearHistory = () => {
    cancelRequest();
    resetDraft();
    dispatch({ type: 'clear' });
    setCurrentChatId(null);
    writeStored(STORAGE_KEYS.chats, undefined);
  };

  const addAttachments = async fileList => {
    if (fileReadRef.current.busy || requestRef.current) return;
    if (mode === 'image') { setAttachmentError('Image creation accepts a text description. Switch to Chat to analyze files.'); return; }
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const generation = fileReadRef.current.generation;
    try {
      if (attachments.length + files.length > MAX_FILES) throw new Error('Attach up to 4 files per message.');
      if ([...attachments, ...files].reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_BYTES) {
        throw new Error('Attachments must total 12 MB or less.');
      }
      files.forEach(validateFile);
      fileReadRef.current.busy = true;
      setAttachmentsLoading(true);
      setAttachmentError('');
      const added = await Promise.all(files.map(readAttachment));
      if (generation === fileReadRef.current.generation) setAttachments(previous => [...previous, ...added]);
    } catch (caught) {
      if (generation === fileReadRef.current.generation) setAttachmentError(caught.message);
    } finally {
      if (generation === fileReadRef.current.generation) {
        fileReadRef.current.busy = false;
        setAttachmentsLoading(false);
      }
    }
  };

  const onSent = async customPrompt => {
    const prompt = typeof customPrompt === 'string' ? customPrompt : userPrompt;
    if ((!prompt.trim() && !attachments.length) || requestRef.current || fileReadRef.current.busy) return;
    if (prompt.length > 100_000) { setError('This message is too long. Limit it to 100,000 characters.'); return; }
    if (mode === 'image' && (attachments.length || !prompt.trim())) {
      setError('For image creation, enter a description and remove file attachments. Use Chat for file analysis.');
      return;
    }
    const chatId = currentChat?.id || crypto.randomUUID();
    const userId = crypto.randomUUID();
    const request = { provider: modelFeature, chatId, userId, controller: new AbortController() };
    // A synchronous lock prevents same-tick double clicks and overlapping requests.
    requestRef.current = request;
    setPending({ chatId, provider: modelFeature });
    setCurrentChatId(chatId);
    setError('');
    setUserPrompt('');
    setAttachments([]);
    setAttachmentError('');
    const { history, notice } = buildHistory(currentChat?.messages || [], { privacyMode, attachments, mode });
    setContextNotice(notice);
    dispatch({ type: 'send', provider: modelFeature, chatId, private: privacyMode,
      message: { id: userId, role: 'user', text: prompt, attachments, status: 'pending' } });
    try {
      const response = await sendPrompt({
        provider: modelFeature, model: selectedModels[modelFeature], prompt,
        privacy_mode: privacyMode, history, instructions: privacyMode ? '' : instructions,
        attachments: attachments.map(attachmentPayload), mode,
      }, { signal: request.controller.signal });
      if (requestRef.current !== request) return;
      dispatch({ type: 'finish', provider: modelFeature, chatId, userId, status: 'complete',
        message: { id: crypto.randomUUID(), role: 'assistant', text: response.text,
          images: response.images, model: response.model, status: 'complete' } });
      setContextNotice([notice, ...(response.warnings || [])].filter(Boolean).join(' '));
    } catch (caught) {
      if (requestRef.current !== request) return;
      dispatch({ type: 'finish', provider: modelFeature, chatId, userId,
        status: caught.name === 'AbortError' ? 'cancelled' : 'failed' });
      if (caught.name !== 'AbortError') {
        setError(caught.message || 'Unable to send your request.');
        setUserPrompt(prompt);
        setAttachments(attachments);
      }
    } finally {
      if (requestRef.current === request) { requestRef.current = null; setPending(null); }
    }
  };

  const completeLogin = name => {
    const cleaned = name.trim().slice(0, 100);
    if (!cleaned) return;
    setUserName(cleaned);
    writeStored('User', cleaned);
    setSignedIn(true);
  };
  const resetStorage = () => {
    clearHistory();
    changeSection('chat');
    for (const key of ['User', ...Object.values(MODEL_STORAGE), 'ModelFeature', 'currentChatId',
      'Gemini Key', 'GPT Key', 'Claude Key', STORAGE_KEYS.settings]) writeStored(key, undefined);
    setInstructions('');
    setSettings({ privacyMode: true, saveHistory: true });
    setSelectedModels(Object.fromEntries(PROVIDERS.map(provider => [provider, modelCatalog[provider].default_model])));
    changeProvider('Gemini');
    changeMode('chat');
    setOpenModal(false);
    setOpenSidebar(false);
    setModels(false);
    setUserName('');
    setSignedIn(false);
  };
  const deleteStorage = event => {
    event?.stopPropagation();
    if (window.confirm('Clear all IApp chats, settings, and profile stored in this browser?')) resetStorage();
  };
  const handleDelete = (event, chatId) => {
    event?.stopPropagation();
    if (window.confirm('Delete this chat?')) deleteChat(chatId);
  };

  const setActiveSection = section => {
    if (!['chat', 'tools', 'interpreter'].includes(section)) return;
    cancelRequest();
    setOpenSidebar(false);
    setOpenModal(false);
    changeSection(section);
  };

  return <Context.Provider value={{
    chats, currentChat, currentChatId, loadChat, newChat, deleteChat, clearHistory,
    onSent, userPrompt, setUserPrompt, loading: Boolean(pending), pending, cancelRequest,
    error, dismissError: () => setError(''), attachments, addAttachments,
    removeAttachment: id => setAttachments(previous => previous.filter(file => file.id !== id)),
    attachmentError, attachmentsLoading, mode, setMode, privacyMode, setPrivacyMode,
    instructions, setInstructions, saveHistory, setSaveHistory, storageWarning, contextNotice,
    modelFeature, setModelFeature, selectedModels, setSelectedModel, modelCatalog,
    openSidebar, setOpenSidebar, openModal, setOpenModal, models, setModels,
    userName, setUserName, signedIn, completeLogin, deleteStorage, handleDelete, resetStorage,
    activeSection, setActiveSection,
  }}>{children}</Context.Provider>;
}
