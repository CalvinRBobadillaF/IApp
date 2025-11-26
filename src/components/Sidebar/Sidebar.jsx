import React, { useContext, useState } from "react";
import './Sidebar.css'
import {assets} from '../../assets/assets'
import { Context } from "../../Context/Context";

const Sidebar = () => {

    const {openSidebar, setOpenSidebar} = useContext(Context)
    console.log(openSidebar)
    const {onSent, prevPrompts, setRecentPrompt, newChat} = useContext(Context)

    const loadPrompt = async (prompt) => {
        setRecentPrompt(prompt)
       await onSent(prompt)

    }
    console.log(prompt)
    
   return(
    
        
        <div className={`sidebar ${openSidebar ? 'open' : ''}`}>
            
            <div className="top">
                <img className="menu" onClick={() => setOpenSidebar(!openSidebar)} src={assets.menu_icon} alt="" />
                <div className="new-chat">
                <img src={assets.plus_icon} alt="" onClick={() => newChat()} />
                {openSidebar?<p onClick={() => newChat()}>New Chat</p>:null}
                </div>
                
            {openSidebar?
            <div className="recent">
                
                <p className="recent-title">{prevPrompts.map((item, index) => {
                    return (
                        
                        <div className="recent-entry" key={index} onClick={() => loadPrompt(item)}>
                            
                    <img src={assets.message_icon} alt="" />
                    <p>{item.slice(0, 18)}...</p>
                </div>
                    )
                })}</p>
                
            </div>
            :null}
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
        
            
    ) 
} 


export default Sidebar

/*

lse {
        return(
            <img className="menu" onClick={() => setOpenSidebar(!openSidebar)} src={assets.menu_icon} alt="" />
        )
    }

*/