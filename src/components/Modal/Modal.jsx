import './Modal.css'
import { assets } from "../../assets/assets";
import { useContext, useState } from 'react';
import { Context } from '../../Context/Context'

const CLAUDE_MODELS = [
  { label: 'Claude opus 4.7', value: 'claude-opus-4-7' },
  { label: 'Claude Sonnet 4.6', value: 'claude-sonnet-4-6' },
  { label: 'Claude Haiku 4.5',  value: 'claude-haiku-4-5-20251001' },
  { label: 'Claude Opus 4.6',   value: 'claude-opus-4-6' },
];

const GEMINI_MODELS = [
  { label: 'Gemini Flash',  value: 'gemini-2.5-flash' },
  { label: 'Gemini Pro',    value: 'gemini-2.5-pro' },
  { label: 'Gemini Ultra',  value: 'gemini-3-pro-preview' },
  { label: 'Gemini Lite',   value: 'gemini-2.5-flash-lite' },
];

const GPT_MODELS = [
  { label: 'GPT-5 Nano', value: 'gpt-5-nano' },
  { label: 'GPT-5 Mini', value: 'gpt-5-mini' },
  { label: 'GPT-5.2',    value: 'gpt-5.2' },
  { label: 'GPT-5',      value: 'gpt-5' },
];

const Modal = () => {
  const userStorage = localStorage.getItem("User");
  const user = userStorage ? userStorage.replace(/["\\]/g, "") : "User";

  // Estado local para forzar re-render al cambiar modelo sin hackear `theme`
  const [selectedModel, setSelectedModel] = useState(null);

  const { openModal, modelFeature, setOpenModal } = useContext(Context);

  const saveModel = (storageKey, value) => {
    localStorage.setItem(storageKey, JSON.stringify(value));
    setSelectedModel(value); // re-render limpio
  };

  const config = {
    Claude: {
      storageKey: 'ModelClaude',
      defaultModel: 'claude-opus-4-7',
      models: CLAUDE_MODELS,
      currentRaw: localStorage.getItem('ModelClaude'),
    },
    GPT: {
      storageKey: 'ModelGPT',
      defaultModel: 'gpt-5',
      models: GPT_MODELS,
      currentRaw: localStorage.getItem('ModelGPT'),
    },
    Gemini: {
      storageKey: 'Model',
      defaultModel: 'gemini-2.5-flash',
      models: GEMINI_MODELS,
      currentRaw: localStorage.getItem('Model'),
    },
  }[modelFeature] || {};

  const currentModel = selectedModel
    ?? config.currentRaw?.replace(/["\\]/g, "")
    ?? config.defaultModel;

  if (!config.currentRaw) {
    saveModel(config.storageKey, config.defaultModel);
  }

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
          {modelFeature} · <span className="Modal-current-model">{currentModel}</span>
        </p>

        <div className="Modal-input">
          <div className="radio-group">
            {config.models?.map(({ label, value }) => (
              <div
                key={value}
                className={`radio-option-modal ${currentModel === value ? 'active' : ''}`}
                onClick={() => saveModel(config.storageKey, value)}
              >
                {label}
                {currentModel === value && (
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