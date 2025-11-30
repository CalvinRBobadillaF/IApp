import React, { useContext } from 'react'
import './Login.css'
import { Context } from '../../Context/Context'

const Login = () => {
    let { userName, setUserName, geminiKey, setGeminiKey, setLogged, logged } = useContext(Context)
    

    const setData = () => {
        let user = userName
        let key = geminiKey
        localStorage.setItem('Gemini Key', JSON.stringify(key))
        localStorage.setItem('User', JSON.stringify(user))
        window.location.reload()
        
/*
        if (user !== '' && key !== '') {
            setLogged(true)
        } else {
            alert('Ha ocurrido un error tratando de ingresar.')
        }*/

    }

    console.log('Usuario:', userName, 'Key:', geminiKey)

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
                
            </div>
            <button className='login-btn' onClick={() => setData()}>Log in</button>
        </div>
    )
}

export default Login