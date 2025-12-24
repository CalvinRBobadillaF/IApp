import React, { useContext, useState, useRef, useEffect } from "react";
import './MainClaude.css';
import { assets } from "../../assets/assets";
import { Context } from "../../Context/Context";
import Modal from "../Modal/Modal";
import DropDown from "../DropDown/DropDown";
import RenderMessage from "../RenderMessage/RenderMessage";

const MainClaude = () => {
  const {
    currentChat,
    onSent,
    loading,
    userPrompt,
    setUserPrompt,
    openSidebar,
    setOpenModal,
    openModal,
    models,
    setModels,
    setOpenSidebar
  } = useContext(Context);

  // Referencia para el scroll automático
  const scrollRef = useRef(null);

  const userStorage = localStorage.getItem("User");
  const user = userStorage ? userStorage.replace(/["\\]/g, "") : "User";

  // Efecto para desplazar el scroll al final cuando hay mensajes nuevos
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentChat?.messages, loading]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSent();
    }
  };

  return (
    <div className="main-claude">
      {/* --- Navegación Superior --- */}
      <div className="nav-claude">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          onClick={() => setOpenSidebar(!openSidebar)}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="1.5"
          stroke="currentColor"
          className="MenuMobile-claude"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>

        <div className="title-div-claude">
          <p className="Title-claude">Claude</p>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            onClick={() => setModels(!models)}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            className="size-6"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
          {models ? <DropDown /> : null}
        </div>

        <img
          src={assets.user_icon}
          alt="user"
          onClick={() => setOpenModal(!openModal)}
          className="profile-image-claude"
        />
      </div>

      {/* --- Contenedor Principal --- */}
      <div className="main-container-claude">
        {!currentChat || currentChat.messages.length === 0 ? (
          <>
            <div className="greet-claude">
              <span>
                Hello, <span className="user-name-claude">{user}</span>
              </span>
              <p>How can I help you?</p>
            </div>

            <div className="cards-claude">
              <div className="card-claude" onClick={() => onSent("What is a LLM and how we can create and train one?")}>
                <p>What is a LLM and how we can create and train one?</p>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" />
                </svg>
              </div>

              <div className="card-claude" onClick={() => onSent("Create a website landing page about an general insurance agent")}>
                <p>Create a website landing page about an general insurance agent</p>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                </svg>
              </div>

              <div className="card-claude" onClick={() => onSent("What is React JS?")}>
                <p>What is React JS?</p>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                </svg>
              </div>

              <div className="card-claude" onClick={() => onSent("Explain in simple words the Programming fundamentals")}>
                <p>Explain in simple words the Programming fundamentals</p>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
                </svg>
              </div>
            </div>
          </>
        ) : (
          <div className="result-claude" ref={scrollRef}>
            {currentChat.messages.map((msg, i) => (
              <div
                key={i}
                className={msg.role === "user" ? "result-title-claude user-message-claude" : "result-data-claude ai-message-claude"}
              >
                <img src={msg.role === "user" ? assets.user_icon : assets.claude_icon} alt="" />
                <div className="message-content">
                  {/* USER MESSAGE */}
                  {msg.role === "user" && <p>{msg.text}</p>}

                  {/* AI MESSAGE */}
                  {msg.role === "model" && (
                    <RenderMessage tokens={msg.tokens} model={'claude'} />
                  )}
                </div>
              </div>
            ))}

            {loading && currentChat.messages.at(-1)?.role === "user" && (
              <div className="result-data-claude ai-message-claude">
                <img src={assets.claude_icon} alt="" />
                <div className="thinking">⚙️ Coding...</div>
              </div>
            )}
          </div>
        )}
      </div>

      {openModal === true ? <Modal /> : null}

      {/* --- Barra de Búsqueda Inferior --- */}
      <div className="main-bottom-claude">
        <div className="search-box-claude">
          <input
            type="text"
            placeholder="Enter prompt here"
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div>
            
            {userPrompt.length > 0 && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                onClick={() => onSent()}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                className="send-icon-gpt"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
              </svg>
            )}
          </div>
        </div>
        <p className="bottom-info-claude">
          Claude may display incorrect information. Always verify important info.
        </p>
      </div>
    </div>
  );
};

export default MainClaude;