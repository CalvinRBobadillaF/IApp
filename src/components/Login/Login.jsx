import { useContext } from 'react'
import './Login.css'
import { Context } from '../../Context/Context'

const Login = () => {
    let { userName, setUserName, geminiKey, setGeminiKey, GPTKey, setGPTKey, claudeKey, setClaudeKey } = useContext(Context)
    

    const setData = () => {
        let user = userName
        let key = geminiKey
        let GPT = GPTKey
        let Claude = claudeKey
        localStorage.setItem('Gemini Key', JSON.stringify(key))
        localStorage.setItem('User', JSON.stringify(user))
        localStorage.setItem('GPT Key', JSON.stringify(GPT)) 
        localStorage.setItem('Claude Key', JSON.stringify(Claude))
        window.location.reload()
    
    }

    return (
        <div className="login-container">
            <div className="login-box">
                <input 
                    type="text" 
                    placeholder="Your name..." 
                    onChange={(e) => setUserName(e.target.value)}
                />

                <input 
                    type="text" 
                    placeholder="GeminiKey" 
                    onChange={(e) => setGeminiKey(e.target.value)}
                />
                <input 
                    type="text" 
                    placeholder="GPT Key" 
                    onChange={(e) => setGPTKey(e.target.value)}
                />
                <input 
                    type="text" 
                    placeholder="Claude Key" 
                    onChange={(e) => setClaudeKey(e.target.value)}
                />
                
            </div>
            <button className='login-btn' onClick={() => setData()}>Log in</button>
        </div>
    )
}

export default Login