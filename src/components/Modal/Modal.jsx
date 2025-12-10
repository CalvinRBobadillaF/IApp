import './Modal.css'
import { assets } from "../../assets/assets";
import { useContext } from 'react';
import {Context} from '../../Context/Context'


const Modal = () => {
  const userStorage = localStorage.getItem("User");
    const user = userStorage ? userStorage.replace(/["\\]/g, "") : "User";
   let {
    theme,
    setTheme,
    openModal,
    setOpenModal
   } = useContext(Context)



   const changeModel = (modelName) => {
    let model = modelName
    localStorage.setItem('Model', JSON.stringify(model))

   }

   

   const userModel = localStorage.getItem('Model')
const model = userModel?.replace(/["\\]/g, "")

if (userModel == undefined ) {
    changeModel('gemini-2.5-flash')
}

   

return(
    <div className='Modal'>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" onClick={() => setOpenModal(!openModal)} class="size-6">
    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>

            <img src={assets.user_icon} alt="user"  />
            <p className='user-name'>{user}</p>
        
        <div className='Modal-input'>
            <input type="text"   placeholder={`Current model: ${model}`} />
            <div className="radio-group" onClick={() => setTheme(!theme)}>
  <div className="radio-option" onClick={() => changeModel('gemini-2.5-flash')}>Gemini Flash</div>
  <div className="radio-option" onClick={() => changeModel('gemini-2.5-pro')}>Gemini Pro</div>
  <div className="radio-option" onClick={() => changeModel('gemini-3-pro-preview')}>Gemini Ultra</div>
  <div className="radio-option" onClick={() => changeModel('gemini-2.5-flash-lite')}>Gemini Lite</div>
</div>


        </div>
        
    </div>
)

}

export default Modal