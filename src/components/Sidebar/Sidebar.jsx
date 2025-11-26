import React, { useContext, useState } from "react";
import './Sidebar.css'
import {assets} from '../../assets/assets'
import { Context } from "../../Context/Context";

const Sidebar = () => {

    const [openSidebar, setOpenSidebar] = useState(false)
    console.log(openSidebar)
    const {onSent, prevPrompts, setRecentPrompt} = useContext(Context)

   return(
        
        <div className="sidebar">
            <div className="top">
                <img className="menu" onClick={() => setOpenSidebar(!openSidebar)} src={assets.menu_icon} alt="" />
                <div className="new-chat">
                <img src={assets.plus_icon} alt="" />
                {openSidebar?<p>New Chat</p>:null}
                </div>
            {openSidebar?
            <div className="recent">
                <p className="recent-title">{prevPrompts.map((item, index) => {
                    return (
                        <div className="recent-entry">
                    <img src={assets.message_icon} alt="" />
                    <p>{item}...</p>
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