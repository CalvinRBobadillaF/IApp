
import { useContext } from 'react'
import './App.css'
import Main from './components/Main/Main'
import Sidebar from './components/Sidebar/Sidebar'
import { Context } from './Context/Context'
import Login from './components/Login/Login'
import MainGPT from './components/MainGPT/MainGPT'
import SidebarGPT from './components/SidebarGPT/SidebarGPT'


function App() {
  let {modelFeature} = useContext(Context)
  let userData = localStorage.getItem('user')
  let userKey = localStorage.getItem('Gemini Key')
  
  
  if (userData == undefined && userKey == undefined) {
    
    return(
      <>
      <Login />
      </>
    )
  }

  if (modelFeature == 'ChatGPT') {
    return(
      <>
      <SidebarGPT />
      <MainGPT />
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
