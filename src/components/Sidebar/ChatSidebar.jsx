import { useContext, useEffect, useRef } from 'react';
import { Context } from '../../Context/context.js';
import Icon from '../Chat/Icon';
import './ChatSidebar.css';

const chatTitle = chat => (chat.messages[0]?.text || chat.messages[0]?.attachments?.[0]?.name || 'Empty chat').slice(0, 40);
function SidebarIcon({ name }) {
  if (name === 'plus' || name === 'trash') return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d={name === 'plus' ? 'M12 4v16M4 12h16' : 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7'} />
  </svg>;
  return <Icon name={name} />;
}

export default function ChatSidebar({ provider = 'Gemini' }) {
  const { chats, currentChatId, loadChat, newChat, openSidebar, setOpenSidebar,
    deleteStorage, handleDelete, setOpenModal, activeSection = 'chat', setActiveSection } = useContext(Context);
  const sidebarRef = useRef(null);
  useEffect(() => {
    if (!openSidebar) return;
    const outside = event => { if (!sidebarRef.current?.contains(event.target)) setOpenSidebar(false); };
    const escape = event => { if (event.key === 'Escape') setOpenSidebar(false); };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', escape); };
  }, [openSidebar, setOpenSidebar]);
  return <aside ref={sidebarRef} className={`iapp-sidebar iapp-sidebar-${provider.toLowerCase()} ${openSidebar ? 'is-open' : ''}`} aria-label={`${provider === 'GPT' ? 'ChatGPT' : provider} chat navigation`}>
    <button type="button" className="sidebar-menu" aria-label={openSidebar ? 'Close chat navigation' : 'Open chat navigation'} aria-expanded={openSidebar} onClick={() => setOpenSidebar(!openSidebar)}><SidebarIcon name="menu" /></button>
    <button type="button" className="sidebar-new" aria-label="New chat" title="New chat" onClick={() => { newChat(); setOpenSidebar(false); }}><SidebarIcon name="plus" />{openSidebar && <span>New chat</span>}</button>
    <nav className="sidebar-workspaces" aria-label="Workspace">
      <button type="button" aria-label="Chat" title="Chat" aria-current={activeSection === 'chat' ? 'page' : undefined} onClick={() => setActiveSection?.('chat')}><SidebarIcon name="chat" />{openSidebar && <span>Chat</span>}</button>
      <button type="button" aria-label="Tools" title="Tools" aria-current={activeSection !== 'chat' ? 'page' : undefined} onClick={() => setActiveSection?.('tools')}><SidebarIcon name="tools" />{openSidebar && <span>Tools</span>}</button>
    </nav>
    {openSidebar && <nav className="sidebar-history" aria-label="Recent chats">
      <h2>Recent chats</h2>
      <ul>{chats.map(chat => <li key={chat.id} className={chat.id === currentChatId ? 'is-current' : ''}>
        <button type="button" className="sidebar-chat" aria-current={chat.id === currentChatId ? 'page' : undefined} title={chatTitle(chat)} onClick={() => { loadChat(chat.id); setOpenSidebar(false); }}><SidebarIcon name="chat" /><span>{chatTitle(chat)}</span></button>
        <button type="button" className="sidebar-delete" aria-label={`Delete chat: ${chatTitle(chat)}`} onClick={event => handleDelete(event, chat.id)}><SidebarIcon name="trash" /></button>
      </li>)}</ul>
      {!chats.length && <p className="sidebar-empty">No chats yet</p>}
    </nav>}
    <div className="sidebar-bottom">
      <button type="button" aria-label="Clear IApp data" title="Clear IApp data" onClick={deleteStorage}><SidebarIcon name="trash" />{openSidebar && <span>Clear data</span>}</button>
      <button type="button" aria-label="Settings" title="Settings" onClick={() => { setOpenSidebar(false); setOpenModal(true); }}><SidebarIcon name="settings" />{openSidebar && <span>Settings</span>}</button>
    </div>
  </aside>;
}
