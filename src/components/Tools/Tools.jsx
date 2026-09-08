import { useContext } from 'react';
import { Context } from '../../Context/context.js';
import Icon from '../Chat/Icon.jsx';
import '../Chat/Chat.css';
import './Tools.css';

export default function Tools({ onOpenInterpreter }) {
  const { modelFeature, openSidebar, setOpenSidebar, setOpenModal } = useContext(Context);
  return (
    <main className={`iapp-chat iapp-chat-${modelFeature.toLowerCase()} iapp-tools`}>
      <header className="chat-header">
        <div className="chat-header-left">
          <button type="button" className="chat-icon-button chat-mobile-menu" aria-label="Toggle navigation" aria-expanded={openSidebar} onClick={() => setOpenSidebar(!openSidebar)}><Icon name="menu" /></button>
          <h1>Tools</h1>
        </div>
        <button type="button" className="chat-icon-button" aria-label="Open settings" onClick={() => setOpenModal(true)}><Icon name="settings" /></button>
      </header>
      <div className="tools-content">
        <div className="tools-intro">
          <p className="tools-eyebrow">MORE WAYS TO WORK</p>
          <h2>A little help, in the moment.</h2>
          <p>Focused tools for the things you do beyond a chat.</p>
        </div>
        <button type="button" className="tools-card" onClick={onOpenInterpreter}>
          <span className="tools-card-symbol" aria-hidden="true">Aa<span>↔</span></span>
          <span className="tools-card-copy">
            <span className="tools-card-title">Interpreter AI</span>
            <span className="tools-card-description">Live transcription and translation for English, Spanish, and Haitian Kreyòl.</span>
            <span className="tools-card-meta">Microphone or browser tab · Session only</span>
            <span className="tools-card-action">Open interpreter <Icon name="arrow" /></span>
          </span>
        </button>
        <p className="tools-footnote">Audio capture begins only when you press Start inside the interpreter.</p>
      </div>
    </main>
  );
}
