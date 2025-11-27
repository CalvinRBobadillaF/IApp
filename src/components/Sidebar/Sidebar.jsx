import React, { useContext, useState } from "react";
import './Sidebar.css'
import {assets} from '../../assets/assets'
import { Context } from "../../Context/Context";

const Sidebar = () => {

    const {openSidebar, setOpenSidebar} = useContext(Context)
    console.log(openSidebar)
    const {onSent, prevPrompts, setRecentPrompt, newChat, recentPrompt} = useContext(Context)

    const loadPrompt = async (promptText) => {
        
        setRecentPrompt(promptText); 
        await onSent(promptText);
    };
    console.log(recentPrompt)
    const firstPromptOfChat = prevPrompts.find(item => item.role === 'user')

    const formatPromptText = (text) => {
        return text.length > 18 ? text.substring(0,18) + '...' : text
    }
    
   return(
    
        
        <div className={`sidebar ${openSidebar ? 'open' : ''}`}>
            
        <div className="top">
                <svg xmlns="http://www.w3.org/2000/svg" onClick={() => setOpenSidebar(!openSidebar)} fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6" className="MenuPC">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
  </svg>
                <div className="new-chat">
                <img src={assets.plus_icon} alt="" onClick={() => newChat()} />
                {openSidebar?<p onClick={() => newChat()}>New Chat</p>:null}
                </div>

            {openSidebar && firstPromptOfChat ? 
            
            
                <div className="recent">
                
                
                    
                        
                        <div className="recent-entry"  onClick={() => loadPrompt(firstPromptOfChat.text)}>
                            
                    <img src={assets.message_icon} alt="" />
                    {formatPromptText(firstPromptOfChat.text)}
                </div>
                    
            </div>
                :  null}  
     </div>   
       
          
            <div className="bottom">
                <div className="bottom-item recent-entry">
                    
                    <img src={assets.question_icon} alt="" />
                {openSidebar?<p>Help</p>:null}
                
                </div>
                <div className="bottom-item recent-entry">
                    
                    <img src={assets.history_icon} alt="" />
                {openSidebar?<p>Activity</p>:null}
                </div>
                <div className="bottom-item recent-entry">
                    
                    <img src={assets.setting_icon} alt="" />
                {openSidebar?<p>Settings</p>:null}
                </div>
                
            </div>
           
        </div>
        
 
    )}


export default Sidebar

