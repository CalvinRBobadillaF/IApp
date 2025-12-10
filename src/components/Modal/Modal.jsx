import './Modal.css'
import { assets } from "../../assets/assets";
import { useContext } from 'react';
import {Context} from '../../Context/Context'


const Modal = () => {
  const userStorage = localStorage.getItem("User");
    const user = userStorage ? userStorage.replace(/["\\]/g, "") : "User";
   let {
    theme,
    setTheme
   } = useContext(Context)



   const changeModel = (modelName) => {
    let model = modelName
    localStorage.setItem('Model', JSON.stringify(model))

   }

   const userModel = localStorage.getItem('Model')
const model = userModel?.replace(/["\\]/g, "")

   

return(
    <div className='Modal'>
        
            <img src={assets.user_icon} alt="user"  />
            <p className='user-name'>{user}</p>
        
        <div className='Modal-input'>
            <input type="text"   placeholder={`Current model: ${model}`} />
            <div className="radio-group">
  <div className="radio-option" onClick={() => changeModel('gemini-2.5-flash')}>Gemini Flash</div>
  <div className="radio-option" onClick={() => changeModel('gemini-2.5-pro')}>Gemini Pro</div>
  <div className="radio-option" onClick={() => changeModel('gemini-3-pro-preview')}>Gemini Ultra</div>
  <div className="radio-option" onClick={() => changeModel('gemini-2.5-flash-lite')}>Gemini Lite</div>
</div>


        </div>
        <button className='Modal-button' onClick={() => setTheme(!theme)}>Set Model</button>
    </div>
)

}

export default Modal