
import { useContext } from 'react'
import './App.css'
import Main from './components/Sidebar/Main/Main'
import Sidebar from './components/Sidebar/Sidebar'
import { Context } from './Context/Context'
import Login from './components/Login/Login'


function App() {
  
  let userData = localStorage.getItem('user')
  let userKey = localStorage.getItem('Gemini Key')
  
  
  if (userData == undefined && userKey == undefined) {
    
    return(
      <>
      <Login />
      </>
    )
  }

 
  return (
    <>
    
    <Sidebar />
    <Main />
    </>
  )

}

export default App
