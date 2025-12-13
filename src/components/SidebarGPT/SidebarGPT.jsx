import { useContext } from "react";
import './SidebarGPT.css';
import { assets } from '../../assets/assets';
import { Context } from "../../Context/Context";

const SidebarGPT = () => {
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
        <div className={`sidebar-gpt ${openSidebar ? "open" : ""}`}>
            <div className="top-gpt">
                <svg xmlns="http://www.w3.org/2000/svg"
                    onClick={() => setOpenSidebar(!openSidebar)}
                    fill="none" viewBox="0 0 24 24"
                    strokeWidth="1.5" stroke="currentColor"
                    className="MenuPC-gpt">
                    <path strokeLinecap="round" strokeLinejoin="round"
                        d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>

                <div className="new-chat-gpt">
                    <img src={assets.plus_icon} alt="" onClick={newChat} />
                    {openSidebar ? <p onClick={newChat}>New Chat</p> : null}
                </div>

                {openSidebar && (
                    <div className="recent-gpt">
                        <p className="title-gpt">Recent Chats</p>

                        {chats.map(chat => (
                            <div key={chat.id}
                                className={`recent-entry-gpt ${chat.id === currentChatId ? "active" : ""}`}
                                onClick={() => loadChat(chat.id)}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
</svg>


                                <p>
                                    {chat.messages[0]
                                        ? chat.messages[0].text.slice(0, 22) + "..."
                                        : "Empty chat"}
                                </p>

                                {/* Botón borrar (stopPropagation para no seleccionar) */}
                                
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" onClick={(e) => handleDelete(e, chat.id)} viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" className="delete-svg-gpt">
  <path stroke-linecap="round" stroke-linejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
</svg>

                                
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="bottom-gpt">
                <div className="bottom-item-gpt recent-entry-gpt" onClick={deleteStorage}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" onClick={(e) => handleDelete(e, chat.id)} viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" className="delete-svg-gpt">
  <path stroke-linecap="round" stroke-linejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
</svg>
                    {openSidebar ? <p>Delete Key</p> : null}
                </div>

                

                <div className="bottom-item-gpt recent-entry-gpt" onClick={() => setOpenModal(!openModal)}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6" className="setting-svg-gpt">
  <path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" />
</svg>

                    {openSidebar ? <p>Settings</p> : null}
                </div>

                
            </div>
        </div>
    );
};

export default SidebarGPT;
