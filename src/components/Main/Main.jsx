import React, { useContext } from "react";
import "./Main.css";
import { assets } from "../../assets/assets";
import { Context } from "../../Context/Context";
import Modal from "../Modal/Modal";
import DropDown from "../DropDown/DropDown";

const Main = () => {
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

    const userStorage = localStorage.getItem("User");
    const user = userStorage ? userStorage.replace(/["\\]/g, "") : "User";

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            onSent();
        }
    };

    return (
        <div className="main">
            {/* NAV */}
            <div className="nav">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    onClick={() => setOpenSidebar(!openSidebar)}
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                    className="MenuMobile"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                    />
                </svg>

                <div className="title-div">
                    <p className="Title">Gemini</p>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        onClick={() => setModels(!models)}
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="1.5"
                        stroke="currentColor"
                        className="size-6"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m19.5 8.25-7.5 7.5-7.5-7.5"
                        />
                    </svg>

                    {models && <DropDown />}
                </div>

                <img
                    src={assets.user_icon}
                    alt="user"
                    onClick={() => setOpenModal(!openModal)}
                />
            </div>

            {/* MAIN CONTENT */}
            <div className="main-container">
                {!currentChat || currentChat.messages.length === 0 ? (
                    <>
                        <div className="greet">
                            <span>
                                 Hello, <span className="user-name">{user}</span>
                             </span>
                             <p>How can I help you?</p>
                        </div>

                        <div className="cards">
                            <div className="card" onClick={() => onSent("Suggest ideas to use AI effectively")}>
                                <p>Suggest ideas to use AI effectively</p>
                                <img src={assets.compass_icon} alt="" />
                            </div>

                            <div className="card" onClick={() => onSent("1 month workout routine to get in shape")}>
                                <p>1 month workout routine to get in shape</p>
                                <img src={assets.bulb_icon} alt="" />
                            </div>

                            <div className="card" onClick={() => onSent("Create a story about dogs and cats")}>
                                <p>Create a story about dogs and cats</p>
                                <img src={assets.message_icon} alt="" />
                            </div>

                            <div className="card" onClick={() => onSent("Create a simple Tetris game in Python")}>
                                <p>Create a simple Tetris game in Python</p>
                                <img src={assets.code_icon} alt="" />
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="result">
                        {/* Messages */}
                        {currentChat.messages.map((msg, i) => (
                            <div
                                key={i}
                                className={
                                    msg.role === "user"
                                        ? "result-title user-message"
                                        : "result-data ai-message"
                                }
                            >
                                <img
                                    src={
                                        msg.role === "user"
                                            ? assets.user_icon
                                            : assets.gemini_icon
                                    }
                                    alt=""
                                />
                                <p dangerouslySetInnerHTML={{ __html: msg.text }} />
                            </div>
                        ))}

                        {/* Loading / Thinking */}
                        {loading && currentChat.messages.at(-1)?.role === "user" && (
                            <div className="result-data ai-message">
                                <img src={assets.gemini_icon} alt="" />
                                <div className="thinking">✨ Thinking...</div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {openModal && <Modal />}

            {/* INPUT */}
            <div className="main-bottom">
                <div className="search-box">
                    <input
                        type="text"
                        placeholder="Enter prompt here"
                        value={userPrompt}
                        onChange={(e) => setUserPrompt(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />

                    <div>
                        <img src={assets.gallery_icon} alt="" />
                        <img src={assets.mic_icon} alt="" />

                        {userPrompt.length > 0 && (
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                onClick={() => onSent()}
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth="1.5"
                                stroke="currentColor"
                                className="send-icon"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
                                />
                            </svg>
                        )}
                    </div>
                </div>

                <p className="bottom-info">
                    Gemini may display incorrect information. Always verify important facts.
                </p>
            </div>
        </div>
    );
};

export default Main;
