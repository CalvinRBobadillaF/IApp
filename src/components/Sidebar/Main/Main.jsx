import React, { useContext, useEffect } from "react";
import {ReactMarkdown} from "react"
import './Main.css'
import { assets } from "../../../assets/assets";

import { Context } from "../../../Context/Context";

const Main = () => {

let {onSent, showResult, loading, resultData, setUserPrompt, userPrompt, userName,  prevPrompts, openSidebar, setOpenSidebar} = useContext(Context)
    let userStorage = localStorage.getItem('User')
    const user = userStorage.replace(/["\\]/g, "")

const handleKeyDown = (e) => {
    // 1. Comprueba si la tecla presionada es 'Enter'
    if (e.key === 'Enter') {
        // 2. Opcional: Evita el comportamiento predeterminado (como saltos de línea en <textarea>)
        e.preventDefault(); 
        
        // 3. Ejecuta la función de envío
        onSent(); 
        setUserPrompt('')
    }
};

useEffect(() => {
        if (resultData && resultData.length > 0) {
            
        }
    }, [resultData]);

{
  return (
    <div className="main">
      <div className="nav">
        
        <svg xmlns="http://www.w3.org/2000/svg" onClick={() => setOpenSidebar(!openSidebar)} fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6" className="MenuMobile">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
  </svg>

        <p className="Title">Gemini</p>
        <img src={assets.user_icon} alt="user" />
      </div>

      <div className="main-container">
                {/* 💡 SOLUCIÓN CLAVE: Si hay resultados (o historial), mostrarlo */}
                {!showResult ? 
                    <>
                        <div className="greet">
                            <span>Hello, {user}</span>
                            <p>How can I help you</p>
                        </div>
                        <div className="cards">
                            <div className="card" onClick={() => handleCardClick('Suggest ideas to use IA in the best way possible')}>
                                <p>Suggest ideas to use IA in the best way possible</p>
                                <img src={assets.compass_icon} alt="compass" />
                            </div>
                            <div className="card" onClick={() => handleCardClick('1 Month workout routine to be in your best shape')}>
                                <p>1 Month workout routine to be in your best shape</p>
                                <img src={assets.bulb_icon} alt="bulb" />
                            </div>
                            <div className="card" onClick={() => handleCardClick('Create an history about dogs and cats')}>
                                <p>Create an history about dogs and cats</p>
                                <img src={assets.message_icon} alt="message" />
                            </div>
                            <div className="card" onClick={() => handleCardClick('Create a simple tetris game with Python')}>
                                <p>Create a simple tetris game with Python</p>
                                <img src={assets.code_icon} alt="code" />
                            </div>
                        </div>
                    </>
                : 
                    // 💡 NUEVO CÓDIGO: Mapear sobre prevPrompts para mostrar cada mensaje
                    <div className="result">
                        {prevPrompts.map((item, index) => {
                            if (item.role === 'user') {
                                return (
                                    <div key={index} className="result-title user-message">
                                        <img src={assets.user_icon} alt="User" />
                                        <p>{item.text}</p>
                                    </div>
                                );
                            } else { // role === 'model'
                                // Si es la última respuesta Y está cargando, usa resultData (animado)
                                // De lo contrario, muestra el texto completo de la respuesta de la IA
                                const isLastModelMessage = index === prevPrompts.length - 1 && loading;
                                return (
                                    <div key={index} className="result-data ai-message">
                                        <img src={assets.gemini_icon} alt="AI" />
                                        {isLastModelMessage ? 
                                            // Muestra el loader si aún está cargando la última respuesta
                                            <>
                                                {loading && resultData.length === 0 ? (
                                                    <div className="loader">
                                                        <hr /><hr /><hr />
                                                    </div>
                                                ) : (
                                                    <p dangerouslySetInnerHTML={{ __html: resultData }}></p>
                                                )}
                                            </>
                                            : 
                                            // Si no es la última respuesta o ya terminó de cargar, muestra el texto completo
                                            <p dangerouslySetInnerHTML={{ __html: item.text }}></p>
                                        }
                                    </div>
                                );
                            }
                        })}
                        {/* // Si quieres mostrar un loader genérico mientras la IA escribe la última respuesta,
                            // podrías añadirlo aquí, pero la lógica de arriba ya lo maneja
                            {loading && prevPrompts.length > 0 && prevPrompts[prevPrompts.length - 1].role === 'user' ? (
                                <div className="result-data ai-message">
                                    <img src={assets.gemini_icon} alt="AI" />
                                    <div className="loader">
                                        <hr /><hr /><hr />
                                    </div>
                                </div>
                            ) : null} 
                        */}
                    </div>
                }

      <div className="main-bottom">
        <div className="search-box">
          <input
            type="text"
            placeholder="Enter prompt here"
            onChange={(e) => setUserPrompt(e.target.value)}
            value={userPrompt}
            onKeyDown={handleKeyDown}
          />
          <div>
            <img src={assets.gallery_icon} alt="gallery" />
            <img src={assets.mic_icon} alt="mic" />
            {userPrompt? <img src={assets.send_icon} alt="send" onClick={() => onSent()}/> : null  }
          </div>
        </div>

        <p className="bottom-info">
          Gemini, and any other LLM may display incorrect information. Please
          double check important info.
        </p>
      </div>
    </div>
    </div>
  );
    

}}


export default Main