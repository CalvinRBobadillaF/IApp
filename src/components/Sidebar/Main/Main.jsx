import { useContext } from "react";
import './Main.css';
import { assets } from "../../../assets/assets";
import { Context } from "../../../Context/Context";

const Main = () => {

    const {
        currentChat,
        onSent,
        loading,
        resultData,
        userPrompt,
        setUserPrompt,
        openSidebar,
        setOpenSidebar
    } = useContext(Context);

    const userStorage = localStorage.getItem("User");
    const user = userStorage ? userStorage.replace(/["\\]/g, "") : "User";

    const handleKeyDown = e => {
        if (e.key === "Enter") {
            e.preventDefault();
            onSent();
        }
    };

    return (
        <div className="main">
            <div className="nav">
                <svg xmlns="http://www.w3.org/2000/svg"
                    onClick={() => setOpenSidebar(!openSidebar)}
                    fill="none" viewBox="0 0 24 24"
                    strokeWidth="1.5" stroke="currentColor"
                    className="MenuMobile">
                    <path strokeLinecap="round" strokeLinejoin="round"
                        d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>

                <p className="Title">Gemini</p>
                <img src={assets.user_icon} alt="user" />
            </div>

            <div className="main-container">
                {!currentChat || currentChat.messages.length === 0 ? (
                    <>
                        <div className="greet">
                            <span>Hello, {user}</span>
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
                        {currentChat.messages.map((msg, i) => (
                            <div key={i}
                                className={msg.role === "user" ? "result-title user-message" : "result-data ai-message"}
                            >
                                <img
                                    src={msg.role === "user" ? assets.user_icon : assets.gemini_icon}
                                    alt=""
                                />

                                {msg.role === "model" && i === currentChat.messages.length - 1 && loading ? (
                                    resultData.length === 0 ? (
                                        <div className="loader"><hr /><hr /><hr /></div>
                                    ) : (
                                        <p dangerouslySetInnerHTML={{ __html: resultData }}></p>
                                    )
                                ) : (
                                    <p dangerouslySetInnerHTML={{ __html: msg.text }}></p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

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
                            <svg xmlns="http://www.w3.org/2000/svg"
                                onClick={() => onSent()}
                                fill="none" viewBox="0 0 24 24"
                                strokeWidth="1.5" stroke="currentColor"
                                className="send-icon">
                                <path strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
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
