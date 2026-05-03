import './Modal.css'
import { assets } from "../../assets/assets";
import { useContext, useState, useEffect } from 'react';
import { Context } from '../../Context/Context'

const CLAUDE_MODELS = [
  { label: 'Claude Opus 4.7',   value: 'claude-opus-4-7' },
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
  { label: 'GPT-5.5',      value: 'gpt-5.5' },       // NUEVO
  { label: 'GPT-5',        value: 'gpt-5' },
  { label: 'GPT-5.2',      value: 'gpt-5.2' },
  { label: 'GPT-5 Mini',   value: 'gpt-5-mini' },
  { label: 'GPT-5 Nano',   value: 'gpt-5-nano' },
];

// Config por feature — fuera del componente para no recrearse en cada render
const FEATURE_CONFIG = {
  Claude: { storageKey: 'ModelClaude', defaultModel: 'claude-opus-4-7', models: CLAUDE_MODELS },
  GPT:    { storageKey: 'ModelGPT',    defaultModel: 'gpt-5',            models: GPT_MODELS    },
  Gemini: { storageKey: 'Model',       defaultModel: 'gemini-2.5-flash', models: GEMINI_MODELS },
};

const Modal = () => {
  const userStorage = localStorage.getItem("User");
  const user = userStorage ? userStorage.replace(/["\\]/g, "") : "User";

  const { openModal, modelFeature, setOpenModal } = useContext(Context);

  const config = FEATURE_CONFIG[modelFeature] ?? FEATURE_CONFIG.Gemini;

  // FIX #1: Leer modelo inicial de localStorage correctamente
  const getStoredModel = () => {
    const raw = localStorage.getItem(config.storageKey);
    return raw ? raw.replace(/["\\]/g, "") : config.defaultModel;
  };

  const [selectedModel, setSelectedModel] = useState(getStoredModel);

  // FIX #2: Resetear selectedModel cuando cambia el modelFeature
  // Sin esto, al pasar de Claude a GPT el checkmark quedaba en el modelo
  // de Claude hasta que el usuario hacía clic en algo.
  useEffect(() => {
    setSelectedModel(getStoredModel());
  }, [modelFeature]);

  // FIX #3: Inicializar el modelo en localStorage si no existe
  // ANTES: esto se hacía en el body del render (side-effect durante render)
  // lo que podía causar re-renders infinitos. Ahora con useEffect es correcto.
  useEffect(() => {
    if (!localStorage.getItem(config.storageKey)) {
      localStorage.setItem(config.storageKey, JSON.stringify(config.defaultModel));
    }
  }, [config.storageKey, config.defaultModel]);

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
