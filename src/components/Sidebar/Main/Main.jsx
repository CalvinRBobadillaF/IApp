import React, { useContext } from "react";
import './Main.css'
import { assets } from "../../../assets/assets";

import { Context } from "../../../Context/Context";

const Main = () => {

let {onSent, recentPrompt, showResult, loading, resultData, setUserPrompt, userPrompt} = useContext(Context)

const handleKeyDown = (e) => {
    // 1. Comprueba si la tecla presionada es 'Enter'
    if (e.key === 'Enter') {
        // 2. Opcional: Evita el comportamiento predeterminado (como saltos de línea en <textarea>)
        e.preventDefault(); 
        
        // 3. Ejecuta la función de envío
        onSent(); 
    }
};



{
  return (
    <div className="main">
      <div className="nav">
        <p>Gemini</p>
        <img src={assets.user_icon} alt="user" />
      </div>

      <div className="main-container">
        {!showResult ? 
          <>
            <div className="greet">
              <span>Hello, human</span>
              <p>How can I help you</p>
            </div>

            <div className="cards">
              <div className="card">
                <p>Suggest ideas to use IA in the best way possible</p>
                <img src={assets.compass_icon} alt="compass" />
              </div>

              <div className="card">
                <p>1 Month workout routine to be in your best shape</p>
                <img src={assets.bulb_icon} alt="bulb" />
              </div>

              <div className="card">
                <p>Create an history about dogs and cats</p>
                <img src={assets.message_icon} alt="message" />
              </div>

              <div className="card">
                <p>Create a simple tetris game</p>
                <img src={assets.code_icon} alt="code" />
              </div>
            </div>
          </>
         : 
          <div className="result" >
            <div className="result-title">
                <img src={assets.user_icon} alt="" />
                <p>{recentPrompt}</p>
            </div>
            <div className="result-data">
                
                {loading? <>
                <div className="loader">
                    <hr />
                    <hr />
                    <hr />
                </div>
                </> : <p dangerouslySetInnerHTML={{__html:resultData}}></p> }
                <img src={assets.gemini_icon} alt="" />
            </div>
            </div>
          
        }
      

      <div className="main-bottom">
        <div className="search-box">
          <input
            type="text"
            placeholder="Enter prompt here"
            onChange={(e) => setUserPrompt(e.target.value)}
            value={userPrompt}
          />
          <div>
            <img src={assets.gallery_icon} alt="gallery" />
            <img src={assets.mic_icon} alt="mic" />
            <img src={assets.send_icon} alt="send" onClick={onSent} onKeyDown={handleKeyDown} />
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