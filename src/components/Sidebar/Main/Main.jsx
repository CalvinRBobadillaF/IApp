import React, { useContext } from "react";
import {ReactMarkdown} from "react"
import './Main.css'
import { assets } from "../../../assets/assets";

import { Context } from "../../../Context/Context";

const Main = () => {

let {onSent, setPrevPrompts, recentPrompt, showResult, loading, resultData, setUserPrompt, userPrompt, setRecentPrompt, prevPrompts, openSidebar, setOpenSidebar} = useContext(Context)

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


console.log(prevPrompts)
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
        {!showResult ? 
          <>
            <div className="greet">
              <span>Hello, human</span>
              <p>How can I help you</p>
            </div>

            <div className="cards">
              <div className="card" onClick={() =>  setRecentPrompt('Suggest ideas to use IA in the best way possible',  onSent('Suggest ideas to use IA in the best way possible'), setPrevPrompts(prev => [...prev, userPrompt]))}>
                <p>Suggest ideas to use IA in the best way possible</p>
                <img src={assets.compass_icon} alt="compass" />
              </div>

              <div className="card" onClick={() => { setRecentPrompt('1 Month workout routine to be in your best shape', onSent('1 Month workout routine to be in your best shape'), setPrevPrompts(prev => [...prev, userPrompt]))}}>
                <p>1 Month workout routine to be in your best shape</p>
                <img src={assets.bulb_icon} alt="bulb" />
              </div>

              <div className="card" onClick={() => setRecentPrompt('Create an history about dogs and cats', onSent('Create an history about dogs and cats'), setPrevPrompts(prev => [...prev, userPrompt]))}>
                <p onClick={() => setUserPrompt('Create an history about dogs and cats')}>Create an history about dogs and cats</p>
                <img src={assets.message_icon} alt="message" />
              </div>

              <div className="card" onClick={() => setRecentPrompt('Create a simple tetris game with Python', onSent('Create a simple tetris game with Python'),  setPrevPrompts(prev => [...prev, userPrompt]))}>
                <p>Create a simple tetris game with Python</p>
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
                </> : <p dangerouslySetInnerHTML={{__html:resultData}}></p>}
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
            onKeyDown={handleKeyDown}
          />
          <div>
            <img src={assets.gallery_icon} alt="gallery" />
            <img src={assets.mic_icon} alt="mic" />
            {userPrompt? <img src={assets.send_icon} alt="send" onClick={() => onSent(userPrompt)}/> : null  }
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