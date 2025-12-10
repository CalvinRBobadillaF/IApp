import { useContext } from "react";
import './Sidebar.css';
import { assets } from '../../assets/assets';
import { Context } from "../../Context/Context";

const Sidebar = () => {
    const {
        chats,
        currentChatId,
        loadChat,
        newChat,
        openSidebar,
        setOpenSidebar,
        deleteChat,
        setOpenModal,
        openModal
        
    } = useContext(Context);

    const handleDelete = (e, chatId) => {
        e.stopPropagation(); // evitar que dispare loadChat
        const ok = confirm("¿Seguro que quieres borrar este chat? Esta acción no se puede deshacer.");
        if (ok) deleteChat(chatId);
    };

    const resetStorage = () => {
        localStorage.removeItem('Gemini Key')
        window.location.reload()
    }

    const deleteStorage = (e) => {
        e.stopPropagation()
        const ok = confirm('Seguro que quieres eliminar local storage?')
        if (ok) resetStorage()
    }

    return (
        <div className={`sidebar ${openSidebar ? "open" : ""}`}>
            <div className="top">
                <svg xmlns="http://www.w3.org/2000/svg"
                    onClick={() => setOpenSidebar(!openSidebar)}
                    fill="none" viewBox="0 0 24 24"
                    strokeWidth="1.5" stroke="currentColor"
                    className="MenuPC">
                    <path strokeLinecap="round" strokeLinejoin="round"
                        d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>

                <div className="new-chat">
                    <img src={assets.plus_icon} alt="" onClick={newChat} />
                    {openSidebar ? <p onClick={newChat}>New Chat</p> : null}
                </div>

                {openSidebar && (
                    <div className="recent">
                        <p className="title">Recent Chats</p>

                        {chats.map(chat => (
                            <div key={chat.id}
                                className={`recent-entry ${chat.id === currentChatId ? "active" : ""}`}
                                onClick={() => loadChat(chat.id)}
                            >
                                <img src={assets.message_icon} alt="" />

                                <p>
                                    {chat.messages[0]
                                        ? chat.messages[0].text.slice(0, 22) + "..."
                                        : "Empty chat"}
                                </p>

                                {/* Botón borrar (stopPropagation para no seleccionar) */}
                                
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" onClick={(e) => handleDelete(e, chat.id)} viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" className="delete-svg">
  <path stroke-linecap="round" stroke-linejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
</svg>

                                
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="bottom">
                <div className="bottom-item recent-entry" onClick={deleteStorage}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" onClick={(e) => handleDelete(e, chat.id)} viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" className="delete-svg">
  <path stroke-linecap="round" stroke-linejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
</svg>
                    {openSidebar ? <p>Delete Key</p> : null}
                </div>

                <div className="bottom-item recent-entry">
                    <img src={assets.history_icon} alt="" />
                    {openSidebar ? <p>Activity</p> : null}
                </div>

                <div className="bottom-item recent-entry" onClick={() => setOpenModal(!openModal)}>
                    <img src={assets.setting_icon} alt="" />
                    {openSidebar ? <p>Settings</p> : null}
                </div>

                
            </div>
        </div>
    );
};

export default Sidebar;




