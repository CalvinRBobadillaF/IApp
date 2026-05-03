import React, { useContext, useEffect, useRef } from "react";
import "./MainGPT.css";
import { assets } from "../../assets/assets";
import { Context } from "../../Context/Context";
import Modal from "../Modal/Modal";
import DropDown from "../DropDown/DropDown";
import RenderMessage, { UserMessage } from "../RenderMessage/RenderMessage";

const MainGPT = () => {
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

  const scrollRef  = useRef(null);
  const inputRef   = useRef(null);

  const userStorage = localStorage.getItem("User");
  const user = userStorage ? userStorage.replace(/["\\]/g, "") : "User";

  // Auto-scroll al recibir nuevos mensajes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentChat?.messages, loading]);

  // FIX: Shift+Enter = salto de línea, Enter solo = enviar
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSent();
    }
  };

  // Auto-resize igual que MainClaude
  const autoResize = (element) => {
    element.style.height = "auto";
    element.style.height = Math.min(element.scrollHeight, 200) + "px";
  };

  // Reset height al enviar
  const handleSend = () => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
    onSent();
  };

  return (
    <div className="main-gpt">

      {/* NAV */}
      <div className="nav-gpt">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          onClick={() => setOpenSidebar(!openSidebar)}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="1.5"
          stroke="currentColor"
          className="MenuMobile-gpt"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>

        <div className="title-div-gpt">
          <p className="Title-gpt">ChatGPT</p>
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
          {models && <DropDown />}
        </div>

        <img
          src={assets.user_icon}
          alt="user"
          className="profile-img-gpt"
          onClick={() => setOpenModal(!openModal)}
        />
      </div>

      {/* MAIN CONTENT */}
      <div className="main-container-gpt">
        {!currentChat || currentChat.messages.length === 0 ? (
          <>
            <div className="greet-gpt">
              <span>Hello <span className="user-name-gpt">{user} </span></span>
              <p>How can I help you?</p>
            </div>

            <div className="cards-gpt">
              <div className="card-gpt" onClick={() => onSent("Give me a fun fact")}>
                <p>Give me a fun fact!</p>
                <img src={assets.bulb_icon} alt="" />
              </div>
              <div className="card-gpt" onClick={() => onSent("Who wins between Anakin and Luke Skywalker?")}>
                <p>Who wins between Anakin and Luke Skywalker?</p>
                <img src={assets.message_icon} alt="" />
              </div>
              <div className="card-gpt" onClick={() => onSent("Technological advances that we may have in 2050")}>
                <p>Technological advances that we may have in 2050</p>
                <img src={assets.compass_icon} alt="" />
              </div>
              <div className="card-gpt" onClick={() => onSent("Create a landing page of a Yaroa commerce with JS, HTML and CSS")}>
                <p>Create a landing page of a Yaroa commerce with JS, HTML and CSS</p>
                <img src={assets.code_icon} alt="" />
              </div>
            </div>
          </>
        ) : (
          <div className="result-gpt" ref={scrollRef}>
            {currentChat.messages.map((msg, i) => (
              <div
                key={i}
                className={msg.role === "user" ? "result-title-gpt user-message-gpt" : "result-data-gpt ai-message-gpt"}
              >
                <img src={msg.role === "user" ? assets.user_icon : assets.chatgpt_icon} alt="" />
                <div className="message-content">
                  {msg.role === "user" && <UserMessage text={msg.text} />}
                  {msg.role === "model" && <RenderMessage tokens={msg.tokens} model={'gpt'} />}
                </div>
              </div>
            ))}

            {loading && currentChat.messages.at(-1)?.role === "user" && (
              <div className="result-data-gpt ai-message-gpt">
                <img src={assets.chatgpt_icon} alt="" />
                <div className="thinking-gpt">🌠 Reasoning...</div>
              </div>
            )}
          </div>
        )}
      </div>

      {openModal && <Modal />}

      {/* INPUT — ahora textarea igual que MainClaude */}
      <div className="main-bottom-gpt">
        <div className="search-box-gpt">
          <textarea
            ref={inputRef}
            placeholder="Message ChatGPT"
            value={userPrompt}
            rows={1}
            onChange={(e) => {
              setUserPrompt(e.target.value);
              autoResize(e.target);
            }}
            onKeyDown={handleKeyDown}
          />
          <div>
            {userPrompt.length > 0 && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                onClick={handleSend}
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
        <p className="bottom-info-gpt">
          ChatGPT may display incorrect information. Always verify important info.
        </p>
      </div>
    </div>
  );
};

export default MainGPT;
