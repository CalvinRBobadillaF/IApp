import './Modal.css'
import { assets } from "../../assets/assets";
import { useContext, useState, useEffect } from 'react';
import { Context } from '../../Context/Context'

const CLAUDE_MODELS = [
  { label: 'Claude Opus 5', value: 'claude-opus-5' },
  { label: 'Claude Sonnet 5', value: 'claude-sonnet-5' },
  { label: 'Claude Haiku 4.5', value: 'claude-haiku-4-5-20251001' },
];

const GEMINI_MODELS = [
  { label: 'Gemini 3.8 Flash', value: 'gemini-3.8-flash' },
  { label: 'Gemini 3.7 Flash', value: 'gemini-3.7-flash' },
  { label: 'Gemini 3.5 Flash', value: 'gemini-3.5-flash' },
  { label: 'Gemini 3.5 Flash-Lite', value: 'gemini-3.5-flash-lite' },
  { label: 'Gemini 3.1 Pro (Preview)', value: 'gemini-3.1-pro-preview' },
];

const GPT_MODELS = [
  { label: 'GPT-5.6 Sol', value: 'gpt-5.6-sol' },
  { label: 'GPT-5.6 Terra', value: 'gpt-5.6-terra' },
  { label: 'GPT-5.6 Luna', value: 'gpt-5.6-luna' },
];

// Config por feature — fuera del componente para no recrearse en cada render
const FEATURE_CONFIG = {
  Claude: { storageKey: 'ModelClaude', defaultModel: 'claude-opus-5', models: CLAUDE_MODELS },
  GPT:    { storageKey: 'ModelGPT', defaultModel: 'gpt-5.6-terra', models: GPT_MODELS },
  Gemini: { storageKey: 'Model', defaultModel: 'gemini-3.8-flash', models: GEMINI_MODELS },
};

const Modal = () => {
  const userStorage = localStorage.getItem("User");
  const user = userStorage ? userStorage.replace(/["\\]/g, "") : "User";

  const { openModal, modelFeature, setOpenModal } = useContext(Context);

  const config = FEATURE_CONFIG[modelFeature] ?? FEATURE_CONFIG.Gemini;

  // FIX #1: Leer modelo inicial de localStorage correctamente
  const getStoredModel = () => {
    const raw = localStorage.getItem(config.storageKey);
    const storedModel = raw?.replace(/["\\]/g, "");
    return config.models.some(({ value }) => value === storedModel)
      ? storedModel
      : config.defaultModel;
  };

  const [selectedModel, setSelectedModel] = useState(getStoredModel);

  // FIX #2: Resetear selectedModel cuando cambia el modelFeature
  useEffect(() => {
    setSelectedModel(getStoredModel());
  }, [modelFeature]);

  // Replace retired or invalid saved choices with a supported default.
  useEffect(() => {
    const storedModel = localStorage.getItem(config.storageKey)?.replace(/["\\]/g, "");
    if (!config.models.some(({ value }) => value === storedModel)) {
      localStorage.setItem(config.storageKey, JSON.stringify(config.defaultModel));
    }
  }, [config]);

  const saveModel = (value) => {
    localStorage.setItem(config.storageKey, JSON.stringify(value));
    setSelectedModel(value);
  };

  return (
    <div className="Modal-overlay" onClick={() => setOpenModal(false)}>
      <div className="Modal" onClick={(e) => e.stopPropagation()}>

        <button className="Modal-close" onClick={() => setOpenModal(false)} aria-label="Cerrar">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        <img src={assets.user_icon} alt="user" className="Modal-avatar" />
        <p className="Modal-username">{user}</p>

        <p className="Modal-label">
          {modelFeature} · <span className="Modal-current-model">{selectedModel}</span>
        </p>

        <div className="Modal-input">
          <div className="radio-group">
            {config.models.map(({ label, value }) => (
              <div
                key={value}
                className={`radio-option-modal ${selectedModel === value ? 'active' : ''}`}
                onClick={() => saveModel(value)}
              >
                {label}
                {selectedModel === value && (
                  <span className="radio-check">✓</span>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Modal;
