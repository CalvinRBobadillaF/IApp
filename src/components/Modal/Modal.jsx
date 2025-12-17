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
    modelFeature,
    setOpenModal
   } = useContext(Context)



   const changeModel = (modelName) => {
    let model = modelName
    localStorage.setItem('Model', JSON.stringify(model))

   }

   const changeModelGPT = (modelName) => {
    let model = modelName
    localStorage.setItem('ModelGPT', JSON.stringify(model))
   }

   const changeModelClaude = (modelName) => {
    let model = modelName
    localStorage.setItem('ModelClaude', JSON.stringify(model))
   }
   

const userModel = localStorage.getItem('Model')
const model = userModel?.replace(/["\\]/g, "")

const userModelGPT = localStorage.getItem('ModelGPT')
const modelGPT = userModelGPT?.replace(/["\\]/g, "")

const userModelClaude = localStorage.getItem('ModelClaude')
const modelClaude = userModelClaude?.replace(/["\\]/g, "")


if (modelFeature == 'Claude') {
    if (userModelClaude == undefined || userModelClaude != 'claude') {
        changeModelClaude('claude-sonnet-4-5-20250929')
    }
    return(
    <div className='Modal'>
        <div onClick={() => setOpenModal(!openModal)}>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"  class="size-6">
    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
    </div>

            <img src={assets.user_icon} alt="user"  />
            <p className='user-name'>{user}</p>
        
        <div className='Modal-input'>
            <input type="text"   placeholder={`Current model: ${modelClaude}`} />
            <div className="radio-group" onClick={() => setTheme(!theme)}>
  <div className="radio-option-modal" onClick={() => changeModelClaude('claude-sonnet-4-5-20250929')}>Claude Sonnet 4.5</div>
  <div className="radio-option-modal" onClick={() => changeModelClaude('claude-haiku-4-5-20251001')}>Claude haiku 4.5</div>
  <div className="radio-option-modal" onClick={() => changeModelClaude('claude-opus-4-5-20251101')}>Claude Opus 4.5</div>
</div>


        </div>
        
    </div>
    )

}



    if (modelFeature == 'GPT') {
        if (userModelGPT == undefined || userModelGPT != 'gpt' ) {
            changeModel('gpt-5')
        } 
    return(
    <div className='Modal'>
        <div onClick={() => setOpenModal(!openModal)}>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"  class="size-6">
    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
    </div>

            <img src={assets.user_icon} alt="user"  />
            <p className='user-name'>{user}</p>
        
        <div className='Modal-input'>
            <input type="text"   placeholder={`Current model: ${modelGPT}`} />
            <div className="radio-group" onClick={() => setTheme(!theme)}>
  <div className="radio-option-modal" onClick={() => changeModelGPT('gpt-5-nano')}>GPT-5 Nano</div>
  <div className="radio-option-modal" onClick={() => changeModelGPT('gpt-5.2')}>GPT 5.2</div>
  <div className="radio-option-modal" onClick={() => changeModelGPT('gpt-5-mini')}>GPT-5 Mini</div>
  <div className="radio-option-modal" onClick={() => changeModelGPT('gpt-5')}>GPT-5</div>
</div>


        </div>
        
    </div>
)
        }


if (userModel == undefined || userModel != 'gemini' ) {
    changeModel('gemini-2.5-flash')
}

return(
    <div className='Modal'>
        <div onClick={() => setOpenModal(!openModal)}>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"  class="size-6">
    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
    </div>

            <img src={assets.user_icon} alt="user"  />
            <p className='user-name'>{user}</p>
        
        <div className='Modal-input'>
            <input type="text"   placeholder={`Current model: ${model}`} />
            <div className="radio-group" onClick={() => setTheme(!theme)}>
  <div className="radio-option-modal" onClick={() => changeModel('gemini-2.5-flash')}>Gemini Flash</div>
  <div className="radio-option-modal" onClick={() => changeModel('gemini-2.5-pro')}>Gemini Pro</div>
  <div className="radio-option-modal" onClick={() => changeModel('gemini-3-pro-preview')}>Gemini Ultra</div>
  <div className="radio-option-modal" onClick={() => changeModel('gemini-2.5-flash-lite')}>Gemini Lite</div>
</div>


        </div>
        
    </div>
)

}

export default Modal